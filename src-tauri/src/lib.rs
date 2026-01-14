pub mod capability;
pub mod integrator;

use tauri::{AppHandle, Manager, WindowEvent};
//use tauri_plugin_mcp;
use tauri_plugin_sentry::{minidump, sentry};

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
    let client = sentry::init((
        None::<&str>,
        sentry::ClientOptions {
            release: sentry::release_name!(),
            auto_session_tracking: true,
            ..Default::default()
        },
    ));

    // Caution! Everything before here runs in both app and crash reporter processes
    #[cfg(not(target_os = "ios"))]
    let _guard = minidump::init(&client);
    // Everything after here runs in only the app process

    tauri::Builder::default()
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close(); // 阻止默认关闭行为
                    window.app_handle().exit(0); // 手动退出应用
                }
            }
        })
        //.plugin(tauri_plugin_sentry::init(&client))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_task_queue::init().build())
        //         .plugin(tauri_plugin_mcp::init_with_config(
        //             tauri_plugin_mcp::PluginConfig::new("MintCat".parse().unwrap())
        //                 .start_socket_server(true)
        //                 .tcp("127.0.0.1".parse().unwrap(), 9999),
        //         ))
        .invoke_handler(tauri::generate_handler![
            integrator::drg::install_mods,
            integrator::drg::uninstall_mods,
            integrator::drg::check_installed,
            integrator::drg::find_game_pak,
            integrator::drg::install_dotnet_runtime,
            capability::steam::launch_steam_game,
            capability::steam::check_steam_game,
            capability::download::download_large_file,
            open_devtools
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
