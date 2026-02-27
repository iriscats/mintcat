use crate::capability::zip::extract_zip_to_directory;
use crate::integrator::ReadSeek;
use anyhow::{Context, Result};
use serde_json::json;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use zip::read::ZipArchive;

const DOTNET_RUNTIME_URL: &str =
    "https://builds.dotnet.microsoft.com/dotnet/Runtime/10.0.1/dotnet-runtime-10.0.1-win-x64.zip";

/// Maximum number of retry attempts for downloading
const MAX_DOWNLOAD_RETRIES: u32 = 3;

/// Download timeout in seconds (5 minutes for large files)
const DOWNLOAD_TIMEOUT_SECS: u64 = 300;

/// Connect timeout in seconds
const CONNECT_TIMEOUT_SECS: u64 = 30;

fn sanitize_dir_name(input: &str) -> String {
    let mut s: String = input
        .chars()
        .map(|c| {
            if c.is_control()
                || std::path::is_separator(c)
                || matches!(c, ':' | '*' | '?' | '"' | '<' | '>' | '|')
            {
                '_'
            } else {
                c
            }
        })
        .collect();

    s = s.trim().trim_matches('.').to_string();
    if s.is_empty() {
        s = "mod".to_string();
    }

    let base = s.split('.').next().unwrap_or(&s);
    let base_upper = base.to_ascii_uppercase();
    let is_reserved = matches!(base_upper.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || base_upper
            .strip_prefix("COM")
            .and_then(|n| n.parse::<u8>().ok())
            .is_some_and(|n| (1..=9).contains(&n))
        || base_upper
            .strip_prefix("LPT")
            .and_then(|n| n.parse::<u8>().ok())
            .is_some_and(|n| (1..=9).contains(&n));

    if is_reserved {
        format!("_{}", s)
    } else {
        s
    }
}

/// Install UE4SSL by extracting the entire zip to the game directory.
/// Preserves the archive's directory structure. Ensures ue4ss/mods exists for mod loading.
pub fn install_ue4ss(install_path: &PathBuf, ue4ss_zip_path: Option<&Path>) -> Result<()> {
    let zip_path = ue4ss_zip_path
        .ok_or_else(|| anyhow::anyhow!("UE4SSL asset zip path is required (UE4SSL.zip)"))?;

    let install_path_str = install_path
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Invalid install path"))?;
    let zip_path_str = zip_path
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Invalid zip path"))?;

    log::info!("Installing UE4SS: extracting zip to {:?}", install_path);

    extract_zip_to_directory(zip_path_str, install_path_str).map_err(|e| {
        anyhow::anyhow!("Failed to extract UE4SSL zip to game directory: {}", e)
    })?;

    // Ensure ue4ss/mods exists for install_ue4ss_mod and mod loading
    let mods_path = install_path.join("ue4ss").join("mods");
    if !mods_path.exists() {
        fs::create_dir_all(&mods_path)
            .with_context(|| format!("Failed to create ue4ss mods directory: {:?}", mods_path))?;
    }

    Ok(())
}

/// Returns true if the zip contains a JS script mod (e.g. path ending with `js/main.js`).
pub fn zip_contains_js_mod(path: &Path) -> bool {
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let mut archive = match ZipArchive::new(file) {
        Ok(a) => a,
        Err(_) => return false,
    };
    for i in 0..archive.len() {
        let entry = match archive.by_index(i) {
            Ok(e) => e,
            Err(_) => continue,
        };
        let name = entry.name().replace('\\', "/").to_lowercase();
        if name.ends_with("js/main.js") {
            return true;
        }
    }
    false
}

/// Install a JS script mod by extracting the zip to ue4ss/mods/.
/// The zip may have a top-level folder (e.g. mymod/js/main.js); structure is preserved.
pub fn install_ue4ss_js_mod(install_path: &PathBuf, zip_path: &Path) -> Result<()> {
    let mods_dir = install_path.join("ue4ss").join("mods");
    if !mods_dir.exists() {
        fs::create_dir_all(&mods_dir)
            .with_context(|| format!("Failed to create ue4ss mods directory: {:?}", mods_dir))?;
    }
    let mods_dir_str = mods_dir
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Invalid ue4ss mods path"))?;
    let zip_path_str = zip_path
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Invalid zip path"))?;
    log::info!(
        "Installing UE4SS JS mod: extracting {:?} to {:?}",
        zip_path,
        mods_dir
    );
    extract_zip_to_directory(zip_path_str, mods_dir_str).map_err(|e| {
        anyhow::anyhow!("Failed to extract JS mod zip to ue4ss/mods: {}", e)
    })?;
    Ok(())
}

pub fn install_ue4ss_mod(
    install_path: &PathBuf,
    mod_name: &String,
    mod_data: &mut Box<dyn ReadSeek>,
) -> Result<()> {
    let mods_home_path = install_path.join("ue4ss").join("mods");

    let sanitized_mod_name = sanitize_dir_name(mod_name);
    let mod_path = mods_home_path.join(&sanitized_mod_name);

    if !mod_path.exists() {
        fs::create_dir(&mod_path)
            .with_context(|| format!("Failed to create mod directory {:?}", mod_path))?;
    }

    let dll_path = mod_path.join("main.dll");
    let mut content = Vec::new();
    mod_data
        .read_to_end(&mut content)
        .context("Failed to read mod data")?;

    let temp_path = dll_path.with_extension("dll.tmp");
    {
        let mut file =
            fs::File::create(&temp_path).context("Failed to create temp file for mod")?;
        file.write_all(&content)
            .context("Failed to write mod content")?;
        file.flush().context("Failed to flush mod file")?;
    }

    if dll_path.exists() {
        let _ = fs::remove_file(&dll_path);
    }
    fs::rename(&temp_path, &dll_path).context("Failed to rename mod file")?;

    Ok(())
}

pub fn uninstall_ue4ss(install_path: &PathBuf) -> Result<()> {
    let ue4ss_path = install_path.join("ue4ss");
    if ue4ss_path.exists() {
        fs::remove_dir_all(&ue4ss_path).context("Failed to remove ue4ss directory")?;
    }

    //try to delete other ue4ss file
    let ue4ss_dll = install_path.join("UE4SS.dll");
    if ue4ss_dll.exists() {
        fs::remove_file(&ue4ss_dll).context("Failed to remove UE4SS.dll")?;
    }

    let proxy_dll = install_path.join("dwmapi.dll");
    if proxy_dll.exists() {
        fs::remove_file(&proxy_dll).context("Failed to remove dwmapi.dll")?;
    }

    let ue4ss_mods = install_path.join("mods");
    if ue4ss_mods.exists() {
        fs::remove_dir_all(&ue4ss_mods).context("Failed to remove mods directory")?;
    }

    Ok(())
}

/// Validates that a file is a valid ZIP archive by checking if it can be opened.
fn is_valid_zip(path: &PathBuf) -> bool {
    match File::open(path) {
        Ok(file) => ZipArchive::new(file).is_ok(),
        Err(_) => false,
    }
}


/// Downloads the .NET runtime ZIP file from a single URL attempt.
fn try_download_dotnet_runtime(
    app: &AppHandle,
    url: &str,
    dest_path: &PathBuf,
) -> Result<()> {
    let download_url = url.to_string();

    app.emit("status-bar-log", "backend.dotnet.downloading").unwrap();

    log::info!("Downloading .NET runtime from: {}", download_url);

    let manual_proxy = app
        .try_state::<crate::capability::network::NetworkProxyState>()
        .and_then(|s| s.get());
    let proxy_url = crate::capability::network::resolve_proxy(manual_proxy);

    let builder = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(DOWNLOAD_TIMEOUT_SECS))
        .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS));
    let builder = crate::capability::network::apply_proxy_blocking_builder(
        builder,
        proxy_url.as_deref(),
    )
    .context("Failed to apply proxy to HTTP client")?;
    let client = builder.build().context("Failed to create HTTP client")?;

    let mut response = client
        .get(&download_url)
        .send()
        .context("Failed to send download request")?;

    if !response.status().is_success() {
        anyhow::bail!("HTTP error: {}", response.status());
    }

    let total_size = response.content_length().unwrap_or(0);

    // Download to a temp file first, then rename on success
    let temp_path = dest_path.with_extension("zip.tmp");
    let mut file = File::create(&temp_path).context("Failed to create temp download file")?;
    let mut downloaded: u64 = 0;
    let mut buffer = [0u8; 1024 * 1024]; // 1MB buffer

    // 让前端进度条可见：一开始就发 0
    app.emit("status-bar-percent", 0i32).unwrap();

    // 当服务器不返回 Content-Length 时，用“已下载量”推算伪进度，避免进度条一直不动
    const UNKNOWN_TOTAL_MB: u64 = 15; // 约 15MB 时显示到 95%
    let mut last_emitted_pseudo = 0u64;

    loop {
        let bytes_read = response
            .read(&mut buffer)
            .context("Failed to read download stream")?;
        if bytes_read == 0 {
            break;
        }

        file.write_all(&buffer[..bytes_read])
            .context("Failed to write download data")?;
        downloaded += bytes_read as u64;

        if total_size > 0 {
            let percent = (downloaded as f64 / total_size as f64 * 100.0) as i32;
            app.emit("status-bar-percent", percent).unwrap();
        } else {
            // 无 Content-Length：按已下载量显示伪进度，每约 1MB 更新一次
            let mb = downloaded / (1024 * 1024);
            if mb > last_emitted_pseudo {
                last_emitted_pseudo = mb;
                let percent = ((downloaded as f64 / (UNKNOWN_TOTAL_MB * 1024 * 1024) as f64) * 95.0)
                    .min(95.0) as i32;
                app.emit("status-bar-percent", percent).unwrap();
            }
        }
    }

    // 下载结束，进度条到 100%
    app.emit("status-bar-percent", 100i32).unwrap();

    // Ensure all data is flushed to disk
    file.flush().context("Failed to flush download file")?;
    file.sync_all()
        .context("Failed to sync download file to disk")?;
    drop(file);

    // Validate the downloaded file is a valid ZIP
    if !is_valid_zip(&temp_path) {
        let _ = fs::remove_file(&temp_path);
        anyhow::bail!("Downloaded file is not a valid ZIP archive");
    }

    // Rename temp file to final destination
    if dest_path.exists() {
        fs::remove_file(dest_path).context("Failed to remove existing download file")?;
    }
    fs::rename(&temp_path, dest_path).context("Failed to rename download file")?;

    Ok(())
}

