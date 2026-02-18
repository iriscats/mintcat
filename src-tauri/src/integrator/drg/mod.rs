use crate::integrator::drg::installation::DRGInstallation;
use crate::integrator::drg::pak_integrator::PakIntegrator;
use crate::integrator::drg::unpacked_mod::UnpackedMod;
use crate::integrator::drgrc;
use crate::integrator::ue4ss::ue4ss_integrate;
use crate::integrator::ModInfo;
use anyhow::Context;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::BufReader;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

mod game_pak_patch;
pub(crate) mod installation;
pub(crate) mod mod_bundle_writer;
pub mod pak_integrator;
mod raw_asset;
#[cfg(test)]
mod repak_rc_test;
pub mod unpacked_mod;

fn do_install_mods(
    app: &AppHandle,
    game_path: &str,
    mod_list_json: &str,
    skip_ue4ss: bool,
    ue4ss_zip_path: Option<&str>,
    drg_zip_path: Option<&str>,
) -> anyhow::Result<()> {
    let mut mods: Vec<ModInfo> =
        serde_json::from_str(mod_list_json).context("Failed to parse mod list")?;

    app.emit("status-bar-log", "backend.install.start").unwrap();
    app.emit("status-bar-percent", 5).unwrap();
    app.emit("status-bar-log", "backend.install.load_mods").unwrap();
    app.emit("status-bar-percent", 10).unwrap();

    let is_rc = game_path.ends_with("RogueCore-Windows.pak");
    let ue4ss_zip = if is_rc {
        None
    } else {
        ue4ss_zip_path.map(PathBuf::from)
    };

    if is_rc {
        let integrator = drgrc::pak_integrator::RcPakIntegrator::new(game_path)
            .context("Failed to initialize RC integrator")?;
        integrator.install(app.clone(), &mut mods, skip_ue4ss, None)?;
    } else {
        let integrator = PakIntegrator::new(game_path).context("Failed to initialize integrator")?;
        let drg_zip = drg_zip_path.map(PathBuf::from);
        integrator.install(app.clone(), &mut mods, skip_ue4ss, ue4ss_zip.as_deref(), drg_zip.as_deref())?;
    }

    Ok(())
}

#[tauri::command]
pub fn install_mods(
    app: AppHandle,
    game_path: String,
    mod_list_json: Box<str>,
    skip_ue4ss: bool,
    ue4ss_zip_path: Option<String>,
    drg_zip_path: Option<String>,
) {
    std::thread::spawn(move || {
        if let Err(e) = do_install_mods(
            &app,
            &game_path,
            &mod_list_json,
            skip_ue4ss,
            ue4ss_zip_path.as_deref(),
            drg_zip_path.as_deref(),
        ) {
            let error_msg = format!("{:#}", e);
            eprintln!("{}", error_msg);
            app.emit("install-error", error_msg).unwrap();
        }
    });
}

#[tauri::command]
pub fn uninstall_mods(game_path: String, is_delete_ue4ss: bool) -> Result<bool, String> {
    if game_path.ends_with("RogueCore-Windows.pak") {
        drgrc::pak_integrator::RcPakIntegrator::uninstall(game_path, is_delete_ue4ss)
            .map(|_| true)
            .map_err(|e| format!("{:#}", e))
    } else {
        PakIntegrator::uninstall(game_path, is_delete_ue4ss)
            .map(|_| true)
            .map_err(|e| format!("{:#}", e))
    }
}

#[tauri::command]
pub fn check_installed(game_path: String, install_time: u64) -> Result<String, String> {
    if game_path.ends_with("RogueCore-Windows.pak") {
        drgrc::pak_integrator::RcPakIntegrator::check_installed(game_path, install_time)
            .map_err(|e| format!("{:#}", e))
    } else {
        PakIntegrator::check_installed(game_path, install_time).map_err(|e| format!("{:#}", e))
    }
}

#[tauri::command]
pub fn find_game_pak(game_name: Option<String>) -> String {
    let path = match game_name.as_deref() {
        Some("rc") => drgrc::installation::RcInstallation::find_rc()
            .and_then(|i| i.pak_path.to_str().map(String::from)),
        _ => DRGInstallation::find().and_then(|i| i.pak_path.to_str().map(String::from)),
    };
    path.unwrap_or_default()
}

#[tauri::command]
pub async fn install_dotnet_runtime(app: AppHandle, game_path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let installation = DRGInstallation::from_pak_path(&game_path)
            .map_err(|_| "backend.error.invalid_game_path".to_string())?;

        let binaries_path = installation.binaries_directory();

        ue4ss_integrate::install_dotnet_runtime(&app, &binaries_path)
            .map_err(|_| "backend.error.dotnet_install_failed".to_string())
    })
    .await
    .map_err(|_| "backend.error.task_join".to_string())?
}

/// Check if a directory is a valid unpacked mod directory
/// Returns true if the directory contains a Content folder with uasset/uexp files
#[tauri::command]
pub fn is_valid_unpacked_mod(path: String) -> bool {
    UnpackedMod::is_valid_unpacked_mod(&path)
}

/// Input structure for conflict check
#[derive(Debug, Deserialize)]
pub struct ConflictCheckModInfo {
    pub mod_id: i64,
    pub cache_path: String,
    pub is_unpacked: bool,
}

