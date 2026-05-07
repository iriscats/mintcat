use std::ffi::{c_char, c_void, CStr, CString};
use std::fs;
use std::path::{Path, PathBuf};
use std::ptr;

use anyhow::{Context, Result};
use libloading::Library;
use mintcat_integrator_api::{
    CheckForeignPaksRequest, CheckInstalledRequest, CheckModConflictsRequest, FindGamePakRequest,
    InstallEvent, InstallProgress, InstallRequest, PathRequest, UninstallModsRequest,
};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tauri::{path::BaseDirectory, AppHandle, Manager};

const ABI_VERSION: u32 = 1;
const BUNDLED_RUNTIME_VERSION: &str = "bundled";
const PUBLIC_KEY: &str = "";

type ProgressCallback = unsafe extern "C" fn(event_json: *const c_char, user_data: *mut c_void);
type AbiVersionFn = unsafe extern "C" fn() -> u32;
type InstallFn = unsafe extern "C" fn(
    request_json: *const c_char,
    callback: Option<ProgressCallback>,
    user_data: *mut c_void,
    response_json: *mut *mut c_char,
    error_message: *mut *mut c_char,
) -> i32;
type CommandFn = unsafe extern "C" fn(
    request_json: *const c_char,
    response_json: *mut *mut c_char,
    error_message: *mut *mut c_char,
) -> i32;
type FreeStringFn = unsafe extern "C" fn(ptr: *mut c_char);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegratorRuntimeManifest {
    pub version: String,
    pub url: String,
    #[serde(default)]
    pub md5: Option<String>,
    #[serde(default)]
    pub signature: Option<String>,
    #[serde(default)]
    pub min_app_version: Option<String>,
    #[serde(default)]
    pub max_app_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct IntegratorRuntimeState {
    #[serde(default)]
    active_version: Option<String>,
    #[serde(default)]
    previous_version: Option<String>,
    #[serde(default)]
    last_failed_version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegratorRuntimeStatus {
    pub active_version: Option<String>,
    pub previous_version: Option<String>,
    pub last_failed_version: Option<String>,
    pub has_local_runtime: bool,
}

struct ProgressBridge<'a> {
    progress: &'a dyn InstallProgress,
}

pub fn install_mods_with_runtime(
    app: &AppHandle,
    progress: &dyn InstallProgress,
    request: InstallRequest,
) -> Result<()> {
    let path = active_runtime_path(app)?;
    unsafe { install_with_library(&path, progress, &request) }
}

pub fn uninstall_mods_with_runtime(
    app: &AppHandle,
    game_path: String,
    is_delete_ue4ss: bool,
) -> Result<bool> {
    call_runtime_command(
        app,
        b"mintcat_integrator_uninstall_mods",
        &UninstallModsRequest {
            game_path,
            is_delete_ue4ss,
        },
    )
}

pub fn check_installed_with_runtime(
    app: &AppHandle,
    game_path: String,
    install_time: u64,
) -> Result<String> {
    call_runtime_command(
        app,
        b"mintcat_integrator_check_installed",
        &CheckInstalledRequest {
            game_path,
            install_time,
        },
    )
}

pub fn find_game_pak_with_runtime(app: &AppHandle, game_name: Option<String>) -> Result<String> {
    call_runtime_command(
        app,
        b"mintcat_integrator_find_game_pak",
        &FindGamePakRequest { game_name },
    )
}

pub fn check_foreign_paks_with_runtime(app: &AppHandle, game_path: String) -> Result<Vec<String>> {
    call_runtime_command(
        app,
        b"mintcat_integrator_check_foreign_paks",
        &CheckForeignPaksRequest { game_path },
    )
}

pub fn is_valid_unpacked_mod_with_runtime(app: &AppHandle, path: String) -> Result<bool> {
    call_runtime_command(
        app,
        b"mintcat_integrator_is_valid_unpacked_mod",
        &PathRequest { path },
    )
}

pub fn check_mod_conflicts_with_runtime(
    app: &AppHandle,
    mod_list_json: String,
    game_name: Option<String>,
) -> Result<Vec<mintcat_integrator_api::ModConflict>> {
    call_runtime_command(
        app,
        b"mintcat_integrator_check_mod_conflicts",
        &CheckModConflictsRequest {
            mod_list_json,
            game_name,
        },
    )
}

pub fn validate_zip_file_with_runtime(app: &AppHandle, path: String) -> Result<bool> {
    call_runtime_command(
        app,
        b"mintcat_integrator_validate_zip_file",
        &PathRequest { path },
    )
}

#[tauri::command]
pub async fn install_integrator_runtime_from_manifest(
    app: AppHandle,
    manifest: IntegratorRuntimeManifest,
) -> Result<IntegratorRuntimeStatus, String> {
    validate_manifest(&manifest)?;
    validate_compatibility(&manifest)?;
    let bytes = download(&app, &manifest.url).await?;
    verify_hash(&bytes, &manifest)?;
    verify_signature(&manifest)?;

    let version_dir = versions_dir(&app)?.join(&manifest.version);
    fs::create_dir_all(&version_dir).map_err(|e| e.to_string())?;
    let runtime_path = version_dir.join(runtime_file_name());
    fs::write(&runtime_path, bytes).map_err(|e| e.to_string())?;

    unsafe {
        validate_abi(&runtime_path).map_err(|e| format!("{:#}", e))?;
    }

    let mut state = read_state(&app);
    state.previous_version = state.active_version.clone();
    state.active_version = Some(manifest.version);
    state.last_failed_version = None;
    write_state(&app, &state)?;
    cleanup_old_versions(&app, &state);
    status(app)
}

#[tauri::command]
pub fn get_integrator_runtime_status(app: AppHandle) -> Result<IntegratorRuntimeStatus, String> {
    if let Err(error) = ensure_bundled_runtime(&app) {
        log::warn!(
            "[IntegratorRuntime] failed to seed bundled runtime: {:#}",
            error
        );
    }
    status(app)
}

pub fn ensure_bundled_runtime(app: &AppHandle) -> Result<()> {
    if active_library_path(app).is_some() {
        return Ok(());
    }

    let bundled = bundled_runtime_path(app)?;
    if !bundled.is_file() {
        return Ok(());
    }

    unsafe {
        validate_abi(&bundled).context("bundled integrator ABI validation failed")?;
    }

    let target_dir = versions_dir(app)
        .map_err(anyhow::Error::msg)?
        .join(BUNDLED_RUNTIME_VERSION);
    fs::create_dir_all(&target_dir)
        .with_context(|| format!("failed to create integrator runtime dir: {:?}", target_dir))?;
    let target = target_dir.join(runtime_file_name());
    if !target.is_file() {
        fs::copy(&bundled, &target).with_context(|| {
            format!(
                "failed to copy bundled integrator runtime from {:?} to {:?}",
                bundled, target
            )
        })?;
    }

    let mut state = read_state(app);
    state.active_version = Some(BUNDLED_RUNTIME_VERSION.to_string());
    state.previous_version = None;
    write_state(app, &state).map_err(anyhow::Error::msg)
}

fn active_runtime_path(app: &AppHandle) -> Result<PathBuf> {
    if let Err(error) = ensure_bundled_runtime(app) {
        log::warn!(
            "[IntegratorRuntime] failed to seed bundled runtime: {:#}",
            error
        );
    }
    active_library_path(app).context("integrator runtime is not available")
}

fn call_runtime_command<TRequest, TResponse>(
    app: &AppHandle,
    symbol: &[u8],
    request: &TRequest,
) -> Result<TResponse>
where
    TRequest: Serialize,
    TResponse: DeserializeOwned,
{
    let path = active_runtime_path(app)?;
    unsafe { call_library_command(&path, symbol, request) }
}

unsafe fn call_library_command<TRequest, TResponse>(
    path: &Path,
    symbol: &[u8],
    request: &TRequest,
) -> Result<TResponse>
where
    TRequest: Serialize,
    TResponse: DeserializeOwned,
{
    let library = Library::new(path)
        .with_context(|| format!("failed to load integrator runtime: {:?}", path))?;
    validate_library_abi(&library)?;
    let command = *library
        .get::<CommandFn>(symbol)
        .with_context(|| format!("missing {}", String::from_utf8_lossy(symbol)))?;
    let free_string = *library
        .get::<FreeStringFn>(b"mintcat_integrator_free_string")
        .context("missing mintcat_integrator_free_string")?;

    let request_json =
        CString::new(serde_json::to_string(request)?).context("request contains nul byte")?;
    let mut response_json: *mut c_char = ptr::null_mut();
    let mut error_message: *mut c_char = ptr::null_mut();
    let code = command(
        request_json.as_ptr(),
        &mut response_json,
        &mut error_message,
    );

    let error = read_and_free(error_message, free_string);
    let response = read_and_free(response_json, free_string);
    if code != 0 {
        anyhow::bail!(error.unwrap_or_else(|| {
            format!(
                "integrator command {} failed with code {code}",
                String::from_utf8_lossy(symbol)
            )
        }));
    }

    let response = response.with_context(|| {
        format!(
            "integrator command {} returned no response",
            String::from_utf8_lossy(symbol)
        )
    })?;
    serde_json::from_str(&response).with_context(|| {
        format!(
            "failed to parse integrator command {} response",
            String::from_utf8_lossy(symbol)
        )
    })
}

unsafe fn install_with_library(
    path: &Path,
    progress: &dyn InstallProgress,
    request: &InstallRequest,
) -> Result<()> {
    let library = Library::new(path)
        .with_context(|| format!("failed to load integrator runtime: {:?}", path))?;
    validate_library_abi(&library)?;

    let install = *library
        .get::<InstallFn>(b"mintcat_integrator_install")
        .context("missing mintcat_integrator_install")?;
    let free_string = *library
        .get::<FreeStringFn>(b"mintcat_integrator_free_string")
        .context("missing mintcat_integrator_free_string")?;

    let request_json = CString::new(serde_json::to_string(request)?)
        .context("install request contains nul byte")?;
    let bridge = ProgressBridge { progress };
    let mut response_json: *mut c_char = ptr::null_mut();
    let mut error_message: *mut c_char = ptr::null_mut();

    let code = install(
        request_json.as_ptr(),
        Some(progress_callback),
        &bridge as *const ProgressBridge<'_> as *mut c_void,
        &mut response_json,
        &mut error_message,
    );

    let error = read_and_free(error_message, free_string);
    let _response = read_and_free(response_json, free_string);
    if code != 0 {
        anyhow::bail!(error.unwrap_or_else(|| format!("integrator failed with code {code}")));
    }
    Ok(())
}

unsafe fn validate_abi(path: &Path) -> Result<()> {
    let library = Library::new(path)
        .with_context(|| format!("failed to load integrator runtime: {:?}", path))?;
    validate_library_abi(&library)
}

unsafe fn validate_library_abi(library: &Library) -> Result<()> {
    let abi_version = *library
        .get::<AbiVersionFn>(b"mintcat_integrator_abi_version")
        .context("missing mintcat_integrator_abi_version")?;
    if abi_version() != ABI_VERSION {
        anyhow::bail!("integrator ABI mismatch");
    }
    Ok(())
}

unsafe extern "C" fn progress_callback(event_json: *const c_char, user_data: *mut c_void) {
    if event_json.is_null() || user_data.is_null() {
        return;
    }
    let bridge = &*(user_data as *const ProgressBridge<'_>);
    let event = CStr::from_ptr(event_json)
        .to_str()
        .ok()
        .and_then(|value| serde_json::from_str::<InstallEvent>(value).ok());
    if let Some(event) = event {
        let _ = bridge.progress.emit(event);
    }
}

unsafe fn read_and_free(ptr: *mut c_char, free_string: FreeStringFn) -> Option<String> {
    if ptr.is_null() {
        return None;
    }
    let value = CStr::from_ptr(ptr).to_string_lossy().into_owned();
    free_string(ptr);
    Some(value)
}

fn runtime_file_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "mintcat_integrator.dll"
    }
    #[cfg(target_os = "macos")]
    {
        "libmintcat_integrator.dylib"
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        "libmintcat_integrator.so"
    }
}

