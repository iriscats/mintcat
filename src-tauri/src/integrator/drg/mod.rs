use crate::integrator::core::{
    check_foreign_paks_by_game_path, check_installed_by_game_path, check_mod_conflicts_from_json,
    find_game_pak_by_name, is_valid_mod_directory, is_valid_zip, text, uninstall_mods_by_game_path,
    InstallEvent, InstallProgress, InstallRequest, ModConflict, ModInfo, TauriInstallProgress,
};
use crate::integrator::runtime_loader::install_mods_with_runtime;
use tauri::AppHandle;

mod game_pak_patch;
pub(crate) mod installation;
pub mod pak_integrator;
mod raw_asset;
#[cfg(test)]
mod repak_rc_test;

#[tauri::command]
pub fn install_mods(
    app: AppHandle,
    game_path: String,
    mod_list_json: Box<str>,
    skip_ue4ss: bool,
    ue4ss_zip_path: Option<String>,
    drg_zip_path: Option<String>,
    rc_zip_path: Option<String>,
) {
    std::thread::spawn(move || {
        let progress = TauriInstallProgress::new(app.clone());
        let mods = match serde_json::from_str::<Vec<ModInfo>>(&mod_list_json) {
            Ok(mods) => mods,
            Err(error) => {
                let error_msg = format!("Failed to parse mod list: {:#}", error);
                eprintln!("{}", error_msg);
                let _ = progress.emit(InstallEvent::Error(text(error_msg)));
                return;
            }
        };
        let request = InstallRequest::new(
            game_path,
            mods,
            skip_ue4ss,
            ue4ss_zip_path,
            drg_zip_path,
            rc_zip_path,
        );
        if let Err(e) = install_mods_with_runtime(&app, &progress, request) {
            let error_msg = format!("{:#}", e);
            eprintln!("{}", error_msg);
            let _ = progress.emit(InstallEvent::Error(text(error_msg)));
        }
    });
}

#[tauri::command]
pub fn uninstall_mods(game_path: String, is_delete_ue4ss: bool) -> Result<bool, String> {
    uninstall_mods_by_game_path(game_path, is_delete_ue4ss).map_err(|e| format!("{:#}", e))
}

#[tauri::command]
pub fn check_installed(game_path: String, install_time: u64) -> Result<String, String> {
    check_installed_by_game_path(game_path, install_time).map_err(|e| format!("{:#}", e))
}

#[tauri::command]
pub fn find_game_pak(game_name: Option<String>) -> String {
    find_game_pak_by_name(game_name.as_deref())
}

/// Check for foreign .pak files in game Paks directory (not game nor MintCat-generated).
/// Returns list of foreign .pak file names; empty if none or on error (e.g. path invalid).
#[tauri::command]
pub fn check_foreign_paks_in_paks_dir(game_path: String) -> Result<Vec<String>, String> {
    check_foreign_paks_by_game_path(&game_path).map_err(|e| format!("{:#}", e))
}

/// Check if a directory is a valid mod directory.
/// Returns true for: Content/ (unpacked UE assets), pak/ (.pak files), js/ (scripts), dll/ (native mods)
#[tauri::command]
pub fn is_valid_unpacked_mod(path: String) -> bool {
    is_valid_mod_directory(&path)
}

/// Check for file conflicts between mods
/// Returns a list of mods that have conflicts with other mods
/// `game_name`: current active game name (e.g. "drg" or "rc") for unpacked mod path prefix
#[tauri::command]
pub fn check_mod_conflicts(
    mod_list_json: String,
    game_name: Option<String>,
) -> Result<Vec<ModConflict>, String> {
    check_mod_conflicts_from_json(&mod_list_json, game_name.as_deref())
}

#[tauri::command]
pub fn validate_zip_file(path: String) -> bool {
    is_valid_zip(&path)
}
