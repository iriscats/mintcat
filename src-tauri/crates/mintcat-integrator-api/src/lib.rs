use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum InstallEvent {
    StatusLog(Value),
    Percent(f32),
    Success(u64),
    Error(Value),
}

pub trait InstallProgress: Send + Sync {
    fn emit(&self, event: InstallEvent) -> anyhow::Result<()>;
}

pub fn text(value: impl Into<String>) -> Value {
    Value::String(value.into())
}

pub fn json_value(value: impl Serialize) -> Value {
    serde_json::to_value(value).unwrap_or_else(|_| Value::Null)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UninstallModsRequest {
    pub game_path: String,
    pub is_delete_ue4ss: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckInstalledRequest {
    pub game_path: String,
    pub install_time: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FindGamePakRequest {
    pub game_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckForeignPaksRequest {
    pub game_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathRequest {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckModConflictsRequest {
    pub mod_list_json: String,
    pub game_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictCheckModInfo {
    pub mod_id: i64,
    pub cache_path: String,
    pub is_unpacked: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModConflict {
    pub mod_id: i64,
    pub conflicting_mods: Vec<i64>,
    pub conflicting_files: Vec<String>,
}
