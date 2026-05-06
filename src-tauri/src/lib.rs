pub mod capability;
pub mod frontend_update;
pub mod integrator;
pub mod uasset_utils;

use tauri::{AppHandle, Emitter, Manager, WebviewWindowBuilder, WindowEvent};
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
        .register_uri_scheme_protocol("mintcathot", |context, request| {
            frontend_update::handle_protocol(context.app_handle(), request)
        })
        .register_uri_scheme_protocol("mintcat-hot", |context, request| {
            frontend_update::handle_protocol(context.app_handle(), request)
        })
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // 当第二个实例尝试启动时，聚焦到已有窗口
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }

            // 处理从第二个实例传递过来的 deep link URL
            // 当应用已运行时，通过 deep link 启动的第二个实例会被阻止，
            // 其 URL 参数会传递到这里
            for arg in args {
                if arg.starts_with("mintcat://") {
                    log::info!("[SingleInstance] Received deep link: {}", arg);
                    // 发送事件给前端处理
                    let _ = app.emit("single-instance-deep-link", &arg);
                }
            }
        }))
        .setup(|app| {
            if let Err(error) = frontend_update::rollback_unconfirmed_pending(app.handle()) {
                log::warn!("[FrontendUpdate] rollback check failed: {}", error);
            }
            if let Err(error) = integrator::runtime_loader::ensure_bundled_runtime(app.handle()) {
                log::warn!("[IntegratorRuntime] bundled runtime init failed: {:#}", error);
            }

            // 网络代理状态（前端通过 set_network_proxy 设置，供下载等请求走 Clash 等代理）
            let proxy_state = capability::network::NetworkProxyState::new();
            let proxy_arc = proxy_state.0.clone();
            app.manage(proxy_state);
            app.manage(capability::download::init_download_manager(proxy_arc));

            let mut main_window_config = app
                .config()
                .app
                .windows
                .iter()
                .find(|window| window.label == "main")
                .cloned()
                .ok_or_else(|| {
                    std::io::Error::new(std::io::ErrorKind::NotFound, "main window config missing")
                })?;
            main_window_config.url = frontend_update::startup_webview_url(app.handle());
            WebviewWindowBuilder::from_config(app.handle(), &main_window_config)?.build()?;
            Ok(())
        })
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
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("mintcat".to_string()),
                    }),
                ])
                .max_file_size(50_000_000 /* 50MB */)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
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
            integrator::drg::check_foreign_paks_in_paks_dir,
            integrator::drg::is_valid_unpacked_mod,
            integrator::drg::check_mod_conflicts,
            integrator::drg::validate_zip_file,
            capability::steam::launch_steam_game,
            capability::steam::check_steam_game,
            capability::download::download_file,
            capability::download::cancel_download,
            capability::network::set_network_proxy,
            capability::network::fetch_update_manifest,
            frontend_update::install_frontend_update_from_manifest,
            frontend_update::activate_frontend_update,
            frontend_update::get_frontend_entry_path,
            frontend_update::mark_frontend_update_ok,
            frontend_update::rollback_frontend_update,
            frontend_update::get_frontend_update_status,
            integrator::runtime_loader::install_integrator_runtime_from_manifest,
            integrator::runtime_loader::get_integrator_runtime_status,
            open_devtools
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
