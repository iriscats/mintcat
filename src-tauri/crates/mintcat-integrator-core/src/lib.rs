use std::io::{Read, Seek};

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
pub use conflict::{check_mod_conflicts, check_mod_conflicts_from_json};
pub use drg::installation::{DRGInstallation, DRGInstallationType};
pub use drgrc::installation::RcInstallation;
pub use installer::{
    check_foreign_paks_by_game_path, check_installed_by_game_path, find_game_pak_by_name,
    install_mods_with_progress, uninstall_mods_by_game_path,
};
pub use mintcat_integrator_api::{
    json_value, text, CheckForeignPaksRequest, CheckInstalledRequest, CheckModConflictsRequest,
    ConflictCheckModInfo, FindGamePakRequest, GameKind, InstallEvent, InstallProgress,
    InstallRequest, InstallResult, ModConflict, ModInfo, PathRequest, UninstallModsRequest,
};
pub use uasset_utils::paths::{
    pak_path_to_game_path, PakPath, PakPathBuf, PakPathComponent, PakPathComponentTrait,
};
pub use validation::{is_valid_mod_directory, is_valid_zip};

pub trait ReadSeek: Read + Seek + Send {}

impl<T: Seek + Read + Send> ReadSeek for T {}
