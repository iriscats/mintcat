use std::error::Error;
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

impl DRGInstallation {
    pub fn find() -> Option<Self> {
        //C:\XboxGames\Deep Rock Galactic\Content\FSD\Content\Paks\FSD-WinGDK.pak
        steamlocate::SteamDir::locate()
            .ok()
            .and_then(|steam_dir| {
                steam_dir
                    .find_app(548430)
                    .ok()
                    .flatten()
                    .map(|(app, library)| {
                        library
                            .resolve_app_dir(&app)
                            .join("FSD/Content/Paks/FSD-WindowsNoEditor.pak")
                    })
            })
            .and_then(|path| Self::from_pak_path(path).ok())
    }

    pub fn from_pak_path<P: AsRef<Path>>(pak_path: P) -> Result<Self, Box<dyn Error>> {
        let root = pak_path
            .as_ref()
            .parent()
            .and_then(Path::parent)
            .and_then(Path::parent)
            .expect("failed to get pak parent directory")
            .to_path_buf();
        Ok(Self {
            pak_path: pak_path.as_ref().to_path_buf(),
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

    pub fn main_pak(&self) -> PathBuf {
        self.root
            .join("Content")
            .join("Paks")
            .join("FSD-WindowsNoEditor.pak")
    }

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
