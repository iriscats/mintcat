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
    #[serde(default)]
    pub compress_mod_pak: bool,
}

impl InstallRequest {
    pub fn new(
        game_path: String,
        mods: Vec<ModInfo>,
        skip_ue4ss: bool,
        ue4ss_zip_path: Option<String>,
        drg_zip_path: Option<String>,
        rc_zip_path: Option<String>,
        compress_mod_pak: bool,
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
            compress_mod_pak,
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
    #[serde(alias = "mod_id")]
    pub mod_id: i64,
    #[serde(alias = "cache_path")]
    pub cache_path: String,
    #[serde(alias = "is_unpacked")]
    pub is_unpacked: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ModConflict {
    pub mod_id: i64,
    pub conflicting_mods: Vec<i64>,
    pub conflicting_files: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::{ConflictCheckModInfo, ModConflict};

    #[test]
    fn conflict_check_mod_info_accepts_snake_case_frontend_payload() {
        let mods: Vec<ConflictCheckModInfo> = serde_json::from_str(
            r#"[{"mod_id":1,"cache_path":"C:/mods/a.pak","is_unpacked":false}]"#,
        )
        .expect("snake_case conflict mod info should parse");

        assert_eq!(mods[0].mod_id, 1);
        assert_eq!(mods[0].cache_path, "C:/mods/a.pak");
        assert!(!mods[0].is_unpacked);
    }

    #[test]
    fn conflict_check_mod_info_still_accepts_camel_case_payload() {
        let mods: Vec<ConflictCheckModInfo> =
            serde_json::from_str(r#"[{"modId":1,"cachePath":"C:/mods/a.pak","isUnpacked":false}]"#)
                .expect("camelCase conflict mod info should parse");

        assert_eq!(mods[0].mod_id, 1);
        assert_eq!(mods[0].cache_path, "C:/mods/a.pak");
        assert!(!mods[0].is_unpacked);
    }

    #[test]
    fn mod_conflict_serializes_for_existing_frontend_contract() {
        let value = serde_json::to_value(ModConflict {
            mod_id: 1,
            conflicting_mods: vec![2],
            conflicting_files: vec!["fsd/content/a.uasset".to_string()],
        })
        .expect("mod conflict should serialize");

        assert!(value.get("mod_id").is_some());
        assert!(value.get("conflicting_mods").is_some());
        assert!(value.get("conflicting_files").is_some());
    }
}
