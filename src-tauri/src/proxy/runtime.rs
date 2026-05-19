use std::{
    fs,
    io::{BufRead, BufReader, Cursor, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tauri::{path::BaseDirectory, AppHandle, Emitter, Manager};

const BUNDLED_RUNTIME_VERSION: &str = "bundled";

#[derive(Default)]
pub struct ProxyChildState {
    pub pid: Mutex<Option<u32>>,
    log_watcher_running: AtomicBool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyRuntimeManifest {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartProxyRuntimeOptions {
    #[serde(default = "default_proxy_port")]
    pub port: u16,
    #[serde(default)]
    pub offline: bool,
    #[serde(default = "default_bind")]
    pub bind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ProxyRuntimeState {
    #[serde(default)]
    active_version: Option<String>,
    #[serde(default)]
    previous_version: Option<String>,
    #[serde(default)]
    last_failed_version: Option<String>,
    #[serde(default)]
    running: bool,
    #[serde(default)]
    last_pid: Option<u32>,
    #[serde(default)]
    started_at: Option<u64>,
    #[serde(default)]
    cert_installed: bool,
    #[serde(default)]
    needs_hosts_cleanup: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyRuntimeStatus {
    pub active_version: Option<String>,
    pub previous_version: Option<String>,
    pub last_failed_version: Option<String>,
    pub installed: bool,
    pub running: bool,
    pub pid: Option<u32>,
    pub started_at: Option<u64>,
    pub has_cert_installed: bool,
    pub log_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProxyRuntimeLogEvent {
    line: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProxyRuntimeStateEvent {
    status: ProxyRuntimeStatus,
}

fn default_proxy_port() -> u16 {
    443
}

fn default_bind() -> String {
    "0.0.0.0".to_string()
}

#[tauri::command]
pub async fn install_proxy_runtime_from_manifest(
    app: AppHandle,
    manifest: ProxyRuntimeManifest,
) -> Result<ProxyRuntimeStatus, String> {
    validate_manifest(&manifest)?;
    validate_compatibility(&manifest)?;

    let bytes = download(&app, &manifest.url).await?;
    verify_hash(&bytes, &manifest)?;
    verify_signature(&manifest);

    let version_dir = versions_dir(&app)?.join(&manifest.version);
    fs::create_dir_all(&version_dir).map_err(|e| e.to_string())?;
    let runtime_path = version_dir.join(runtime_file_name());
    install_runtime_payload(&bytes, &runtime_path).map_err(|e| format!("{:#}", e))?;
    make_executable(&runtime_path).map_err(|e| e.to_string())?;

    let mut state = read_state(&app);
    state.previous_version = state.active_version.clone();
    state.active_version = Some(manifest.version);
    state.last_failed_version = None;
    write_state(&app, &state)?;
    cleanup_old_versions(&app, &state);

    let status = status(&app);
    emit_state(&app, &status);
    Ok(status)
}

#[tauri::command]
pub fn get_proxy_runtime_status(app: AppHandle) -> Result<ProxyRuntimeStatus, String> {
    Ok(status(&app))
}

#[tauri::command]
pub async fn start_proxy_runtime(
    app: AppHandle,
    options: StartProxyRuntimeOptions,
) -> Result<ProxyRuntimeStatus, String> {
    let current = status(&app);
    if current.running {
        return Ok(current);
    }

    let runtime =
        active_runtime_path(&app).ok_or_else(|| "proxy runtime is not installed".to_string())?;
    fs::create_dir_all(root(&app)?).map_err(|e| e.to_string())?;
    let log_path = runtime_log_path(&app)?;
    let _ = fs::write(&log_path, "");
    let should_install_cert = should_install_cert_on_start(&app);

    let mut args = common_proxy_args(&app)?;
    args.extend([
        "start".to_string(),
        "--port".to_string(),
        options.port.to_string(),
        "--bind".to_string(),
        options.bind,
        "--log-file".to_string(),
        log_path.to_string_lossy().to_string(),
    ]);
    if options.offline {
        args.push("--offline".to_string());
    }
    if should_install_cert {
        args.push("--install-cert".to_string());
    }

    let pid = run_elevated(&runtime, &args, false)
        .await
        .and_then(|output| {
            parse_pid(&output).ok_or_else(|| "failed to get proxy process id".to_string())
        })?;

    if let Some(state) = app.try_state::<ProxyChildState>() {
        if let Ok(mut guard) = state.pid.lock() {
            *guard = Some(pid);
        }
    }

    let mut state = read_state(&app);
    state.running = true;
    state.last_pid = Some(pid);
    state.started_at = Some(now_unix_seconds());
    state.needs_hosts_cleanup = true;
    if should_install_cert {
        state.cert_installed = true;
    }
    write_state(&app, &state)?;
    start_log_watcher(&app);

    let status = status(&app);
    emit_state(&app, &status);
    Ok(status)
}

#[tauri::command]
pub async fn stop_proxy_runtime(app: AppHandle) -> Result<ProxyRuntimeStatus, String> {
    let state = read_state(&app);
    let pid = running_pid(&app, &state);
    if should_cleanup_hosts(&state) {
        stop_proxy_elevated(&app, pid).await?;
    } else if let Some(pid) = pid {
        terminate_proxy_process(&app, pid).await?;
    }
    mark_stopped(&app)?;
    let status = status(&app);
    emit_state(&app, &status);
    Ok(status)
}

#[tauri::command]
pub async fn install_proxy_cert(app: AppHandle) -> Result<ProxyRuntimeStatus, String> {
    let runtime =
        active_runtime_path(&app).ok_or_else(|| "proxy runtime is not installed".to_string())?;
    let mut args = common_proxy_args(&app)?;
    args.extend(["cert".into(), "install".into()]);
    run_elevated(&runtime, &args, true).await?;
    mark_cert_installed(&app)?;
    let status = status(&app);
    emit_state(&app, &status);
    Ok(status)
}

pub fn shutdown_blocking(app: &AppHandle, timeout: Duration) -> Result<()> {
    let app = app.clone();
    let state = read_state(&app);
    if !should_cleanup_hosts(&state) && running_pid(&app, &state).is_none() {
        return Ok(());
    }

    let (tx, rx) = std::sync::mpsc::channel();
    thread::spawn(move || {
        let result = shutdown_proxy_blocking(&app);
        if result.is_ok() {
            let _ = mark_stopped(&app);
        }
        let _ = tx.send(result);
    });

    match rx.recv_timeout(timeout) {
        Ok(result) => result,
        Err(_) => {
            log::warn!("[ProxyRuntime] timeout while cleaning hosts on shutdown");
            Ok(())
        }
    }
}

pub fn was_running_dirty(app: &AppHandle) -> bool {
    let state = read_state(app);
    state.running || state.needs_hosts_cleanup
}

pub fn sweep_stale_hosts(app: &AppHandle) -> Result<()> {
    let state = read_state(app);
    let pid = running_pid(app, &state);
    if should_cleanup_hosts(&state) {
        stop_proxy_blocking(app, pid)?;
    } else if let Some(pid) = pid {
        terminate_proxy_process_blocking(app, pid)?;
    }
    mark_stopped(app).map_err(anyhow::Error::msg)
}

fn status(app: &AppHandle) -> ProxyRuntimeStatus {
    let state = read_state(app);
    let has_downloaded_runtime = active_downloaded_runtime_path(app).is_some();
    let has_bundled_runtime = bundled_runtime_path(app)
        .map(|path| path.is_file())
        .unwrap_or(false);
    let installed = has_downloaded_runtime || has_bundled_runtime;
    let pid = running_pid(app, &state);
    let running = state.running && pid.is_some();
    let started_at = if running { state.started_at } else { None };
    let active_version = if has_downloaded_runtime {
        state.active_version
    } else if has_bundled_runtime {
        Some(BUNDLED_RUNTIME_VERSION.to_string())
    } else {
        None
    };

    ProxyRuntimeStatus {
        active_version,
        previous_version: state.previous_version,
        last_failed_version: state.last_failed_version,
        installed,
        running,
        pid,
        started_at,
        has_cert_installed: state.cert_installed
            && cert_path(app).map(|path| path.is_file()).unwrap_or(false),
        log_path: runtime_log_path(app)
            .ok()
            .map(|path| path.to_string_lossy().to_string()),
    }
}

fn emit_state(app: &AppHandle, status: &ProxyRuntimeStatus) {
    let _ = app.emit(
        "proxy-runtime-state",
        ProxyRuntimeStateEvent {
            status: status.clone(),
        },
    );
}

fn start_log_watcher(app: &AppHandle) {
    let Some(state) = app.try_state::<ProxyChildState>() else {
        return;
    };
    if state
        .log_watcher_running
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    let app = app.clone();
    thread::spawn(move || {
        let result = watch_log_file(&app);
        if let Some(state) = app.try_state::<ProxyChildState>() {
            state.log_watcher_running.store(false, Ordering::SeqCst);
        }
        if let Err(error) = result {
            log::warn!("[ProxyRuntime] log watcher stopped: {:#}", error);
        }
    });
}

fn watch_log_file(app: &AppHandle) -> Result<()> {
    let log_path = runtime_log_path(app).map_err(anyhow::Error::msg)?;
    let mut position = 0;
    loop {
        if !read_state(app).running {
            return Ok(());
        }

        if let Ok(mut file) = fs::File::open(&log_path) {
            file.seek(SeekFrom::Start(position))?;
            let mut reader = BufReader::new(file);
            let mut line = String::new();
            loop {
                let read = reader.read_line(&mut line)?;
                if read == 0 {
                    break;
                }
                position += read as u64;
                let value = line.trim_end().to_string();
                if !value.is_empty() {
                    let _ = app.emit("proxy-runtime-log", ProxyRuntimeLogEvent { line: value });
                }
                line.clear();
            }
        }
        thread::sleep(Duration::from_millis(500));
    }
}

fn should_install_cert_on_start(app: &AppHandle) -> bool {
    let state = read_state(app);
    !state.cert_installed || !cert_path(app).map(|path| path.is_file()).unwrap_or(false)
}

fn should_cleanup_hosts(state: &ProxyRuntimeState) -> bool {
    state.running || state.needs_hosts_cleanup
}

fn tracked_pid(app: &AppHandle, state: &ProxyRuntimeState) -> Option<u32> {
    state.last_pid.or_else(|| {
        app.try_state::<ProxyChildState>()
            .and_then(|state| state.pid.lock().ok().and_then(|guard| *guard))
    })
}

fn running_pid(app: &AppHandle, state: &ProxyRuntimeState) -> Option<u32> {
    tracked_pid(app, state).filter(|pid| process_exists(*pid))
}

async fn stop_proxy_elevated(app: &AppHandle, pid: Option<u32>) -> Result<(), String> {
    let runtime =
        active_runtime_path(app).ok_or_else(|| "proxy runtime is not installed".to_string())?;
    let mut args = common_proxy_args(app)?;
    args.push("stop".into());
    if let Some(pid) = pid {
        args.extend(["--pid".into(), pid.to_string()]);
    }
    run_elevated(&runtime, &args, true).await.map(|_| ())
}

fn stop_proxy_blocking(app: &AppHandle, pid: Option<u32>) -> Result<()> {
    let runtime = active_runtime_path(app).context("proxy runtime is not installed")?;
    let mut args = common_proxy_args(app).map_err(anyhow::Error::msg)?;
    args.push("stop".into());
    if let Some(pid) = pid {
        args.extend(["--pid".into(), pid.to_string()]);
    }
    run_elevated_blocking(&runtime, &args, true).map(|_| ())
}

async fn terminate_proxy_process(app: &AppHandle, pid: u32) -> Result<(), String> {
    if !process_exists(pid) {
        return Ok(());
    }
    let runtime =
        active_runtime_path(app).ok_or_else(|| "proxy runtime is not installed".to_string())?;
    let mut args = common_proxy_args(app)?;
    args.extend(["kill".into(), "--pid".into(), pid.to_string()]);
    run_elevated(&runtime, &args, true).await.map(|_| ())
}

fn terminate_proxy_process_blocking(app: &AppHandle, pid: u32) -> Result<()> {
    if !process_exists(pid) {
        return Ok(());
    }
    let runtime = active_runtime_path(app).context("proxy runtime is not installed")?;
    let mut args = common_proxy_args(app).map_err(anyhow::Error::msg)?;
    args.extend(["kill".into(), "--pid".into(), pid.to_string()]);
    run_elevated_blocking(&runtime, &args, true).map(|_| ())
}

fn shutdown_proxy_blocking(app: &AppHandle) -> Result<()> {
    let state = read_state(app);
    let pid = running_pid(app, &state);
    if should_cleanup_hosts(&state) {
        stop_proxy_blocking(app, pid)?;
    } else if let Some(pid) = pid {
        terminate_proxy_process_blocking(app, pid)?;
    }
    Ok(())
}

fn mark_cert_installed(app: &AppHandle) -> Result<(), String> {
    let mut state = read_state(app);
    state.cert_installed = true;
    write_state(app, &state)
}

fn mark_stopped(app: &AppHandle) -> Result<(), String> {
    if let Some(state) = app.try_state::<ProxyChildState>() {
        if let Ok(mut guard) = state.pid.lock() {
            *guard = None;
        }
    }
    let mut state = read_state(app);
    state.running = false;
    state.last_pid = None;
    state.started_at = None;
    state.needs_hosts_cleanup = false;
    write_state(app, &state)
}

async fn run_elevated(exe: &Path, args: &[String], wait: bool) -> Result<String, String> {
    let exe = exe.to_path_buf();
    let args = args.to_vec();
    tokio::task::spawn_blocking(move || run_elevated_blocking(&exe, &args, wait))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| format!("{:#}", e))
}

fn run_elevated_blocking(exe: &Path, args: &[String], wait: bool) -> Result<String> {
    #[cfg(target_os = "windows")]
    {
        return run_elevated_windows(exe, args, wait);
    }

    #[cfg(target_os = "macos")]
    {
        let mut command = shell_quote(&exe.to_string_lossy());
        for arg in args {
            command.push(' ');
            command.push_str(&shell_quote(arg));
        }
        if !wait {
            command = format!("nohup {} >/dev/null 2>&1 & echo $!", command);
        }
        let script = format!(
            "do shell script {} with administrator privileges",
            apple_script_quote(&command)
        );
        let output = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .context("failed to launch osascript")?;
        if !output.status.success() {
            anyhow::bail!(
                "osascript failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            );
        }
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = (exe, args, wait);
        anyhow::bail!("mintcat proxy runtime is only supported on Windows and macOS");
    }
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct ShellExecuteInfoW {
    cb_size: u32,
    f_mask: u32,
    hwnd: *mut std::ffi::c_void,
    lp_verb: *const u16,
    lp_file: *const u16,
    lp_parameters: *const u16,
    lp_directory: *const u16,
    n_show: i32,
    h_inst_app: *mut std::ffi::c_void,
    lp_id_list: *mut std::ffi::c_void,
    lp_class: *const u16,
    hkey_class: *mut std::ffi::c_void,
    dw_hot_key: u32,
    h_icon: *mut std::ffi::c_void,
    h_process: *mut std::ffi::c_void,
}

#[cfg(target_os = "windows")]
#[link(name = "shell32")]
extern "system" {
    fn ShellExecuteExW(info: *mut ShellExecuteInfoW) -> i32;
}

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    fn GetProcessId(process: *mut std::ffi::c_void) -> u32;
    fn WaitForSingleObject(handle: *mut std::ffi::c_void, milliseconds: u32) -> u32;
    fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
}

#[cfg(target_os = "windows")]
fn run_elevated_windows(exe: &Path, args: &[String], wait: bool) -> Result<String> {
    use std::{ffi::OsStr, os::windows::ffi::OsStrExt, ptr};

    const SEE_MASK_NOCLOSEPROCESS: u32 = 0x00000040;
    const SW_HIDE: i32 = 0;
    const INFINITE: u32 = 0xFFFF_FFFF;

    fn wide_null(value: &OsStr) -> Vec<u16> {
        value.encode_wide().chain(std::iter::once(0)).collect()
    }

    let verb = wide_null(OsStr::new("runas"));
    let file = wide_null(exe.as_os_str());
    let parameters = windows_quote_args(args);
    let parameters = wide_null(OsStr::new(&parameters));
    let mut info = ShellExecuteInfoW {
        cb_size: std::mem::size_of::<ShellExecuteInfoW>() as u32,
        f_mask: SEE_MASK_NOCLOSEPROCESS,
        hwnd: ptr::null_mut(),
        lp_verb: verb.as_ptr(),
        lp_file: file.as_ptr(),
        lp_parameters: parameters.as_ptr(),
        lp_directory: ptr::null(),
        n_show: SW_HIDE,
        h_inst_app: ptr::null_mut(),
        lp_id_list: ptr::null_mut(),
        lp_class: ptr::null(),
        hkey_class: ptr::null_mut(),
        dw_hot_key: 0,
        h_icon: ptr::null_mut(),
        h_process: ptr::null_mut(),
    };

    let launched = unsafe { ShellExecuteExW(&mut info) };
    if launched == 0 {
        anyhow::bail!(
            "failed to launch elevated proxy runtime: {}",
            std::io::Error::last_os_error()
        );
    }
    if info.h_process.is_null() {
        return Ok(String::new());
    }

    let pid = unsafe { GetProcessId(info.h_process) };
    if wait {
        unsafe {
            WaitForSingleObject(info.h_process, INFINITE);
            CloseHandle(info.h_process);
        }
        return Ok(String::new());
    }

    unsafe {
        CloseHandle(info.h_process);
    }
    Ok(pid.to_string())
}

#[cfg(target_os = "windows")]
fn windows_quote_args(args: &[String]) -> String {
    args.iter()
        .map(|arg| windows_quote_arg(arg))
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(target_os = "windows")]
fn windows_quote_arg(arg: &str) -> String {
    if !arg.is_empty()
        && !arg
            .chars()
            .any(|ch| ch.is_whitespace() || ch == '"' || ch == '\\')
    {
        return arg.to_string();
    }

    let mut quoted = String::from("\"");
    let mut backslashes = 0;
    for ch in arg.chars() {
        match ch {
            '\\' => backslashes += 1,
            '"' => {
                quoted.push_str(&"\\".repeat(backslashes * 2 + 1));
                quoted.push('"');
                backslashes = 0;
            }
            _ => {
                quoted.push_str(&"\\".repeat(backslashes));
                backslashes = 0;
                quoted.push(ch);
            }
        }
    }
    quoted.push_str(&"\\".repeat(backslashes * 2));
    quoted.push('"');
    quoted
}

fn parse_pid(output: &str) -> Option<u32> {
    output
        .split_whitespace()
        .find_map(|part| part.trim().parse::<u32>().ok())
}

fn process_exists(pid: u32) -> bool {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid)])
            .output();
        return output
            .map(|output| String::from_utf8_lossy(&output.stdout).contains(&pid.to_string()))
            .unwrap_or(false);
    }

    #[cfg(target_os = "macos")]
    {
        let output = Command::new("ps")
            .args(["-p", &pid.to_string(), "-o", "pid="])
            .output();
        return output
            .map(|output| {
                output.status.success()
                    && String::from_utf8_lossy(&output.stdout)
                        .split_whitespace()
                        .any(|value| value == pid.to_string())
            })
            .unwrap_or(false);
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = pid;
        false
    }
}

fn runtime_file_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "mintcat-proxy.exe"
    }
    #[cfg(not(target_os = "windows"))]
    {
        "mintcat-proxy"
    }
}

fn active_runtime_path(app: &AppHandle) -> Option<PathBuf> {
    active_downloaded_runtime_path(app)
        .or_else(|| bundled_runtime_path(app).ok().filter(|path| path.is_file()))
}

fn active_downloaded_runtime_path(app: &AppHandle) -> Option<PathBuf> {
    let version = read_state(app).active_version?;
    if version == BUNDLED_RUNTIME_VERSION {
        return None;
    }
    valid_version(&version).ok()?;
    let path = versions_dir(app)
        .ok()?
        .join(version)
        .join(runtime_file_name());
    path.is_file().then_some(path)
}

fn bundled_runtime_path(app: &AppHandle) -> Result<PathBuf> {
    let resource_path = app
        .path()
        .resolve(
            format!("plugins/proxy/{}", runtime_file_name()),
            BaseDirectory::Resource,
        )
        .context("failed to resolve bundled proxy runtime")?;
    if resource_path.is_file() {
        return Ok(resource_path);
    }

    #[cfg(debug_assertions)]
    if let Some(dev_path) = dev_runtime_candidates()
        .into_iter()
        .find(|path| path.is_file())
    {
        log::info!("[ProxyRuntime] using local dev runtime: {:?}", dev_path);
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
    let runtime_name = runtime_file_name();

    vec![
        manifest_dir
            .join("assets")
            .join("plugins")
            .join("proxy")
            .join(runtime_name),
        target_dir.join("release").join(runtime_name),
        target_dir.join("debug").join(runtime_name),
    ]
}

fn root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("plugins").join("proxy"))
        .map_err(|e| e.to_string())
}

fn versions_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(root(app)?.join("versions"))
}