/// Downloads the .NET runtime ZIP file to the specified path with retry and proxy fallback.
fn download_dotnet_runtime(app: &AppHandle, dest_path: &PathBuf) -> Result<()> {
    let mut last_error: Option<anyhow::Error> = None;
    let mut use_proxy = false;

    for attempt in 0..MAX_DOWNLOAD_RETRIES {
        if attempt > 0 {
            // Wait before retry with exponential backoff
            let delay_secs = 2u64.pow(attempt);
            log::info!(
                "Retry attempt {} after {} seconds delay...",
                attempt + 1,
                delay_secs
            );
            app.emit(
                "status-bar-log",
                json!({ "key": "backend.dotnet.retrying", "seconds": delay_secs }),
            )
            .unwrap();
            std::thread::sleep(Duration::from_secs(delay_secs));
        }

        match try_download_dotnet_runtime(app, DOTNET_RUNTIME_URL, dest_path) {
            Ok(_) => {
                log::info!(".NET runtime downloaded successfully");
                return Ok(());
            }
            Err(e) => {
                log::warn!("Download attempt {} failed: {}", attempt + 1, e);
                last_error = Some(e);

                // Switch to proxy on first failure
                if !use_proxy {
                    log::info!("Switching to v1st proxy for next attempt");
                    app.emit("status-bar-log", "backend.dotnet.switching_proxy").unwrap();
                    use_proxy = true;
                }
            }
        }
    }

    // All retries failed
    Err(last_error.unwrap_or_else(|| anyhow::anyhow!("Download failed after all retries")))
}