fn bundled_runtime_path(app: &AppHandle) -> Result<PathBuf> {
    let resource_path = app
        .path()
        .resolve(
            format!("plugins/{}", runtime_file_name()),
            BaseDirectory::Resource,
        )
        .context("failed to resolve bundled integrator runtime")?;
    if resource_path.is_file() {
        return Ok(resource_path);
    }

    #[cfg(debug_assertions)]
    if let Some(dev_path) = dev_runtime_candidates()
        .into_iter()
        .find(|path| path.is_file())
    {
        log::info!(
            "[IntegratorRuntime] using local dev runtime: {:?}",
            dev_path
        );
        return Ok(dev_path);
    }

    Ok(resource_path)
}

#[cfg(debug_assertions)]
fn dev_runtime_candidates() -> Vec<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let target_dir = option_env!("CARGO_TARGET_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| manifest_dir.join("target"));
    let profile = option_env!("PROFILE").unwrap_or("debug");
    let runtime_name = runtime_file_name();

    vec![
        manifest_dir
            .join("assets")
            .join("plugins")
            .join(runtime_name),
        target_dir.join(profile).join(runtime_name),
        target_dir.join("debug").join(runtime_name),
        target_dir.join("release").join(runtime_name),
    ]
}

fn root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("plugins"))
        .map_err(|e| e.to_string())
}

