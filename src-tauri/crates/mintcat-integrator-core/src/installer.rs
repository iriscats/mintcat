use std::collections::HashSet;
use std::fs;

use anyhow::Context;

use crate::common::audio_pak::is_mintcat_audio_pak;
use crate::drg::installation::DRGInstallation;
use crate::drg::pak_integrator::PakIntegrator;
use crate::drgrc::installation::RcInstallation;
use crate::drgrc::pak_integrator::RcPakIntegrator;
use crate::progress::{text, InstallEvent, InstallProgress};
use crate::{GameKind, InstallRequest};

pub fn install_mods_with_progress(
    progress: &dyn InstallProgress,
    mut request: InstallRequest,
) -> anyhow::Result<()> {
    progress.emit(InstallEvent::StatusLog(text("backend.install.start")))?;
    progress.emit(InstallEvent::Percent(5.0))?;
    progress.emit(InstallEvent::StatusLog(text("backend.install.load_mods")))?;
    progress.emit(InstallEvent::Percent(10.0))?;

    match request.game_kind {
        GameKind::RogueCore => {
            let integrator = RcPakIntegrator::new(&request.game_path, request.compress_mod_pak)
                .context("Failed to initialize RC integrator")?;
            integrator.install(
                progress,
                &mut request.mods,
                request.skip_ue4ss,
                request.ue4ss_zip_path.as_deref(),
                request.rc_zip_path.as_deref(),
            )?;
        }
        GameKind::Drg => {
            let integrator = PakIntegrator::new(&request.game_path, request.compress_mod_pak)
                .context("Failed to initialize integrator")?;
            integrator.install(
                progress,
                &mut request.mods,
                request.skip_ue4ss,
                request.ue4ss_zip_path.as_deref(),
                request.drg_zip_path.as_deref(),
            )?;
        }
    }

    Ok(())
}

pub fn uninstall_mods_by_game_path(
    game_path: String,
    is_delete_ue4ss: bool,
) -> anyhow::Result<bool> {
    match GameKind::from_game_pak_path(&game_path) {
        GameKind::RogueCore => RcPakIntegrator::uninstall(game_path, is_delete_ue4ss).map(|_| true),
        GameKind::Drg => PakIntegrator::uninstall(game_path, is_delete_ue4ss).map(|_| true),
    }
}

pub fn check_installed_by_game_path(
    game_path: String,
    install_time: u64,
) -> anyhow::Result<String> {
    match GameKind::from_game_pak_path(&game_path) {
        GameKind::RogueCore => RcPakIntegrator::check_installed(game_path, install_time),
        GameKind::Drg => PakIntegrator::check_installed(game_path, install_time),
    }
}

pub fn find_game_pak_by_name(game_name: Option<&str>) -> String {
    let path = match game_name {
        Some("rc") => RcInstallation::find_rc().and_then(|i| i.pak_path.to_str().map(String::from)),
        _ => DRGInstallation::find().and_then(|i| i.pak_path.to_str().map(String::from)),
    };
    path.unwrap_or_default()
}

fn allowed_pak_names_drg() -> HashSet<&'static str> {
    [
        "FSD-WindowsNoEditor.pak",
        "FSD-WinGDK.pak",
        "FSD-WindowsNoEditor_Mods.pak",
        "FSD-WinGDK_Mods.pak",
    ]
    .into_iter()
    .collect()
}

fn allowed_pak_names_rc() -> HashSet<&'static str> {
    ["RogueCore-Windows.pak", "RogueCore-Windows_Mods.pak"]
        .into_iter()
        .collect()
}

pub fn check_foreign_paks_by_game_path(game_path: &str) -> anyhow::Result<Vec<String>> {
    let allowed = match GameKind::from_game_pak_path(game_path) {
        GameKind::RogueCore => RcInstallation::from_pak_path(game_path)?.paks_path(),
        GameKind::Drg => DRGInstallation::from_pak_path(game_path)?.paks_path(),
    };

    let allowed_names = match GameKind::from_game_pak_path(game_path) {
        GameKind::RogueCore => allowed_pak_names_rc(),
        GameKind::Drg => allowed_pak_names_drg(),
    };

    let entries = fs::read_dir(&allowed)?;
    let mut foreign = Vec::new();
    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.ends_with(".pak")
                    && !allowed_names.contains(name)
                    && !is_mintcat_audio_pak(name)
                {
                    foreign.push(name.to_string());
                }
            }
        }
    }
    foreign.sort();
    Ok(foreign)
}
