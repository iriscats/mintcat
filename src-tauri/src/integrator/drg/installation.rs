use anyhow::{Context, Result};
use std::path::{Path, PathBuf};

#[derive(Debug, Default)]
pub struct DRGInstallation {
    pub pak_path: PathBuf,
    pub root: PathBuf,
}

#[derive(Debug)]
pub enum DRGInstallationType {
    Steam,
    Xbox,
}

/// Steam App IDs for DRG and Rogue Core Playtest
const STEAM_APP_ID_DRG: u32 = 548430;
const STEAM_APP_ID_RC_PLAYTEST: u32 = 2860770;

impl DRGInstallation {
    /// Find DRG (Deep Rock Galactic) installation via Steam
    pub fn find() -> Option<Self> {
        Self::find_by_steam_app_id(STEAM_APP_ID_DRG, "FSD/Content/Paks/FSD-WindowsNoEditor.pak")
    }

    /// Find Rogue Core Playtest installation via Steam
    /// Path: .../Deep Rock Galactic Rogue Core Playtest/RogueCore/Content/Paks/RogueCore-Windows.pak
    pub fn find_rc() -> Option<Self> {
        Self::find_by_steam_app_id(STEAM_APP_ID_RC_PLAYTEST, "RogueCore/Content/Paks/RogueCore-Windows.pak")
    }

    fn find_by_steam_app_id(app_id: u32, pak_relative_path: &str) -> Option<Self> {
        steamlocate::SteamDir::locate()
            .ok()
            .and_then(|steam_dir| {
                steam_dir
                    .find_app(app_id)
                    .ok()
                    .flatten()
                    .map(|(app, library)| library.resolve_app_dir(&app).join(pak_relative_path))
            })
            .and_then(|path| Self::from_pak_path(path).ok())
    }

    pub fn from_pak_path<P: AsRef<Path>>(pak_path: P) -> Result<Self> {
        let pak = pak_path.as_ref();
        let root = pak
            .parent()
            .and_then(Path::parent)
            .and_then(Path::parent)
            .with_context(|| format!("Failed to get pak parent directory: {:?}", pak))?
            .to_path_buf();
        Ok(Self {
            pak_path: pak.to_path_buf(),
            root,
        })
    }

    pub fn install_type(&self) -> DRGInstallationType {
        let pak_name = self.pak_path.file_name().unwrap();
        let name_str = pak_name.to_str().expect("Invalid UTF-8 path name");
        match name_str {
            "FSD-WindowsNoEditor.pak" => DRGInstallationType::Steam,
            "FSD-WinGDK.pak" => DRGInstallationType::Xbox,
            _ => panic!("Unknown installation type: {}", name_str),
        }
    }

    pub fn mod_pak_name(&self) -> PathBuf {
        match self.install_type() {
            DRGInstallationType::Steam => "FSD-WindowsNoEditor_Mods.pak".parse().unwrap(),
            DRGInstallationType::Xbox => "FSD-WinGDK_Mods.pak".parse().unwrap(),
        }
    }

    pub fn binaries_directory(&self) -> PathBuf {
        self.root.join("Binaries").join("Win64")
    }

    pub fn paks_path(&self) -> PathBuf {
        self.root.join("Content").join("Paks")
    }

    #[allow(dead_code)]
    pub fn main_pak(&self) -> PathBuf {
        self.root
            .join("Content")
            .join("Paks")
            .join("FSD-WindowsNoEditor.pak")
    }

    #[allow(dead_code)]
    pub fn modio_directory(&self) -> Option<PathBuf> {
        #[cfg(target_os = "windows")]
        {
            Some(PathBuf::from("C:\\Users\\Public\\mod.io\\2475"))
        }
        #[cfg(target_os = "linux")]
        {
            steamlocate::SteamDir::locate()
                .map(|s| {
                    s.path()
                        .join("steamapps/compatdata/548430/pfx/drive_c/users/Public/mod.io/2475")
                })
                .ok()
        }
        #[cfg(not(any(target_os = "windows", target_os = "linux")))]
        {
            None // TODO
        }
    }
}
