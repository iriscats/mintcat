use anyhow::Context;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::BufReader;
use walkdir::WalkDir;

#[derive(Debug, Deserialize)]
pub struct ConflictCheckModInfo {
    pub mod_id: i64,
    pub cache_path: String,
    pub is_unpacked: bool,
}

#[derive(Debug, Serialize)]
pub struct ModConflict {
    pub mod_id: i64,
    pub conflicting_mods: Vec<i64>,
    pub conflicting_files: Vec<String>,
}

fn get_pak_files(pak_path: &str) -> anyhow::Result<Vec<String>> {
    let file = fs::File::open(pak_path)
        .with_context(|| format!("Failed to open pak file: {}", pak_path))?;
    let mut reader = BufReader::new(file);

    let pak = repak::PakBuilder::new()
        .reader(&mut reader)
        .with_context(|| format!("Failed to parse pak file: {}", pak_path))?;

    let mount_point = pak.mount_point();
    let files: Vec<String> = pak
        .files()
        .iter()
        .map(|p| {
            let full_path = if mount_point.is_empty() {
                p.to_string()
            } else {
                format!("{}{}", mount_point.trim_end_matches('/'), p)
            };
            full_path
                .trim_start_matches("../../../")
                .trim_start_matches("../../")
                .trim_start_matches("../")
                .to_lowercase()
        })
        .collect();

    Ok(files)
}

fn content_prefix_for_game(game_name: Option<&str>) -> &'static str {
    match game_name {
        Some(name) if name.eq_ignore_ascii_case("rc") => "roguecore",
        _ => "fsd",
    }
}

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

fn get_directory_mod_pak_files(dir_path: &str, content_prefix: &str) -> anyhow::Result<Vec<String>> {
    let path = std::path::Path::new(dir_path);
    let mut all_files = Vec::new();

    let content_path = path.join("Content");
    if content_path.is_dir() {
        if let Ok(files) = get_unpacked_mod_files(dir_path, content_prefix) {
            all_files.extend(files);
        }
    }

    let pak_dir = path.join("pak");
    if pak_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&pak_dir) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                if entry_path.is_file()
                    && entry_path
                        .extension()
                        .and_then(|e| e.to_str())
                        .map_or(false, |e| e.eq_ignore_ascii_case("pak"))
                {
                    if let Some(p) = entry_path.to_str() {
                        if let Ok(files) = get_pak_files(p) {
                            all_files.extend(files);
                        }
                    }
                }
            }
        }
    }

    Ok(all_files)
}

pub fn check_mod_conflicts_from_json(
    mod_list_json: &str,
    game_name: Option<&str>,
) -> Result<Vec<ModConflict>, String> {
    let mods: Vec<ConflictCheckModInfo> = serde_json::from_str(mod_list_json)
        .map_err(|_| "backend.error.parse_mod_list".to_string())?;

    Ok(check_mod_conflicts(&mods, game_name))
}

pub fn check_mod_conflicts(
    mods: &[ConflictCheckModInfo],
    game_name: Option<&str>,
) -> Vec<ModConflict> {
    let content_prefix = content_prefix_for_game(game_name);
    let mut file_to_mods: HashMap<String, Vec<i64>> = HashMap::new();

    for mod_info in mods {
        let files = if mod_info.is_unpacked {
            get_directory_mod_pak_files(&mod_info.cache_path, content_prefix)
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
            Err(error) => {
                eprintln!("Failed to read mod {}: {:#}", mod_info.mod_id, error);
            }
        }
    }

    let mut mod_conflicts: HashMap<i64, (Vec<i64>, Vec<String>)> = HashMap::new();

    for (file_path, mod_ids) in file_to_mods {
        if mod_ids.len() > 1 {
            for &mod_id in &mod_ids {
                let entry = mod_conflicts
                    .entry(mod_id)
                    .or_insert_with(|| (Vec::new(), Vec::new()));

                for &other_mod_id in &mod_ids {
                    if other_mod_id != mod_id && !entry.0.contains(&other_mod_id) {
                        entry.0.push(other_mod_id);
                    }
                }

                if !entry.1.contains(&file_path) {
                    entry.1.push(file_path.clone());
                }
            }
        }
    }

    mod_conflicts
        .into_iter()
        .map(|(mod_id, (conflicting_mods, conflicting_files))| ModConflict {
            mod_id,
            conflicting_mods,
            conflicting_files,
        })
        .collect()
}