/// Downloads and extracts the .NET runtime to the UE4SS/dotnet directory.
/// Skips if runtime is already installed (checks for dotnet directory).
/// Automatically retries download if cached file is corrupted.
pub fn install_dotnet_runtime(app: &AppHandle, install_path: &PathBuf) -> Result<bool> {
    let ue4ss_path = install_path.join("ue4ss");
    let dotnet_path = ue4ss_path.join("dotnet");

    // Check if runtime already exists
    let dotnet_check_path = dotnet_path.join("shared").join("Microsoft.NETCore.App");
    if dotnet_check_path.exists() {
        app.emit("status-bar-log", "backend.dotnet.already_installed")
            .unwrap();
        return Ok(true);
    }

    // Ensure ue4ss/dotnet directory exists
    if !dotnet_path.exists() {
        fs::create_dir_all(&dotnet_path).context("Failed to create dotnet directory")?;
    }

    // Get app cache directory for storing the downloaded ZIP
    let cache_dir = app
        .path()
        .app_cache_dir()
        .context("Failed to get app cache directory")?;
    if !cache_dir.exists() {
        fs::create_dir_all(&cache_dir).context("Failed to create cache directory")?;
    }

    let zip_path = cache_dir.join("dotnet-runtime-10.0.1-win-x64.zip");
    let zip_path_str = zip_path.to_str().unwrap().to_string();

    // Check if we need to download (file doesn't exist or is invalid)
    let need_download = if zip_path.exists() {
        if is_valid_zip(&zip_path) {
            app.emit("status-bar-log", "backend.dotnet.using_cached")
                .unwrap();
            false
        } else {
            // Cached file is corrupted, delete and re-download
            app.emit("status-bar-log", "backend.dotnet.cached_corrupted")
                .unwrap();
            let _ = fs::remove_file(&zip_path);
            true
        }
    } else {
        true
    };

    if need_download {
        download_dotnet_runtime(app, &zip_path)?;
    }

    app.emit("status-bar-log", "backend.dotnet.extracting")
        .unwrap();

    // Try to extract, if it fails due to corrupted file, retry download once
    if extract_zip_to_directory(&zip_path_str, dotnet_path.to_str().unwrap()).is_err() {
        app.emit("status-bar-log", "backend.dotnet.extraction_retry")
            .unwrap();

        // Delete corrupted file and clean up partial extraction
        let _ = fs::remove_file(&zip_path);
        if dotnet_path.exists() {
            let _ = fs::remove_dir_all(&dotnet_path);
            fs::create_dir_all(&dotnet_path)
                .context("Failed to recreate dotnet directory after cleanup")?;
        }

        // Retry download and extract
        download_dotnet_runtime(app, &zip_path)?;

        app.emit("status-bar-log", "backend.dotnet.extracting")
            .unwrap();
        extract_zip_to_directory(&zip_path_str, dotnet_path.to_str().unwrap())
            .map_err(|e| anyhow::anyhow!("Extraction failed after retry: {}", e))?;
    }

    app.emit("status-bar-log", "backend.dotnet.installed")
        .unwrap();

    Ok(true)
}
