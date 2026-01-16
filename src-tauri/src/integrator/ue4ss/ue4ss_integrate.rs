use crate::capability::zip::extract_zip_to_directory;
use crate::integrator::ReadSeek;
use std::error::Error;
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

pub fn install_ue4ss(install_path: &PathBuf) -> Result<(), Box<dyn Error>> {
    let ue4ss_path = install_path.join("ue4ss");
    println!("Installing UE4SS to: {:?}", ue4ss_path);

    if !ue4ss_path.exists() {
        fs::create_dir(&ue4ss_path)
            .map_err(|e| format!("Failed to create ue4ss directory {:?}: {}", ue4ss_path, e))?;
    }

    let dll_path = ue4ss_path.join("UE4SSL.dll");
    if !dll_path.exists() {
        let ue4ss_dll = include_bytes!("../../../assets/UE4SSL.dll");
        fs::write(&dll_path, ue4ss_dll)
            .map_err(|e| format!("Failed to write UE4SSL.dll: {}", e))?;

        let ue4ss_runtime_dll = ue4ss_path.join("UE4SSL.Runtime.dll");
        let ue4ss_runtime_dll_buff = include_bytes!("../../../assets/UE4SSL.Runtime.dll");
        fs::write(&ue4ss_runtime_dll, ue4ss_runtime_dll_buff)
            .map_err(|e| format!("Failed to write UE4SSL.Runtime.dll: {}", e))?;

        let ue4ss_csharp_dll = ue4ss_path.join("UE4SSL.CSharp.dll");
        let ue4ss_csharp_dll_buff = include_bytes!("../../../assets/UE4SSL.CSharp.dll");
        fs::write(&ue4ss_csharp_dll, ue4ss_csharp_dll_buff)
            .map_err(|e| format!("Failed to write UE4SSL.CSharp.dll: {}", e))?;

        let ue4ss_runtime_json = ue4ss_path.join("UE4SSL.Runtime.runtimeconfig.json");
        let ue4ss_runtime_json_buff =
            include_bytes!("../../../assets/UE4SSL.Runtime.runtimeconfig.json");
        fs::write(&ue4ss_runtime_json, ue4ss_runtime_json_buff)
            .map_err(|e| format!("Failed to write UE4SSL.Runtime.runtimeconfig.json: {}", e))?;

        let proxy_dll_path = install_path.join("dwmapi.dll");
        let proxy_dll = include_bytes!("../../../assets/dwmapi.dll");
        fs::write(&proxy_dll_path, proxy_dll)
            .map_err(|e| format!("Failed to write dwmapi.dll: {}", e))?;

        let mods_path = ue4ss_path.join("mods");
        fs::create_dir(&mods_path)
            .map_err(|e| format!("Failed to create mods directory: {}", e))?;

        let csmods_path = ue4ss_path.join("csmods");
        fs::create_dir(&csmods_path)
            .map_err(|e| format!("Failed to create csmods directory: {}", e))?;

        let ue4ss_framework_dll = csmods_path.join("UE4SSL.Framework.dll");
        let ue4ss_framework_dll_buff = include_bytes!("../../../assets/UE4SSL.Framework.dll");
        fs::write(&ue4ss_framework_dll, ue4ss_framework_dll_buff)
            .map_err(|e| format!("Failed to write UE4SSL.Framework.dll: {}", e))?;
    }
    Ok(())
}

pub fn install_ue4ss_mod(
    install_path: &PathBuf,
    mod_name: &String,
    mod_data: &mut Box<dyn ReadSeek>,
) {
    let mods_home_path = install_path.join("ue4ss").join("mods");

    let mod_path = mods_home_path.join(mod_name);
    fs::create_dir(&mod_path).unwrap();

    let dll_path = mod_path.join("main.dll");

    let mut content = Vec::new();
    mod_data.read_to_end(&mut content).unwrap();
    fs::write(dll_path, &content).unwrap();
}

