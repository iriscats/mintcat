use crate::common::zip::{extract_zip_to_directory, is_valid_zip_file};
use crate::ReadSeek;
use anyhow::{Context, Result};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::read::ZipArchive;

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
/// Validates the ZIP archive before extraction to provide clear error messages.
pub fn install_ue4ss(install_path: &PathBuf, ue4ss_zip_path: Option<&Path>) -> Result<()> {
    let zip_path = ue4ss_zip_path
        .ok_or_else(|| anyhow::anyhow!("UE4SSL asset zip path is required (UE4SSL.zip)"))?;

    let install_path_str = install_path
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Invalid install path"))?;
    let zip_path_str = zip_path
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Invalid zip path"))?;

    if !zip_path.exists() {
        anyhow::bail!(
            "UE4SS zip file not found: {:?}. Please re-download the asset.",
            zip_path
        );
    }

    if !is_valid_zip_file(zip_path_str) {
        let file_size = fs::metadata(zip_path).map(|m| m.len()).unwrap_or(0);
        log::error!(
            "UE4SS zip is corrupted or incomplete: {:?} (size: {} bytes)",
            zip_path,
            file_size
        );
        let _ = fs::remove_file(zip_path);
        anyhow::bail!(
            "UE4SS zip file is corrupted (size: {} bytes). The cached file has been removed — please retry installation.",
            file_size
        );
    }

    log::info!("Installing UE4SS: extracting zip to {:?}", install_path);

    extract_zip_to_directory(zip_path_str, install_path_str)
        .map_err(|e| anyhow::anyhow!("Failed to extract UE4SSL zip to game directory: {}", e))?;

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

/// Install a JS script mod by extracting the entire zip to ue4ss/mods/.
/// Prefer `install_ue4ss_js_mod_from_zip_targeted` for mixed zips (pak + js).
#[allow(dead_code)]
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
    extract_zip_to_directory(zip_path_str, mods_dir_str)
        .map_err(|e| anyhow::anyhow!("Failed to extract JS mod zip to ue4ss/mods: {}", e))?;
    Ok(())
}

/// Install JS mod from a zip, extracting only the js/ content to ue4ss/mods/{name}/js/.
/// Works for both pure JS zips and mixed zips (containing pak + js).
pub fn install_ue4ss_js_mod_from_zip_targeted(
    install_path: &PathBuf,
    mod_name: &str,
    zip_path: &Path,
) -> Result<()> {
    let mods_dir = install_path.join("ue4ss").join("mods");
    let sanitized = sanitize_dir_name(mod_name);
    let mod_dir = mods_dir.join(&sanitized);

    let file =
        File::open(zip_path).with_context(|| format!("Failed to open zip: {:?}", zip_path))?;
    let mut archive = ZipArchive::new(file).context("Failed to parse zip")?;

    let mut js_base = String::new();
    for i in 0..archive.len() {
        let entry = archive
            .by_index(i)
            .with_context(|| format!("Failed to read zip entry at index {}", i))?;
        let name = entry.name().replace('\\', "/");
        let lower = name.to_lowercase();
        if lower.ends_with("js/main.js") {
            if let Some(pos) = lower.rfind("js/main.js") {
                js_base = name[..pos].to_string();
            }
            break;
        }
    }

    let js_prefix = format!("{}js/", js_base);
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .with_context(|| format!("Failed to read zip entry at index {}", i))?;
        let name = entry.name().replace('\\', "/");
        if !name.starts_with(&js_prefix) {
            continue;
        }
        let relative = &name[js_base.len()..];
        let target = mod_dir.join(relative);
        if entry.is_dir() {
            fs::create_dir_all(&target)?;
        } else {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut content = Vec::new();
            entry.read_to_end(&mut content)?;
            let mut out = File::create(&target)?;
            out.write_all(&content)?;
        }
    }

    log::info!("Installed JS mod from zip: {:?} -> {:?}", zip_path, mod_dir);
    Ok(())
}

/// Check if a directory contains a JS script mod (js/main.js).
pub fn dir_contains_js_mod(path: &Path) -> bool {
    path.join("js").join("main.js").exists()
}

/// Install JS mod from a directory by copying the js/ subfolder to ue4ss/mods/{name}/js/.
pub fn install_ue4ss_js_mod_from_dir(
    install_path: &PathBuf,
    mod_name: &str,
    mod_dir: &Path,
) -> Result<()> {
    let mods_dir = install_path.join("ue4ss").join("mods");
    let sanitized = sanitize_dir_name(mod_name);
    let target_mod_dir = mods_dir.join(&sanitized);
    let target_js_dir = target_mod_dir.join("js");
    let source_js_dir = mod_dir.join("js");

    fs::create_dir_all(&target_js_dir)
        .with_context(|| format!("Failed to create JS mod directory: {:?}", target_js_dir))?;
    copy_dir_recursive(&source_js_dir, &target_js_dir)
        .with_context(|| format!("Failed to copy JS mod from {:?}", source_js_dir))?;

    log::info!(
        "Installed JS mod from directory: {:?} -> {:?}",
        source_js_dir,
        target_js_dir
    );
    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }
    for entry in
        fs::read_dir(src).with_context(|| format!("Failed to read directory: {:?}", src))?
    {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)
                .with_context(|| format!("Failed to copy {:?} to {:?}", src_path, dst_path))?;
        }
    }
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