fn state_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(root(app)?.join("state.json"))
}

fn runtime_log_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(root(app)?.join("runtime.log"))
}

fn cert_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(proxy_data_dir(app)?.join("ca.pem"))
}

fn proxy_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(root(app)?.join("data"))
}

fn common_proxy_args(app: &AppHandle) -> Result<Vec<String>, String> {
    fs::create_dir_all(proxy_data_dir(app)?).map_err(|e| e.to_string())?;
    Ok(vec![
        "--data-dir".to_string(),
        proxy_data_dir(app)?.to_string_lossy().to_string(),
    ])
}

fn read_state(app: &AppHandle) -> ProxyRuntimeState {
    state_file(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|value| serde_json::from_str(&value).ok())
        .unwrap_or_default()
}

fn write_state(app: &AppHandle, state: &ProxyRuntimeState) -> Result<(), String> {
    fs::create_dir_all(root(app)?).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(state_file(app)?, json).map_err(|e| e.to_string())
}

fn valid_version(version: &str) -> Result<(), String> {
    if version.is_empty()
        || version.contains("..")
        || version.contains('/')
        || version.contains('\\')
        || version.chars().any(|c| c.is_control())
    {
        Err("invalid proxy runtime version".into())
    } else {
        Ok(())
    }
}

fn validate_manifest(manifest: &ProxyRuntimeManifest) -> Result<(), String> {
    valid_version(&manifest.version)?;
    if manifest.url.trim().is_empty() {
        return Err("proxy runtime url is required".into());
    }
    if manifest
        .md5
        .as_deref()
        .unwrap_or_default()
        .trim()
        .is_empty()
    {
        return Err("proxy runtime md5 is required".into());
    }
    Ok(())
}

