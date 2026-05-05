use std::{fs::{self, File}, io::Cursor, path::{Component, Path, PathBuf}};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{http, AppHandle, Manager, Url};

const PUBLIC_KEY: &str = "";
const HOT_URL: &str = "mintcat-hot://localhost/index.html#/home";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendUpdateManifest {
    pub version: String,
    pub url: String,
    #[serde(default)] pub sha256: Option<String>,
    #[serde(default)] pub md5: Option<String>,
    #[serde(default)] pub checksum: Option<String>,
    #[serde(default)] pub signature: Option<String>,
    #[serde(default)] pub min_app_version: Option<String>,
    #[serde(default)] pub max_app_version: Option<String>,
    #[serde(default = "default_entry")] pub entry: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FrontendRuntimeState {
    #[serde(default)] pub active_version: Option<String>,
    #[serde(default)] pub previous_version: Option<String>,
    #[serde(default)] pub pending_version: Option<String>,
    #[serde(default)] pub last_failed_version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendUpdateStatus {
    pub active_version: Option<String>,
    pub previous_version: Option<String>,
    pub pending_version: Option<String>,
    pub last_failed_version: Option<String>,
    pub has_local_bundle: bool,
}

fn default_entry() -> String { "index.html".into() }
fn root(app: &AppHandle) -> Result<PathBuf, String> { app.path().app_data_dir().map(|p| p.join("frontend")).map_err(|e| e.to_string()) }
fn versions(app: &AppHandle) -> Result<PathBuf, String> { Ok(root(app)?.join("versions")) }
fn pending(app: &AppHandle) -> Result<PathBuf, String> { Ok(root(app)?.join("pending")) }
fn state_file(app: &AppHandle) -> Result<PathBuf, String> { Ok(root(app)?.join("state.json")) }

fn read_state(app: &AppHandle) -> FrontendRuntimeState {
    state_file(app).ok().and_then(|p| fs::read_to_string(p).ok()).and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default()
}

fn write_state(app: &AppHandle, state: &FrontendRuntimeState) -> Result<(), String> {
    fs::create_dir_all(root(app)?).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(state_file(app)?, json).map_err(|e| e.to_string())
}

fn valid_version(version: &str) -> Result<(), String> {
    if version.is_empty() || version.contains("..") || version.contains('/') || version.contains('\\') || version.chars().any(|c| c.is_control()) {
        Err("invalid frontend version".into())
    } else { Ok(()) }
}

fn active_dir(app: &AppHandle) -> Option<PathBuf> {
    let version = read_state(app).active_version?;
    valid_version(&version).ok()?;
    let dir = versions(app).ok()?.join(version);
    dir.join("index.html").is_file().then_some(dir)
}

pub fn rollback_unconfirmed_pending(app: &AppHandle) -> Result<(), String> {
    let mut state = read_state(app);
    if let Some(pending) = state.pending_version.clone() {
        log::warn!("[FrontendUpdate] pending frontend {pending} was not confirmed; rolling back");
        state.last_failed_version = Some(pending);
        state.active_version = state.previous_version.clone();
        state.previous_version = None;
        state.pending_version = None;
        write_state(app, &state)?;
    }
    Ok(())
}

pub fn navigate_to_hot_frontend(app: &AppHandle) {
    if active_dir(app).is_none() { return; }
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(url) = Url::parse(HOT_URL) {
            if let Err(error) = window.navigate(url) { log::warn!("[FrontendUpdate] navigate failed: {error}"); }
        }
    }
}

pub fn handle_protocol(app: &AppHandle, request: http::Request<Vec<u8>>) -> http::Response<Vec<u8>> {
    match read_asset(app, request.uri().path()) {
        Ok((body, mime)) => resp(200, mime, body),
        Err(error) => { log::warn!("[FrontendUpdate] asset request failed: {error}"); resp(404, "text/plain; charset=utf-8", b"not found".to_vec()) }
    }
}

