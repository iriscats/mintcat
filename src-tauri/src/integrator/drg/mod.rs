use crate::integrator::drg::installation::DRGInstallation;
use crate::integrator::drg::pak_integrator::PakIntegrator;
use crate::integrator::drg::unpacked_mod::UnpackedMod;
use crate::integrator::ue4ss::ue4ss_integrate;
use crate::integrator::ModInfo;
use anyhow::Context;
use tauri::{AppHandle, Emitter};

mod game_pak_patch;
pub(crate) mod installation;
mod mod_bundle_writer;
pub mod pak_integrator;
mod raw_asset;
pub mod unpacked_mod;

fn do_install_mods(app: &AppHandle, game_path: &str, mod_list_json: &str, skip_ue4ss: bool) -> anyhow::Result<()> {
    let integrator = PakIntegrator::new(game_path).context("Failed to initialize integrator")?;

    app.emit("status-bar-log", "Start Install...").unwrap();
    app.emit("status-bar-percent", 5).unwrap();

    let mut mods: Vec<ModInfo> =
        serde_json::from_str(mod_list_json).context("Failed to parse mod list")?;

    app.emit("status-bar-log", "Load Mods ...").unwrap();
    app.emit("status-bar-percent", 10).unwrap();

    integrator.install(app.clone(), &mut mods, skip_ue4ss)?;

    Ok(())
}

#[tauri::command]
pub fn install_mods(app: AppHandle, game_path: String, mod_list_json: Box<str>, skip_ue4ss: bool) {
    std::thread::spawn(move || {
        if let Err(e) = do_install_mods(&app, &game_path, &mod_list_json, skip_ue4ss) {
            let error_msg = format!("{:#}", e);
            eprintln!("{}", error_msg);
            app.emit("install-error", error_msg).unwrap();
        }
    });
}

#[tauri::command]
pub fn uninstall_mods(game_path: String, is_delete_ue4ss: bool) -> Result<bool, String> {
    PakIntegrator::uninstall(game_path, is_delete_ue4ss)
        .map(|_| true)
        .map_err(|e| format!("{:#}", e))
}

#[tauri::command]
pub fn check_installed(game_path: String, install_time: u64) -> Result<String, String> {
    PakIntegrator::check_installed(game_path, install_time).map_err(|e| format!("{:#}", e))
}

#[tauri::command]
pub fn find_game_pak() -> String {
    DRGInstallation::find()
        .and_then(|i| i.main_pak().to_str().map(|s| s.to_string()))
        .unwrap_or_default()
}

#[tauri::command]
pub async fn install_dotnet_runtime(app: AppHandle, game_path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let installation = DRGInstallation::from_pak_path(&game_path)
            .map_err(|e| format!("Invalid game path: {:#}", e))?;

        let binaries_path = installation.binaries_directory();

        ue4ss_integrate::install_dotnet_runtime(&app, &binaries_path)
            .map_err(|e| format!("Failed to install .NET runtime: {:#}", e))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Check if a directory is a valid unpacked mod directory
/// Returns true if the directory contains a Content folder with uasset/uexp files
#[tauri::command]
pub fn is_valid_unpacked_mod(path: String) -> bool {
    UnpackedMod::is_valid_unpacked_mod(&path)
}