fn validate_compatibility(manifest: &ProxyRuntimeManifest) -> Result<(), String> {
    let app_version = env!("CARGO_PKG_VERSION");
    if let Some(min) = &manifest.min_app_version {
        if cmp_version(app_version, min).is_lt() {
            return Err(format!("proxy runtime requires app >= {min}"));
        }
    }
    if let Some(max) = &manifest.max_app_version {
        if cmp_version(app_version, max).is_gt() {
            return Err(format!("proxy runtime requires app <= {max}"));
        }
    }
    Ok(())
}

fn install_runtime_payload(bytes: &[u8], runtime_path: &Path) -> Result<()> {
    if is_zip_payload(bytes) {
        extract_runtime_from_zip(bytes, runtime_path)?;
        return Ok(());
    }
    fs::write(runtime_path, bytes)?;
    Ok(())
}

fn is_zip_payload(bytes: &[u8]) -> bool {
    bytes.starts_with(b"PK\x03\x04")
        || bytes.starts_with(b"PK\x05\x06")
        || bytes.starts_with(b"PK\x07\x08")
}

fn extract_runtime_from_zip(bytes: &[u8], runtime_path: &Path) -> Result<()> {
    let mut archive =
        zip::ZipArchive::new(Cursor::new(bytes)).context("invalid proxy runtime zip")?;
    let Some(index) = find_runtime_zip_entry(&mut archive) else {
        anyhow::bail!("proxy runtime executable not found in zip");
    };
    let mut file = archive
        .by_index(index)
        .context("failed to read proxy runtime from zip")?;
    let mut executable = Vec::new();
    file.read_to_end(&mut executable)
        .context("failed to extract proxy runtime from zip")?;
    fs::write(runtime_path, executable).context("failed to write proxy runtime executable")?;
    Ok(())
}

