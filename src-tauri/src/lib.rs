pub mod capability;
//mod game_hook;
mod error;
pub mod mod_info;
mod logging;
mod installation;
//mod mod_lints;
pub mod integrator;

use std::fs::File;
use std::io::Write;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn save_file(file_data: Vec<u8>, filename: String) -> Result<(), String> {
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


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
