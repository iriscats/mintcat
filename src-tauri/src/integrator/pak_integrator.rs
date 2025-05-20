use crate::capability::zip::read_files_from_zip_by_extension;
use crate::integrator::game_pak_patch::{
    get_deferred_paths, ESCAPE_MENU_PATH, MODDING_TAB_PATH, PATCH_PATHS, PCB_PATH,
    SERVER_LIST_ENTRY_PATH,
};
use crate::integrator::installation::{DRGInstallation, DRGInstallationType};
use crate::integrator::mod_bundle_writer::ModBundleWriter;
use crate::integrator::mod_info::ModInfo;
use crate::integrator::raw_asset::RawAsset;
use crate::integrator::ue4ss_integrate::{install_ue4ss, install_ue4ss_mod, uninstall_ue4ss};
use crate::integrator::{game_pak_patch, ReadSeek};
use std::collections::{HashMap, HashSet};
use std::error::Error;
use std::fs;
use std::io::{BufReader, BufWriter, Cursor, Read, Seek};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use uasset_utils::asset_registry::{AssetRegistry, Readable as _, Writable as _};
use uasset_utils::paths::PakPath;
use unreal_asset::engine_version::EngineVersion;
use unreal_asset::AssetBuilder;

static FSD_AR_PATH: &str = "FSD/AssetRegistry.bin";

pub struct PakIntegrator {
    installation: DRGInstallation,
    asset_registry: AssetRegistry,
    bundle: ModBundleWriter<BufWriter<fs::File>>,
    deferred_assets: HashMap<&'static str, RawAsset>, // 延迟加载并且等待被 Patch 的资产
    added_paths: HashSet<String>,                     // 防止重复写入
    init_space_rig_assets: HashSet<String>,
    init_cave_assets: HashSet<String>,
}

fn format_soft_class(path: &Path) -> String {
    let name = path.file_stem().unwrap().to_string_lossy();
    format!(
        "/Game/{}{}_C",
        path.strip_prefix("FSD/Content")
            .unwrap()
            .to_string_lossy()
            .strip_suffix("uasset")
            .unwrap(),
        name
    )
}

impl PakIntegrator {
    pub fn new<P: AsRef<Path>>(fsd_path_pak: P) -> Result<Self, Box<dyn Error>> {
        let mut fsd_pak_reader = BufReader::new(fs::File::open(fsd_path_pak.as_ref())?);
        let fsd_pak = repak::PakBuilder::new().reader(&mut fsd_pak_reader)?;

        let asset_registry = AssetRegistry::read(&mut Cursor::new(
            fsd_pak.get(FSD_AR_PATH, &mut fsd_pak_reader)?,
        ))?;

        let mut deferred_assets = Self::init_deferred_assets();
        Self::load_deferred_assets_for_game_pak(
            &fsd_pak,
            &mut fsd_pak_reader,
            &mut deferred_assets,
        )?;

        let installation = DRGInstallation::from_pak_path(&fsd_path_pak)?;
        let mod_pak_path = installation.paks_path().join(installation.mod_pak_name());
        let bundle = ModBundleWriter::new(
            BufWriter::new(
                fs::OpenOptions::new()
                    .write(true)
                    .create(true)
                    .truncate(true)
                    .open(&mod_pak_path)?,
            ),
            &fsd_pak.files(),
        )?;

        Ok(Self {
            installation,
            asset_registry,
            deferred_assets,
            bundle,
            added_paths: HashSet::new(),
            init_space_rig_assets: HashSet::new(),
            init_cave_assets: HashSet::new(),
        })
    }

