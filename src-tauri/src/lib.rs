pub mod capability;
//mod game_hook;
mod error;
mod installation;
mod logging;
pub mod mod_info;
//mod mod_lints;
pub mod integrator;

use std::fs::File;
use std::io::Write;

use crate::integrator::pak_integrator::PakIntegrator;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn save_file(file_data: Vec<u8>, filename: String) -> Result<(), String> {
    match File::create(&filename) {
        Ok(mut file) => {
            if let Err(e) = file.write_all(&file_data) {
                return Err(format!("Failed to write to file: {}", e));
            }
        }
        Err(e) => return Err(format!("Failed to create file: {}", e)),
    }
    Ok(())
}

#[tauri::command]
fn install_mods(mod_list_json: Box<str>) -> Result<(), String> {
    let integrator =
        PakIntegrator::new("/Users/bytedance/Desktop/data/Content/Paks/FSD-WindowsNoEditor.pak");
    match integrator {
        Ok(integrator) => {
            let mods: Vec<mod_info::ModInfo> = serde_json::from_str(&mod_list_json).unwrap();
            integrator.install(mods).unwrap();
        }
        Err(e) => eprintln!("Failed to create integrator: {}", e),
    }
    Ok(())
}

#[tauri::command]
fn launch_games() -> Result<(), String> {
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![install_mods])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