pub fn uninstall_ue4ss(install_path: &PathBuf) -> Result<(), Box<dyn Error>> {
    let ue4ss_path = install_path.join("ue4ss");
    if fs::exists(&ue4ss_path)? {
        fs::remove_dir_all(ue4ss_path).unwrap();
    }

    //try to delete other ue4ss file
    let ue4ss_dll = install_path.join("UE4SS.dll");
    if fs::exists(&ue4ss_dll)? {
        fs::remove_file(&ue4ss_dll).unwrap();
    }

    let proxy_dll = install_path.join("dwmapi.dll");
    if fs::exists(&proxy_dll)? {
        fs::remove_file(&proxy_dll).unwrap();
    }

    let ue4ss_mods = install_path.join("mods");
    if fs::exists(&ue4ss_mods)? {
        fs::remove_dir_all(&ue4ss_mods).unwrap();
    }

    Ok(())
}

const DOTNET_RUNTIME_URL: &str =
    "https://builds.dotnet.microsoft.com/dotnet/Runtime/10.0.1/dotnet-runtime-10.0.1-win-x64.zip";

/// Downloads and extracts the .NET runtime to the UE4SS/dotnet directory.
/// Skips if runtime is already installed (checks for dotnet directory).
pub fn install_dotnet_runtime(
    app: &AppHandle,
    install_path: &PathBuf,
) -> Result<bool, Box<dyn Error>> {
    let ue4ss_path = install_path.join("ue4ss");
    let dotnet_path = ue4ss_path.join("dotnet");

    // Check if runtime already exists
    let dotnet_check_path = dotnet_path.join("shared").join("Microsoft.NETCore.App");
    if dotnet_check_path.exists() {
        app.emit("status-bar-log", "Dotnet runtime already installed")
            .unwrap();
        return Ok(true);
    }

    // Ensure ue4ss/dotnet directory exists
    if !dotnet_path.exists() {
        fs::create_dir_all(&dotnet_path)?;
    }

    // Get app cache directory for storing the downloaded ZIP
    let cache_dir = app.path().app_cache_dir()?;
    if !cache_dir.exists() {
        fs::create_dir_all(&cache_dir)?;
    }

    // Create temp file for download in cache directory
    let temp_zip_path = cache_dir.join("dotnet-runtime-10.0.1-win-x64.zip");
    let temp_zip_str = temp_zip_path.to_str().unwrap().to_string();

    // Check if ZIP already exists in cache (skip download if present)
    let need_download = !temp_zip_path.exists();

    if need_download {
        app.emit("status-bar-log", "Downloading .NET Runtime...")
            .unwrap();

        // Download the ZIP file
        let client = reqwest::blocking::Client::new();
        let mut response = client.get(DOTNET_RUNTIME_URL).send()?;

        if !response.status().is_success() {
            return Err(format!("HTTP error: {}", response.status()).into());
        }

        let total_size = response.content_length().unwrap_or(0);
        let mut file = fs::File::create(&temp_zip_path)?;
        let mut downloaded: u64 = 0;
        let mut buffer = [0u8; 1024 * 1024]; // 1MB buffer

        loop {
            let bytes_read = response.read(&mut buffer)?;
            if bytes_read == 0 {
                break;
            }

            file.write_all(&buffer[..bytes_read])?;
            downloaded += bytes_read as u64;

            if total_size > 0 {
                let percent = (downloaded as f64 / total_size as f64 * 100.0) as i32;
                app.emit("status-bar-percent", percent).unwrap();
            }
        }
    } else {
        app.emit("status-bar-log", "Using cached .NET Runtime...")
            .unwrap();
    }

    app.emit("status-bar-log", "Extracting .NET Runtime...")
        .unwrap();

    // Extract ZIP to ue4ss/dotnet directory
    extract_zip_to_directory(&temp_zip_str, dotnet_path.to_str().unwrap())?;

    app.emit("status-bar-log", ".NET Runtime installed")
        .unwrap();

    Ok(true)
}
