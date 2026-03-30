use crate::capability::zip::extract_zip_to_directory;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct InstalledThemePackageResult {
    pub id: String,
}

fn find_manifest_path(root: &Path) -> Option<PathBuf> {
    for entry in WalkDir::new(root).into_iter().filter_map(Result::ok) {
        if !entry.file_type().is_file() {
            continue;
        }

        let file_name = entry.file_name().to_string_lossy();
        if file_name == "theme.json" || file_name == "manifest.json" {
            return Some(entry.path().to_path_buf());
        }
    }

    None
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), String> {
    if !target.exists() {
        fs::create_dir_all(target).map_err(|e| e.to_string())?;
    }

    for entry in WalkDir::new(source).into_iter().filter_map(Result::ok) {
        let relative = entry
            .path()
            .strip_prefix(source)
            .map_err(|e| e.to_string())?;
        let destination_path = target.join(relative);

        if entry.file_type().is_dir() {
            fs::create_dir_all(&destination_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = destination_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(entry.path(), &destination_path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn read_manifest_value(manifest_path: &Path) -> Result<Value, String> {
    let content = fs::read_to_string(manifest_path).map_err(|e| e.to_string())?;
    serde_json::from_str::<Value>(&content).map_err(|e| e.to_string())
}

fn manifest_string_field<'a>(manifest: &'a Value, key: &str) -> Option<&'a str> {
    manifest.get(key).and_then(|value| value.as_str())
}

#[tauri::command(rename_all = "camelCase")]
pub fn install_theme_package(zip_path: String, themes_dir: String) -> Result<InstalledThemePackageResult, String> {
    let temp_dir = std::env::temp_dir().join(format!("mintcat-theme-{}", Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    extract_zip_to_directory(&zip_path, temp_dir.to_string_lossy().as_ref()).map_err(|e| e.to_string())?;

    let manifest_path = find_manifest_path(&temp_dir)
        .ok_or_else(|| "Theme package missing theme.json or manifest.json".to_string())?;
    let manifest = read_manifest_value(&manifest_path)?;

    let id = manifest_string_field(&manifest, "id")
        .ok_or_else(|| "Theme package manifest missing id".to_string())?
        .trim()
        .to_string();
    let name = manifest_string_field(&manifest, "name")
        .ok_or_else(|| "Theme package manifest missing name".to_string())?
        .trim()
        .to_string();
    let entry_css = manifest_string_field(&manifest, "entryCss")
        .or_else(|| manifest_string_field(&manifest, "entry_css"))
        .unwrap_or("theme.css")
        .trim()
        .to_string();

    if id.is_empty() || name.is_empty() {
        return Err("Theme package id and name must not be empty".to_string());
    }

    if !id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err("Theme package id contains unsupported characters".to_string());
    }

    let package_root = manifest_path
        .parent()
        .ok_or_else(|| "Invalid theme package structure".to_string())?;
    if !package_root.join(&entry_css).exists() {
        return Err(format!("Theme package missing entry CSS: {}", entry_css));
    }

    let themes_root = Path::new(&themes_dir);
    fs::create_dir_all(themes_root).map_err(|e| e.to_string())?;

    let target_dir = themes_root.join(&id);
    if target_dir.exists() {
        fs::remove_dir_all(&target_dir).map_err(|e| e.to_string())?;
    }

    copy_dir_recursive(package_root, &target_dir)?;
    let _ = fs::remove_dir_all(&temp_dir);

    Ok(InstalledThemePackageResult { id })
}
