use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::io::{Cursor, Read, Seek};
use std::path::Path;

pub mod drg;
pub mod drgrc;
mod ue4ss;

/// Infix inserted between the game pak stem and the sanitized mod name for audio paks.
/// Example: `FSD-WindowsNoEditor_audio_BetterJukebox_P.pak`
pub const AUDIO_PAK_INFIX: &str = "_audio_";
pub const AUDIO_PAK_SUFFIX: &str = "_P.pak";

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct ModInfo {
    pub modio_id: Option<u32>,
    pub name: String,
    pub pak_path: String,
    /// Whether this mod is an unpacked directory (contains Content folder with uasset/uexp files)
    #[serde(default)]
    pub is_unpacked: bool,
    /// Whether this mod is audio-only (no blueprint resources), eligible for direct pak placement
    #[serde(default)]
    pub is_audio_only: bool,
}

pub trait ReadSeek: Read + Seek + Send {}

impl<T: Seek + Read + Send> ReadSeek for T {}

/// Sanitize mod name for use in pak filenames (keep only alphanumeric, underscore, hyphen).
pub fn sanitize_mod_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect()
}

/// Generate the pak filename for a directly-placed audio mod.
/// `game_pak_stem` is the game main pak's file stem, e.g. "FSD-WindowsNoEditor" or "RogueCore-Windows".
pub fn audio_pak_filename(game_pak_stem: &str, mod_name: &str) -> String {
    format!(
        "{}{}{}{}",
        game_pak_stem,
        AUDIO_PAK_INFIX,
        sanitize_mod_name(mod_name),
        AUDIO_PAK_SUFFIX
    )
}

/// Check if a pak filename matches the MintCat audio pak naming pattern.
/// Pattern: `{GamePakStem}_audio_{ModName}_P.pak`
pub fn is_mintcat_audio_pak(filename: &str) -> bool {
    filename.contains(AUDIO_PAK_INFIX) && filename.ends_with(AUDIO_PAK_SUFFIX)
}

/// Remove all MintCat audio pak files from the given Paks directory.
pub fn cleanup_audio_paks(paks_dir: &Path) -> Result<()> {
    if let Ok(entries) = std::fs::read_dir(paks_dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if is_mintcat_audio_pak(name) {
                    std::fs::remove_file(entry.path())
                        .with_context(|| format!("Failed to remove audio pak: {:?}", entry.path()))?;
                }
            }
        }
    }
    Ok(())
}

/// Verify that pak data contains no blueprint init assets (InitSpaceRig/InitCave)
/// by reading only the pak index, not file contents.
pub fn verify_audio_only_from_bytes(pak_data: &[u8]) -> Result<bool> {
    let mut cursor = Cursor::new(pak_data);
    let pak = repak::PakBuilder::new()
        .reader(&mut cursor)
        .context("Failed to parse pak for audio verification")?;

    for file_path in pak.files() {
        let lower = file_path.to_lowercase();
        if lower.ends_with("initspacerig.uasset") || lower.ends_with("initcave.uasset") {
            return Ok(false);
        }
    }
    Ok(true)
}

/// Verify that a pak file on disk is audio-only by reading its index.
pub fn verify_audio_only_pak_file(path: &Path) -> Result<bool> {
    let file = std::fs::File::open(path)
        .with_context(|| format!("Failed to open pak for audio verification: {:?}", path))?;
    let mut reader = std::io::BufReader::new(file);
    let pak = repak::PakBuilder::new()
        .reader(&mut reader)
        .context("Failed to parse pak for audio verification")?;

    for file_path in pak.files() {
        let lower = file_path.to_lowercase();
        if lower.ends_with("initspacerig.uasset") || lower.ends_with("initcave.uasset") {
            return Ok(false);
        }
    }
    Ok(true)
}
