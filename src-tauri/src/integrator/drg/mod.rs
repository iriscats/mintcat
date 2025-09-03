use crate::integrator::drg::installation::DRGInstallation;
use crate::integrator::drg::pak_integrator::PakIntegrator;
use crate::integrator::ModInfo;
use tauri::{AppHandle, Emitter};

mod game_pak_patch;
pub(crate) mod installation;
mod mod_bundle_writer;
pub mod pak_integrator;
mod raw_asset;

#[tauri::command]
pub fn install_mods(app: AppHandle, game_path: String, mod_list_json: Box<str>) {
    std::thread::spawn(move || {
        let integrator = PakIntegrator::new(game_path);
        match integrator {
            Ok(integrator) => {
                app.emit("status-bar-log", "Start Install...").unwrap();
                app.emit("status-bar-percent", 5).unwrap();

                let mut mods: Vec<ModInfo> = serde_json::from_str(&mod_list_json).unwrap();

                app.emit("status-bar-log", "Load Mods ...").unwrap();
                app.emit("status-bar-percent", 10).unwrap();

                integrator.install(app, &mut mods).unwrap();
            }
            Err(_) => {
                app.emit("install-error", {}).unwrap();
            }
        }
    });
}

#[tauri::command]
pub fn uninstall_mods(game_path: String, is_delete_ue4ss: bool) -> bool {
    PakIntegrator::uninstall(game_path, is_delete_ue4ss).unwrap();
    true
}

#[tauri::command]
pub fn check_installed(game_path: String, install_time: u64) -> String {
    PakIntegrator::check_installed(game_path, install_time).unwrap()
}

#[tauri::command]
pub fn find_game_pak() -> String {
    if let Some(installation) = DRGInstallation::find() {
        installation.main_pak().to_str().unwrap().to_string()
    } else {
        "".to_string()
    }
}