fn versions_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(root(app)?.join("versions"))
}

fn state_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(root(app)?.join("state.json"))
}

fn read_state(app: &AppHandle) -> IntegratorRuntimeState {
    state_file(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|value| serde_json::from_str(&value).ok())
        .unwrap_or_default()
}

fn write_state(app: &AppHandle, state: &IntegratorRuntimeState) -> Result<(), String> {
    fs::create_dir_all(root(app)?).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(state_file(app)?, json).map_err(|e| e.to_string())
}

fn active_library_path(app: &AppHandle) -> Option<PathBuf> {
    let version = read_state(app).active_version?;
    valid_version(&version).ok()?;
    let path = versions_dir(app)
        .ok()?
        .join(version)
        .join(runtime_file_name());
    path.is_file().then_some(path)
}

fn status(app: AppHandle) -> Result<IntegratorRuntimeStatus, String> {
    let state = read_state(&app);
    Ok(IntegratorRuntimeStatus {
        active_version: state.active_version,
        previous_version: state.previous_version,
        last_failed_version: state.last_failed_version,
        has_local_runtime: active_library_path(&app).is_some(),
    })
}

fn valid_version(version: &str) -> Result<(), String> {
    if version.is_empty()
        || version.contains("..")
        || version.contains('/')
        || version.contains('\\')
        || version.chars().any(|c| c.is_control())
    {
        Err("invalid integrator version".into())
    } else {
        Ok(())
    }
}

