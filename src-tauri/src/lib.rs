pub mod capability;
pub mod integrator;

use crate::integrator::installation::DRGInstallation;
use integrator::mod_info;
use integrator::pak_integrator::PakIntegrator;
use serde::Serialize;
use std::io::{Read, Write};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

#[tauri::command]
fn install_mods(app: AppHandle, game_path: String, mod_list_json: Box<str>) {
    std::thread::spawn(move || {
        let integrator = PakIntegrator::new(game_path);
        match integrator {
            Ok(integrator) => {
                app.emit("status-bar-log", "Start Install...").unwrap();
                app.emit("status-bar-percent", 5).unwrap();

                let mut mods: Vec<mod_info::ModInfo> =
                    serde_json::from_str(&mod_list_json).unwrap();

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
fn uninstall_mods(game_path: String, is_delete_ue4ss: bool) -> bool {
    PakIntegrator::uninstall(game_path, is_delete_ue4ss).unwrap();
    true
}

#[tauri::command]
fn check_installed(game_path: String, install_time: u64) -> String {
    PakIntegrator::check_installed(game_path, install_time).unwrap()
}

#[tauri::command]
fn launch_game() {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        let game_id = "548430";
        //let url = format!("steam://run/{}//-disablemodding", game_id);
        let url = format!("steam://run/{}", game_id);
        let status = Command::new("cmd")
            .args(&["/C", "start", "", &url])
            .status()
            .expect("启动游戏失败");

        if status.success() {
            println!("游戏启动成功！");
        } else {
            println!("游戏启动失败！");
        }
    }
}

#[tauri::command]
fn find_game_pak() -> String {
    if let Some(installation) = DRGInstallation::find() {
        installation.main_pak().to_str().unwrap().to_string()
    } else {
        "".to_string()
    }
}

#[tauri::command]
fn open_devtools(app_handle: AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        if !window.is_devtools_open() {
            window.open_devtools();
        } else {
            window.close_devtools();
        }
    }
}


pub fn run() {
    tauri::Builder::default()
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close(); // 阻止默认关闭行为
                    window.app_handle().exit(0); // 手动退出应用
                }
            }
        })
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            install_mods,
            uninstall_mods,
            check_installed,
            open_devtools,
            launch_game,
            find_game_pak,
            capability::steam::check_steam_game,
            capability::download::download_large_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