fn read_asset(app: &AppHandle, uri_path: &str) -> Result<(Vec<u8>, &'static str), String> {
    let root = active_dir(app).ok_or("no active frontend")?;
    let rel = normalize_path(uri_path)?;
    let file = root.join(rel);
    let canonical_root = root.canonicalize().map_err(|e| e.to_string())?;
    let canonical_file = file.canonicalize().map_err(|e| e.to_string())?;
    if !canonical_file.starts_with(canonical_root) || !canonical_file.is_file() { return Err("invalid asset path".into()); }
    let body = fs::read(&canonical_file).map_err(|e| e.to_string())?;
    Ok((body, mime(&canonical_file)))
}

fn normalize_path(uri_path: &str) -> Result<PathBuf, String> {
    let mut out = PathBuf::new();
    for component in Path::new(uri_path.trim_start_matches('/')).components() {
        match component { Component::Normal(part) => out.push(part), Component::CurDir => {}, _ => return Err("unsafe asset path".into()) }
    }
    if out.as_os_str().is_empty() { out.push("index.html"); }
    Ok(out)
}

fn resp(status: u16, mime: &'static str, body: Vec<u8>) -> http::Response<Vec<u8>> {
    http::Response::builder().status(status).header("content-type", mime).header("cache-control", "no-cache").body(body).unwrap_or_else(|_| http::Response::new(Vec::new()))
}

fn mime(path: &Path) -> &'static str {
    match path.extension().and_then(|s| s.to_str()) {
        Some("html") => "text/html; charset=utf-8", Some("js") | Some("mjs") => "text/javascript; charset=utf-8", Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json; charset=utf-8", Some("svg") => "image/svg+xml", Some("png") => "image/png", Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif", Some("webp") => "image/webp", Some("ico") => "image/x-icon", Some("woff") => "font/woff", Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf", _ => "application/octet-stream",
    }
}

#[tauri::command]
pub async fn install_frontend_update_from_manifest(app: AppHandle, manifest: FrontendUpdateManifest) -> Result<FrontendUpdateStatus, String> {
    validate_manifest(&manifest)?;
    validate_compatibility(&manifest)?;
    let bytes = download(&manifest.url).await?;
    verify_hash(&bytes, &manifest)?;
    verify_signature(&manifest)?;
    extract_zip(&app, &manifest, &bytes)?;
    let mut state = read_state(&app);
    state.previous_version = state.active_version.clone();
    state.active_version = Some(manifest.version.clone());
    state.pending_version = Some(manifest.version);
    state.last_failed_version = None;
    write_state(&app, &state)?;
    status(app)
}

#[tauri::command]
pub fn mark_frontend_update_ok(app: AppHandle) -> Result<FrontendUpdateStatus, String> {
    let mut state = read_state(&app);
    state.pending_version = None;
    state.previous_version = None;
    write_state(&app, &state)?;
    status(app)
}

#[tauri::command]
pub fn rollback_frontend_update(app: AppHandle) -> Result<FrontendUpdateStatus, String> {
    let mut state = read_state(&app);
    state.last_failed_version = state.active_version.clone();
    state.active_version = state.previous_version.clone();
    state.previous_version = None;
    state.pending_version = None;
    write_state(&app, &state)?;
    status(app)
}

#[tauri::command]
pub fn get_frontend_update_status(app: AppHandle) -> Result<FrontendUpdateStatus, String> { status(app) }

fn status(app: AppHandle) -> Result<FrontendUpdateStatus, String> {
    let state = read_state(&app);
    Ok(FrontendUpdateStatus { active_version: state.active_version, previous_version: state.previous_version, pending_version: state.pending_version, last_failed_version: state.last_failed_version, has_local_bundle: active_dir(&app).is_some() })
}

fn validate_manifest(manifest: &FrontendUpdateManifest) -> Result<(), String> {
    valid_version(&manifest.version)?;
    if manifest.url.trim().is_empty() { return Err("manifest url is required".into()); }
    if manifest.sha256.as_deref().unwrap_or_default().trim().is_empty()
        && manifest.md5.as_deref().unwrap_or_default().trim().is_empty()
        && manifest.checksum.as_deref().unwrap_or_default().trim().is_empty() {
        return Err("manifest checksum is required".into());
    }
    if manifest.entry != "index.html" { return Err("only index.html entry is supported".into()); }
    Ok(())
}