fn find_runtime_zip_entry<R: Read + Seek>(archive: &mut zip::ZipArchive<R>) -> Option<usize> {
    let expected = runtime_file_name();
    let mut fallback = None;
    for index in 0..archive.len() {
        let Ok(file) = archive.by_index(index) else {
            continue;
        };
        if file.is_dir() {
            continue;
        }
        let Some(path) = file.enclosed_name() else {
            continue;
        };
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if name.eq_ignore_ascii_case(expected) {
            return Some(index);
        }
        if fallback.is_none() && looks_like_runtime_file(name) {
            fallback = Some(index);
        }
    }
    fallback
}

fn looks_like_runtime_file(name: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        name.to_ascii_lowercase().ends_with(".exe")
    }
    #[cfg(not(target_os = "windows"))]
    {
        let normalized = name.to_ascii_lowercase();
        normalized == "mintcat-proxy" || normalized.starts_with("mintcat_proxy")
    }
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
            "proxy runtime download failed: {}",
            response.status()
        ));
    }
    response
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|e| e.to_string())
}

fn verify_hash(bytes: &[u8], manifest: &ProxyRuntimeManifest) -> Result<(), String> {
    let expected = manifest
        .md5
        .as_deref()
        .ok_or_else(|| "proxy runtime md5 is required".to_string())?;
    let actual = format!("{:x}", md5::compute(bytes));
    actual
        .eq_ignore_ascii_case(expected.trim())
        .then_some(())
        .ok_or_else(|| format!("md5 mismatch: expected {expected}, got {actual}"))
}

fn verify_signature(manifest: &ProxyRuntimeManifest) {
    if manifest.signature.as_deref().unwrap_or_default().is_empty() {
        log::warn!("[ProxyRuntime] unsigned proxy runtime accepted");
    }
}

fn cleanup_old_versions(app: &AppHandle, state: &ProxyRuntimeState) {
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

fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or_default()
}

#[cfg(unix)]
fn make_executable(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let mut permissions = fs::metadata(path)?.permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions)?;
    Ok(())
}

#[cfg(not(unix))]
fn make_executable(_path: &Path) -> Result<()> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

#[cfg(target_os = "macos")]
fn apple_script_quote(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}
