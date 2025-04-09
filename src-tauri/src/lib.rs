pub mod capability;
pub mod integrator;

use crate::integrator::installation::DRGInstallation;
use integrator::mod_info;
use integrator::pak_integrator::PakIntegrator;
use tauri::{AppHandle, Emitter, Manager};

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
                app.emit("status-bar-log", "Failed to load Mods ...")
                    .unwrap();
            }
        }
    });
}

#[tauri::command]
fn uninstall_mods(game_path: String) -> bool {
    PakIntegrator::uninstall(game_path).unwrap();
    true
}

#[tauri::command]
fn check_installed(game_path: String) -> String {
    PakIntegrator::check_installed(game_path).unwrap()
}

#[tauri::command]
fn launch_game() {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        let game_id = "548430";
        let url = format!("steam://rungameid/{} -disablemodding", game_id);
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

#[tauri::command]
fn is_first_run() -> bool {
    let path = std::env::current_dir().unwrap();
    let first_run_path = path.join("first_run");
    if first_run_path.exists() {
        std::fs::remove_file(first_run_path).unwrap();
        true
    } else {
        false
    }
}

pub fn run() {
    tauri::Builder::default()
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
            is_first_run
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