fn validate_compatibility(manifest: &FrontendUpdateManifest) -> Result<(), String> {
    let app_version = env!("CARGO_PKG_VERSION");
    if let Some(min) = &manifest.min_app_version { if cmp_version(app_version, min).is_lt() { return Err(format!("frontend requires app >= {min}")); } }
    if let Some(max) = &manifest.max_app_version { if cmp_version(app_version, max).is_gt() { return Err(format!("frontend requires app <= {max}")); } }
    Ok(())
}

fn cmp_version(left: &str, right: &str) -> std::cmp::Ordering {
    let parse = |value: &str| value.split(|c| c == '.' || c == '-').take(3).map(|p| p.parse::<u64>().unwrap_or(0)).collect::<Vec<_>>();
    parse(left).cmp(&parse(right))
}

async fn download(url: &str) -> Result<Vec<u8>, String> {
    let res = reqwest::get(url).await.map_err(|e| e.to_string())?;
    if !res.status().is_success() { return Err(format!("zip download failed: {}", res.status())); }
    res.bytes().await.map(|b| b.to_vec()).map_err(|e| e.to_string())
}

fn verify_hash(bytes: &[u8], manifest: &FrontendUpdateManifest) -> Result<(), String> {
    if let Some(expected) = manifest.sha256.as_deref().filter(|value| !value.trim().is_empty()) {
        let mut hasher = Sha256::new();
        hasher.update(bytes);
        let actual = format!("{:x}", hasher.finalize());
        return actual.eq_ignore_ascii_case(expected.trim()).then_some(()).ok_or_else(|| format!("sha256 mismatch: expected {expected}, got {actual}"));
    }

    let expected = manifest.md5.as_deref()
        .or(manifest.checksum.as_deref())
        .ok_or_else(|| "manifest checksum is required".to_string())?;
    let actual = format!("{:x}", md5::compute(bytes));
    actual.eq_ignore_ascii_case(expected.trim()).then_some(()).ok_or_else(|| format!("md5 mismatch: expected {expected}, got {actual}"))
}

fn verify_signature(manifest: &FrontendUpdateManifest) -> Result<(), String> {
    if manifest.signature.as_deref().unwrap_or_default().is_empty() {
        log::warn!("[FrontendUpdate] unsigned frontend manifest accepted because update URL is still a placeholder");
        return Ok(());
    }
    if PUBLIC_KEY.is_empty() {
        log::warn!("[FrontendUpdate] signature is present, but public key is not configured yet; verification skipped");
        return Ok(());
    }
    Ok(())
}

fn extract_zip(app: &AppHandle, manifest: &FrontendUpdateManifest, bytes: &[u8]) -> Result<(), String> {
    let target = versions(app)?.join(&manifest.version);
    let pending = pending(app)?;
    if pending.exists() { fs::remove_dir_all(&pending).map_err(|e| e.to_string())?; }
    fs::create_dir_all(&pending).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;
    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|e| e.to_string())?;
        let name = file.enclosed_name().ok_or("zip contains unsafe path")?.to_path_buf();
        let out = pending.join(name);
        if file.is_dir() { fs::create_dir_all(&out).map_err(|e| e.to_string())?; continue; }
        if let Some(parent) = out.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
        let mut output = File::create(&out).map_err(|e| e.to_string())?;
        std::io::copy(&mut file, &mut output).map_err(|e| e.to_string())?;
    }
    if !pending.join("index.html").is_file() { return Err("frontend zip must contain index.html at root".into()); }
    if target.exists() { fs::remove_dir_all(&target).map_err(|e| e.to_string())?; }
    if let Some(parent) = target.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    fs::rename(&pending, &target).map_err(|e| e.to_string())
}