/// Output structure for conflict detection result
#[derive(Debug, Serialize)]
pub struct ModConflict {
    pub mod_id: i64,
    pub conflicting_mods: Vec<i64>,
    pub conflicting_files: Vec<String>,
}

/// Get file list from a pak file
fn get_pak_files(pak_path: &str) -> anyhow::Result<Vec<String>> {
    let file = fs::File::open(pak_path)
        .with_context(|| format!("Failed to open pak file: {}", pak_path))?;
    let mut reader = BufReader::new(file);
    
    let pak = repak::PakBuilder::new()
        .reader(&mut reader)
        .with_context(|| format!("Failed to parse pak file: {}", pak_path))?;
    
    // Get and normalize file paths
    let mount_point = pak.mount_point();
    let files: Vec<String> = pak.files()
        .iter()
        .map(|p| {
            // Combine mount point with file path and normalize
            let full_path = if mount_point.is_empty() {
                p.to_string()
            } else {
                format!("{}{}", mount_point.trim_end_matches('/'), p)
            };
            // Normalize path: remove leading "../../../" and convert to lowercase for comparison
            full_path
                .trim_start_matches("../../../")
                .trim_start_matches("../../")
                .trim_start_matches("../")
                .to_lowercase()
        })
        .collect();
    
    Ok(files)
}

/// Content prefix for unpacked mod path (lowercase): "fsd" or "roguecore"
fn content_prefix_for_game(game_name: Option<&str>) -> &'static str {
    match game_name {
        Some(name) if name.eq_ignore_ascii_case("rc") => "roguecore",
        _ => "fsd",
    }
}

/// Get file list from an unpacked mod directory
/// `content_prefix`: "fsd" or "roguecore", produces pak-style path {prefix}/content/...
fn get_unpacked_mod_files(dir_path: &str, content_prefix: &str) -> anyhow::Result<Vec<String>> {
    let path = std::path::Path::new(dir_path);
    let content_path = path.join("Content");

    if !content_path.is_dir() {
        anyhow::bail!("Content directory not found in unpacked mod: {}", dir_path);
    }

    let mut files = Vec::new();

    for entry in WalkDir::new(&content_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();
        if entry_path.is_dir() {
            continue;
        }

        // Get relative path from Content directory
        if let Ok(relative) = entry_path.strip_prefix(&content_path) {
            let pak_path = format!(
                "{}/content/{}",
                content_prefix.to_lowercase(),
                relative.to_string_lossy().replace('\\', "/").to_lowercase()
            );
            files.push(pak_path);
        }
    }

    Ok(files)
}

/// Check for file conflicts between mods
/// Returns a list of mods that have conflicts with other mods
/// `game_name`: current active game name (e.g. "drg" or "rc") for unpacked mod path prefix
#[tauri::command]
pub fn check_mod_conflicts(
    mod_list_json: String,
    game_name: Option<String>,
) -> Result<Vec<ModConflict>, String> {
    let mods: Vec<ConflictCheckModInfo> = serde_json::from_str(&mod_list_json)
        .map_err(|_| "backend.error.parse_mod_list".to_string())?;

    let content_prefix = content_prefix_for_game(game_name.as_deref());

    // Map from file path to list of mod IDs that contain this file
    let mut file_to_mods: HashMap<String, Vec<i64>> = HashMap::new();

    // Process each mod
    for mod_info in &mods {
        let files = if mod_info.is_unpacked {
            get_unpacked_mod_files(&mod_info.cache_path, content_prefix)
        } else {
            get_pak_files(&mod_info.cache_path)
        };
        
        match files {
            Ok(file_list) => {
                for file_path in file_list {
                    file_to_mods
                        .entry(file_path)
                        .or_default()
                        .push(mod_info.mod_id);
                }
            }
            Err(e) => {
                // Log error but continue with other mods
                eprintln!("Failed to read mod {}: {:#}", mod_info.mod_id, e);
            }
        }
    }
    
    // Find conflicts: files that appear in multiple mods
    let mut mod_conflicts: HashMap<i64, (Vec<i64>, Vec<String>)> = HashMap::new();
    
    for (file_path, mod_ids) in file_to_mods {
        if mod_ids.len() > 1 {
            // This file exists in multiple mods - record conflict for each mod
            for &mod_id in &mod_ids {
                let entry = mod_conflicts.entry(mod_id).or_insert_with(|| (Vec::new(), Vec::new()));
                
                // Add other mods as conflicting (not self)
                for &other_mod_id in &mod_ids {
                    if other_mod_id != mod_id && !entry.0.contains(&other_mod_id) {
                        entry.0.push(other_mod_id);
                    }
                }
                
                // Add the conflicting file path
                if !entry.1.contains(&file_path) {
                    entry.1.push(file_path.clone());
                }
            }
        }
    }
    
    // Convert to result format
    let conflicts: Vec<ModConflict> = mod_conflicts
        .into_iter()
        .map(|(mod_id, (conflicting_mods, conflicting_files))| ModConflict {
            mod_id,
            conflicting_mods,
            conflicting_files,
        })
        .collect();
    
    Ok(conflicts)
}
