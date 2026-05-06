pub mod update;

pub use update::{
    activate_frontend_update, get_frontend_entry_path, get_frontend_update_status, handle_protocol,
    install_frontend_update_from_manifest, mark_frontend_update_ok, rollback_frontend_update,
    rollback_unconfirmed_pending, startup_webview_url,
};