fn validate_manifest(manifest: &IntegratorRuntimeManifest) -> Result<(), String> {
    valid_version(&manifest.version)?;
    if manifest.url.trim().is_empty() {
        return Err("integrator runtime url is required".into());
    }
    if manifest
        .md5
        .as_deref()
        .unwrap_or_default()
        .trim()
        .is_empty()
    {
        return Err("integrator runtime md5 is required".into());
    }
    Ok(())
}

fn validate_compatibility(manifest: &IntegratorRuntimeManifest) -> Result<(), String> {
    let app_version = env!("CARGO_PKG_VERSION");
    if let Some(min) = &manifest.min_app_version {
        if cmp_version(app_version, min).is_lt() {
            return Err(format!("integrator requires app >= {min}"));
        }
    }
    if let Some(max) = &manifest.max_app_version {
        if cmp_version(app_version, max).is_gt() {
            return Err(format!("integrator requires app <= {max}"));
        }
    }
    Ok(())
}

fn cmp_version(left: &str, right: &str) -> std::cmp::Ordering {
    let parse = |value: &str| {
        value
            .split(|c| c == '.' || c == '-')
            .take(3)
            .map(|part| part.parse::<u64>().unwrap_or(0))
            .collect::<Vec<_>>()
    };
    parse(left).cmp(&parse(right))
}

async fn download(app: &AppHandle, url: &str) -> Result<Vec<u8>, String> {
    let manual_proxy = app
        .try_state::<crate::network::NetworkProxyState>()
        .and_then(|state| state.get());
    let proxy_url = crate::network::resolve_proxy(manual_proxy);
    let builder = reqwest::Client::builder();
    let client = crate::network::apply_proxy_builder(builder, proxy_url.as_deref())
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;
    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "integrator runtime download failed: {}",
            response.status()
        ));
    }
    response
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|e| e.to_string())
}

fn verify_hash(bytes: &[u8], manifest: &IntegratorRuntimeManifest) -> Result<(), String> {
    let expected = manifest
        .md5
        .as_deref()
        .ok_or_else(|| "integrator runtime md5 is required".to_string())?;
    let actual = format!("{:x}", md5::compute(bytes));
    actual
        .eq_ignore_ascii_case(expected.trim())
        .then_some(())
        .ok_or_else(|| format!("md5 mismatch: expected {expected}, got {actual}"))
}

fn verify_signature(manifest: &IntegratorRuntimeManifest) -> Result<(), String> {
    if manifest.signature.as_deref().unwrap_or_default().is_empty() {
        log::warn!("[IntegratorRuntime] unsigned integrator runtime accepted");
        return Ok(());
    }
    if PUBLIC_KEY.is_empty() {
        log::warn!(
            "[IntegratorRuntime] signature is present, but public key is not configured yet"
        );
        return Ok(());
    }
    Ok(())
}

fn cleanup_old_versions(app: &AppHandle, state: &IntegratorRuntimeState) {
    let Ok(root) = versions_dir(app) else {
        return;
    };
    let keep = [
        state.active_version.as_deref(),
        state.previous_version.as_deref(),
    ];
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if keep.iter().any(|version| version == &Some(name)) {
            continue;
        }
        let _ = fs::remove_dir_all(path);
    }
}
