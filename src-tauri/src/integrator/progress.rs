use anyhow::Result;
use tauri::{AppHandle, Emitter};

pub use mintcat_integrator_core::{json_value, text, InstallEvent, InstallProgress};

#[derive(Clone)]
pub struct TauriInstallProgress {
    app: AppHandle,
}

impl TauriInstallProgress {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl InstallProgress for TauriInstallProgress {
    fn emit(&self, event: InstallEvent) -> Result<()> {
        match event {
            InstallEvent::StatusLog(payload) => self.app.emit("status-bar-log", payload)?,
            InstallEvent::Percent(payload) => self.app.emit("status-bar-percent", payload)?,
            InstallEvent::Success(payload) => self.app.emit("install-success", payload)?,
            InstallEvent::Error(payload) => self.app.emit("install-error", payload)?,
        }
        Ok(())
    }
}
