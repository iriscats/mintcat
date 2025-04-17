pub mod capability;
pub mod integrator;

use crate::integrator::installation::DRGInstallation;
use integrator::mod_info;
use integrator::pak_integrator::PakIntegrator;
use serde::Serialize;
use std::fs::File;
use std::io::{Read, Write};
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
                app.emit("install-error", {}).unwrap();
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
fn check_installed(game_path: String, install_time: u64) -> String {
    PakIntegrator::check_installed(game_path, install_time).unwrap()
}

#[tauri::command]
fn launch_game() {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        let game_id = "548430";
        let url = format!("steam://run/{}//-disablemodding", game_id);
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    downloaded_size: u64,
    total_size: u64,
}

#[tauri::command]
fn download_large_file(app: AppHandle, url: String, file_path: String) -> Result<(), String> {
    std::thread::spawn(move || {
        // 初始化HTTP客户端
        let client = reqwest::blocking::Client::new();
        let mut response = match client.get(url).send() {
            Ok(res) => res,
            Err(e) => {
                app.emit("download-api-statue", format!("请求失败: {}", e))
                    .unwrap();
                return;
            }
        };

        // 检查响应状态
        if !response.status().is_success() {
            app.emit(
                "download-api-statue",
                format!("HTTP错误: {}", response.status()),
            )
            .unwrap();
            return;
        }

        // 获取文件总大小
        let total_size = response.content_length().unwrap_or(0);

        // 创建文件
        let mut file = match File::create(file_path) {
            Ok(f) => f,
            Err(e) => {
                app.emit("download-api-statue", format!("创建文件失败: {}", e))
                    .unwrap();
                return;
            }
        };

        // 分块下载
        let mut downloaded = 0;
        let mut buffer = [0u8; 1024 * 1024]; // 2mb 缓冲区

        loop {
            let bytes_read = match response.read(&mut buffer) {
                Ok(0) => break, // 读取结束
                Ok(n) => n,
                Err(e) => {
                    app.emit("download-api-statue", format!("读取失败: {}", e))
                        .unwrap();
                    return;
                }
            };

            if let Err(e) = file.write_all(&buffer[..bytes_read]) {
                app.emit("download-api-statue", format!("写入失败: {}", e))
                    .unwrap();
                return;
            }

            // 更新进度
            downloaded += bytes_read as u64;
            if total_size > 0 {
                //let percent = (downloaded as f64 / total_size as f64 * 100.0) as i32;
                app.emit(
                    "download-api-progress",
                    DownloadProgress {
                        downloaded_size: downloaded,
                        total_size: total_size,
                    },
                )
                .unwrap();
            }
        }

        app.emit("download-api-statue", "success").unwrap();
    });

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
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
            is_first_run,
            download_large_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
