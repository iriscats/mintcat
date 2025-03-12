pub mod capability;
mod error;
mod installation;
pub mod integrator;
pub mod mod_info;

use crate::integrator::pak_integrator::PakIntegrator;

#[tauri::command]
fn install_mods(game_path: String, mod_list_json: Box<str>) -> Result<(), String> {
    let integrator = PakIntegrator::new(game_path);
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
fn launch_game() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn find_steam_game_home() -> Result<(), String> {
    let steam_dir = steamlocate::SteamDir::locate();
    match steam_dir {
        Ok(steam_dir) => {
            println!("Steam installation - {}", steam_dir.path().display());

            /*            const GMOD_APP_ID: u32 = 4_000;
            let (garrys_mod, _lib) = steam_dir
                .find_app(GMOD_APP_ID)
                .expect("Of course we have G Mod");
            assert_eq!(garrys_mod.name.as_ref().unwrap(), "Garry's Mod");
            println!("{garrys_mod:#?}");*/
        }
        Err(e) => eprintln!("Failed to create integrator: {}", e),
    }

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![install_mods])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