    fn init_deferred_assets() -> HashMap<&'static str, RawAsset> {
        let deferred_paths = get_deferred_paths();
        HashMap::from_iter(
            deferred_paths
                .iter()
                .map(|&path| (path, RawAsset::default())),
        )
    }

    fn load_deferred_assets_for_game_pak(
        pak: &repak::PakReader,
        reader: &mut (impl Read + Seek),
        assets: &mut HashMap<&str, RawAsset>,
    ) -> Result<(), Box<dyn Error>> {
        for (path, asset) in assets.iter_mut() {
            asset.uasset = match pak.get(&format!("{path}.uasset"), reader) {
                Ok(f) => Some(f),
                Err(repak::Error::MissingEntry(_)) => None,
                Err(e) => return Err(e.into()),
            };
            asset.uexp = match pak.get(&format!("{path}.uexp"), reader) {
                Ok(f) => Some(f),
                Err(repak::Error::MissingEntry(_)) => None,
                Err(e) => return Err(e.into()),
            };
        }
        Ok(())
    }

    pub fn install(
        mut self,
        app: AppHandle,
        mods: &mut Vec<ModInfo>,
    ) -> Result<(), Box<dyn Error>> {
        let total_percent = 70.0;
        let mods_size = mods.len();

        for (current_index, mod_info) in mods.iter_mut().enumerate() {
            app.emit(
                "status-bar-log",
                format!("Start Process Mod: {} ...", mod_info.name),
            )
            .unwrap();

            let current_percent = (current_index as f32 / mods_size as f32) * total_percent + 10.0;
            app.emit("status-bar-percent", current_percent).unwrap();
            let result = self.process_mod(mod_info);
            match result {
                Ok(_) => {
                    app.emit(
                        "status-bar-log",
                        format!("Process Mod: {} Success", mod_info.name),
                    )
                    .unwrap();
                }
                Err(e) => {
                    app.emit("install-error", format!("{}", mod_info.name))
                        .unwrap();
                    return Err(e);
                }
            }
        }

        app.emit("status-bar-log", "Patch Game Pak...").unwrap();
        app.emit("status-bar-percent", 80).unwrap();

        let integration_dir = include_dir::include_dir!("$CARGO_MANIFEST_DIR/assets/integration");
        let mut mint_files = HashMap::new();
        Self::collect_mint_files(&integration_dir, &mut mint_files);

        self.apply_mint_patch(&mut mint_files)?;
        self.apply_pcb_patch()?;
        self.apply_sandbox_patch()?;
        //self.apply_modding_tab_patch()?;
        //self.apply_escape_menu_patch()?;
        //self.apply_server_list_entry_patch()?;

        app.emit("status-bar-log", "Write Mod...").unwrap();
        app.emit("status-bar-percent", 90).unwrap();

        self.write_mint_files(&mut mint_files)?;
        self.serialize_asset_registry()?;
        self.bundle.finish()?;

        let hook_dll_path = self
            .installation
            .binaries_directory()
            .join("x3daudio1_7.dll");
        let hook_dll = include_bytes!("../../assets/x3daudio1_7.dll");
        fs::write(hook_dll_path, hook_dll).unwrap();

        app.emit("status-bar-log", "Install Mod Success").unwrap();
        app.emit("status-bar-percent", 100).unwrap();

        let mod_pak_path = self
            .installation
            .paks_path()
            .join(self.installation.mod_pak_name());

        //recovery_modio(&self.installation).unwrap();

        let metadata = fs::metadata(&mod_pak_path)?;
        let mod_pak_timestamp = metadata
            .modified()?
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();

        app.emit("install-success", mod_pak_timestamp).unwrap();

        Ok(())
    }

    fn process_mod(&mut self, mod_info: &mut ModInfo) -> Result<(), Box<dyn Error>> {
        let (mut pak_buf, mut dll_buf) = self.load_mod_files(mod_info.pak_path.as_ref())?;
        self.process_pak_files(&mut pak_buf)?;
        if let Some(mut dll_buf) = dll_buf.take() {
            self.process_dll_files(mod_info, &mut dll_buf)?;
        }
        Ok(())
    }

    fn load_mod_files(
        &self,
        path: &Path,
    ) -> Result<(Box<dyn ReadSeek>, Option<Box<dyn ReadSeek>>), Box<dyn Error>> {
        let mut buf = [0; 4];
        let mut file = fs::File::open(path)?;
        file.read_exact(&mut buf)?;

        if buf == [0x50, 0x4B, 0x03, 0x04] {
            let mut pak: Option<Box<dyn ReadSeek>> = None;
            let mut dll: Option<Box<dyn ReadSeek>> = None;

            if let Ok(paks) = read_files_from_zip_by_extension(path.to_str().unwrap(), "pak") {
                if let Some((_, data)) = paks.get(0) {
                    pak = Some(Box::new(Cursor::new(data.clone())));
                }
            }

            if let Ok(dlls) = read_files_from_zip_by_extension(path.to_str().unwrap(), "dll") {
                if let Some((_, data)) = dlls.get(0) {
                    dll = Some(Box::new(Cursor::new(data.clone())));
                }
            }

            if let Some(pak_data) = pak {
                Ok((pak_data, dll))
            } else {
                Ok((Box::new(BufReader::new(file)), None))
            }
        } else {
            Ok((Box::new(BufReader::new(file)), None))
        }
    }

    fn process_pak_files(&mut self, pak_buf: &mut Box<dyn ReadSeek>) -> Result<(), Box<dyn Error>> {
        let pak = repak::PakBuilder::new().reader(pak_buf)?;

        let mount = PakPath::new(pak.mount_point());
        let pak_files = self.normalize_pak_paths(&pak, &mount)?;

        self.process_init_asset(&pak_files)?;
        self.process_asset_registry(&pak, &pak_files, pak_buf)?;
        self.write_mod_assets(pak, pak_files, pak_buf)?;
        Ok(())
    }

    fn process_init_asset(
        &mut self,
        pak_files: &HashMap<PathBuf, String>,
    ) -> Result<(), Box<dyn Error>> {
        for pak_file in pak_files {
            if let Some(filename) = pak_file.0.file_name() {
                let lower = filename.to_string_lossy().to_lowercase();
                if lower == "initspacerig.uasset" {
                    self.init_space_rig_assets
                        .insert(format_soft_class(&*pak_file.0));
                }
                if lower == "initcave.uasset" {
                    self.init_cave_assets
                        .insert(format_soft_class(&*pak_file.0));
                }
            }
        }
        Ok(())
    }

    fn process_dll_files(
        &mut self,
        mod_info: &mut ModInfo,
        dll_buf: &mut Box<dyn ReadSeek>,
    ) -> Result<(), Box<dyn Error>> {
        install_ue4ss(&self.installation.binaries_directory());
        install_ue4ss_mod(
            &self.installation.binaries_directory(),
            &mod_info.name,
            dll_buf,
        );
        Ok(())
    }

    fn normalize_pak_paths(
        &self,
        pak: &repak::PakReader,
        mount: &PakPath,
    ) -> Result<HashMap<PathBuf, String>, Box<dyn Error>> {
        pak.files()
            .into_iter()
            .map(|p| {
                let full_path = mount.join(&p);
                let normalized = full_path.strip_prefix("../../../")?;
                let std_path = PathBuf::from(normalized.as_str());
                Ok((std_path, p))
            })
            .collect()
    }

    fn process_asset_registry(
        &mut self,
        pak: &repak::PakReader,
        pak_files: &HashMap<PathBuf, String>,
        pak_buf: &mut Box<dyn ReadSeek>,
    ) -> Result<(), Box<dyn Error>> {
        for (normalized, pak_path) in pak_files {
            if let Some("uasset" | "umap") = normalized.extension().and_then(|e| e.to_str()) {
                if pak_files.contains_key(&normalized.with_extension("uexp")) {
                    let uasset = pak.get(pak_path, pak_buf)?;
                    let uexp = pak.get(
                        &PakPath::new(pak_path).with_extension("uexp").to_string(),
                        pak_buf,
                    )?;
                    let asset = AssetBuilder::new(Cursor::new(uasset), EngineVersion::VER_UE4_27)
                        .bulk(Cursor::new(uexp))
                        .skip_data(true)
                        .build()?;

                    self.asset_registry
                        .populate(normalized.with_extension("").to_str().unwrap(), &asset)?;
                }
            }
        }
        Ok(())
    }

    fn write_mod_assets(
        &mut self,
        pak: repak::PakReader,
        pak_files: HashMap<PathBuf, String>,
        pak_buf: &mut Box<dyn ReadSeek>,
    ) -> Result<(), Box<dyn Error>> {
        for (pak_file, pak_path) in pak_files {
            let lowercase = pak_file.to_str().unwrap().to_lowercase();
            if self.added_paths.contains(&lowercase) {
                continue;
            }

            if let Some(filename) = pak_file.file_name() {
                if filename == "AssetRegistry.bin" {
                    continue;
                }
                if pak_file.extension().and_then(std::ffi::OsStr::to_str) == Some("ushaderbytecode")
                {
                    continue;
                }
            }

            let file_data = pak.get(&pak_path, pak_buf)?;
            self.bundle
                .write_file(&file_data, pak_file.to_str().unwrap())?;

            self.added_paths.insert(lowercase);
        }
        Ok(())
    }

    fn apply_mint_patch(
        &mut self,
        mint_files: &mut HashMap<String, Vec<u8>>,
    ) -> Result<(), Box<dyn Error>> {
        let mint_path = (
            "FSD/Content/_AssemblyStorm/ModIntegration/MI_SpawnMods.uasset",
            "FSD/Content/_AssemblyStorm/ModIntegration/MI_SpawnMods.uexp",
        );

        let mut asset = unreal_asset::Asset::new(
            Cursor::new(mint_files[mint_path.0].clone()),
            Some(Cursor::new(mint_files[mint_path.1].clone())),
            EngineVersion::VER_UE4_27,
            None,
            false,
        )?;

        game_pak_patch::patch_init_actors(
            &mut asset,
            self.init_space_rig_assets.clone(),
            self.init_cave_assets.clone(),
        );
        self.bundle.write_asset(
            asset,
            "FSD/Content/_AssemblyStorm/ModIntegration/MI_SpawnMods",
        )?;

        Ok(())
    }

    fn apply_pcb_patch(&mut self) -> Result<(), Box<dyn Error>> {
        let mut asset = self.deferred_assets[PCB_PATH].parse()?;
        game_pak_patch::hook_pcb(&mut asset)?;
        self.bundle.write_asset(asset, &PCB_PATH)?;
        Ok(())
    }

    fn apply_sandbox_patch(&mut self) -> Result<(), Box<dyn Error>> {
        PATCH_PATHS.iter().for_each(|path| {
            let mut asset = self.deferred_assets[path].parse().unwrap();
            game_pak_patch::patch_sandbox(&mut asset).expect("TODO: panic message");

            self.bundle
                .write_asset(asset, path)
                .expect("TODO: panic message");
        });

        Ok(())
    }

    fn apply_escape_menu_patch(&mut self) -> Result<(), Box<dyn Error>> {
        let mut asset = self.deferred_assets[ESCAPE_MENU_PATH].parse()?;
        game_pak_patch::patch_modding_tab(&mut asset)?;
        self.bundle.write_asset(asset, &ESCAPE_MENU_PATH)?;
        Ok(())
    }

    fn apply_modding_tab_patch(&mut self) -> Result<(), Box<dyn Error>> {
        let mut asset = self.deferred_assets[MODDING_TAB_PATH].parse()?;
        game_pak_patch::patch_modding_tab_item(&mut asset)?;
        self.bundle.write_asset(asset, &MODDING_TAB_PATH)?;
        Ok(())
    }

    fn apply_server_list_entry_patch(&mut self) -> Result<(), Box<dyn Error>> {
        let mut asset = self.deferred_assets[SERVER_LIST_ENTRY_PATH].parse()?;
        game_pak_patch::patch_server_list_entry(&mut asset)?;
        self.bundle.write_asset(asset, &SERVER_LIST_ENTRY_PATH)?;
        Ok(())
    }

    fn write_mint_files(
        &mut self,
        mint_files: &mut HashMap<String, Vec<u8>>,
    ) -> Result<(), Box<dyn Error>> {
        let mint_path = (
            "FSD/Content/_AssemblyStorm/ModIntegration/MI_SpawnMods.uasset",
            "FSD/Content/_AssemblyStorm/ModIntegration/MI_SpawnMods.uexp",
        );
        mint_files.remove(mint_path.0);
        mint_files.remove(mint_path.1);
        for (path, data) in mint_files {
            self.bundle.write_file(&*data, &path)?;
        }
        Ok(())
    }

    fn collect_mint_files(dir: &include_dir::Dir, files: &mut HashMap<String, Vec<u8>>) {
        for entry in dir.entries() {
            match entry {
                include_dir::DirEntry::Dir(d) => Self::collect_mint_files(d, files),
                include_dir::DirEntry::File(f) => {
                    files.insert(
                        f.path().to_str().unwrap().replace('\\', "/"),
                        f.contents().to_vec(),
                    );
                }
            }
        }
    }

    fn serialize_asset_registry(&mut self) -> Result<(), Box<dyn Error>> {
        let mut buf = Vec::new();
        self.asset_registry.write(&mut buf)?;
        self.bundle.write_file(&buf, FSD_AR_PATH)?;
        Ok(())
    }

    pub fn check_installed(fsd_path_pak: String, timestamp: u64) -> Result<String, Box<dyn Error>> {
        let installation = DRGInstallation::from_pak_path(&fsd_path_pak)?;

        let old_mod_pak_path = installation.paks_path().join("mods_P.pak");
        //let hook_dll_path = installation.binaries_directory().join("x3daudio1_7.dll");

        if old_mod_pak_path.exists() {
            return Ok("old_version_mint_installed".parse().unwrap());
        }

        let mod_pak_path = installation.paks_path().join(installation.mod_pak_name());
        if mod_pak_path.exists() {
            let metadata = fs::metadata(&mod_pak_path)?;
            let mod_pak_timestamp = metadata
                .modified()?
                .duration_since(std::time::UNIX_EPOCH)?
                .as_secs();
            if mod_pak_timestamp == timestamp {
                return Ok("mintcat_installed".parse().unwrap());
            }
        }

        Ok("no_installed".parse().unwrap())
    }

    pub fn uninstall(fsd_path_pak: String, is_delete_ue4ss: bool) -> Result<(), Box<dyn Error>> {
        let installation = DRGInstallation::from_pak_path(&fsd_path_pak)?;

        let old_mod_pak_path = installation.paks_path().join("mods_P.pak");
        let mod_pak_path = installation.paks_path().join(installation.mod_pak_name());
        let hook_dll_path = installation.binaries_directory().join("x3daudio1_7.dll");

        if fs::exists(&old_mod_pak_path)? {
            fs::remove_file(&old_mod_pak_path).unwrap();
        }

        if fs::exists(&mod_pak_path)? {
            fs::remove_file(&mod_pak_path).unwrap();
        }

        if fs::exists(&hook_dll_path)? {
            fs::remove_file(&hook_dll_path).unwrap();
        }

        if is_delete_ue4ss {
            uninstall_ue4ss(&installation.binaries_directory())?;
        }

        Ok(())
    }
}
