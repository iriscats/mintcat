use serde::{Deserialize, Serialize};
use std::io::{Read, Seek};
use std::path::PathBuf;

pub mod common;
pub mod conflict;
pub mod drg;
pub mod drgrc;
pub mod installer;
pub mod progress;
pub mod uasset_utils;
pub mod validation;
pub use common::audio_pak::{
    audio_pak_filename, cleanup_audio_paks, is_mintcat_audio_pak, sanitize_mod_name,
    verify_audio_only_from_bytes, verify_audio_only_pak_file, zip_contains_file_name,
    AUDIO_PAK_INFIX, AUDIO_PAK_SUFFIX,
};
pub use common::mod_bundle_writer::ModBundleWriter;
pub use common::unpacked_mod::UnpackedMod;
pub use conflict::{
    check_mod_conflicts, check_mod_conflicts_from_json, ConflictCheckModInfo, ModConflict,
};
pub use drg::installation::{DRGInstallation, DRGInstallationType};
pub use drgrc::installation::RcInstallation;
pub use installer::{
    check_foreign_paks_by_game_path, check_installed_by_game_path, find_game_pak_by_name,
    install_mods_with_progress, uninstall_mods_by_game_path,
};
pub use progress::{json_value, text, InstallEvent, InstallProgress};
pub use uasset_utils::paths::{
    pak_path_to_game_path, PakPath, PakPathBuf, PakPathComponent, PakPathComponentTrait,
};
pub use validation::{is_valid_mod_directory, is_valid_zip};

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct ModInfo {
    pub modio_id: Option<u32>,
    pub name: String,
    pub pak_path: String,
    #[serde(default)]
    pub is_unpacked: bool,
    #[serde(default)]
    pub is_audio_only: bool,
}

pub trait ReadSeek: Read + Seek + Send {}

impl<T: Seek + Read + Send> ReadSeek for T {}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GameKind {
    Drg,
    RogueCore,
}

impl GameKind {
    pub fn from_game_pak_path(game_path: &str) -> Self {
        if game_path.ends_with("RogueCore-Windows.pak") {
            Self::RogueCore
        } else {
            Self::Drg
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallRequest {
    pub game_path: String,
    pub game_kind: GameKind,
    pub mods: Vec<ModInfo>,
    #[serde(default)]
    pub skip_ue4ss: bool,
    #[serde(default)]
    pub ue4ss_zip_path: Option<PathBuf>,
    #[serde(default)]
    pub drg_zip_path: Option<PathBuf>,
    #[serde(default)]
    pub rc_zip_path: Option<PathBuf>,
}

impl InstallRequest {
    pub fn new(
        game_path: String,
        mods: Vec<ModInfo>,
        skip_ue4ss: bool,
        ue4ss_zip_path: Option<String>,
        drg_zip_path: Option<String>,
        rc_zip_path: Option<String>,
    ) -> Self {
        let game_kind = GameKind::from_game_pak_path(&game_path);
        Self {
            game_path,
            game_kind,
            mods,
            skip_ue4ss,
            ue4ss_zip_path: ue4ss_zip_path.map(PathBuf::from),
            drg_zip_path: drg_zip_path.map(PathBuf::from),
            rc_zip_path: rc_zip_path.map(PathBuf::from),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub mod_pak_timestamp: u64,
}
