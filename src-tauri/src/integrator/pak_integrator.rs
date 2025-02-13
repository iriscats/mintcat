use crate::capability::zip::read_files_from_zip_by_extension;
use crate::installation::DRGInstallation;
use crate::integrator::error::{CtxtIoSnafu, CtxtRepakSnafu, IntegrationError};
use crate::integrator::mod_bundle_writer::ModBundleWriter;
use crate::integrator::modio_patch::uninstall_modio;
use crate::integrator::raw_asset::RawAsset;
use crate::integrator::ue4ss_integrate::{install_ue4ss_mod, uninstall_ue4ss};
use crate::integrator::{game_pak_patch, ReadSeek};
use crate::mod_info::{MetaConfig, ModInfo};

use fs_err as fs;
use itertools::Itertools;
use serde::Deserialize;
use snafu::{prelude::*, Whatever};
use std::collections::{HashMap, HashSet};
use std::io::{BufReader, BufWriter, Cursor, ErrorKind, Read, Seek, Write};
use std::path::{Path, PathBuf};
use tracing::info;
use uasset_utils::asset_registry::{AssetRegistry, Readable as _, Writable as _};
use uasset_utils::paths::{PakPath, PakPathBuf, PakPathComponentTrait};
use uasset_utils::splice::{
    extract_tracked_statements, inject_tracked_statements, walk, AssetVersion, TrackedStatement,
};
use unreal_asset::engine_version::EngineVersion;
use unreal_asset::{Asset, AssetBuilder};
use zip::ZipArchive;

pub struct PakIntegrator {
    installation: DRGInstallation,
    fsd_pak: repak::PakReader,
    fsd_pak_reader: BufReader<fs::File>,
    asset_registry: AssetRegistry,
    deferred_assets: HashMap<&'static str, RawAsset>,
    bundle: ModBundleWriter<BufWriter<fs::File>>,
    added_paths: HashSet<String>,
}

impl PakIntegrator {
    pub fn new<P: AsRef<Path>>(fsd_path_pak: P) -> Result<Self, IntegrationError> {
        let installation = DRGInstallation::from_pak_path(&fsd_path_pak).map_err(|_| {
            IntegrationError::DrgInstallationNotFound {
                path: fsd_path_pak.as_ref().to_path_buf(),
            }
        })?;

        let mut fsd_pak_reader = BufReader::new(fs::File::open(fsd_path_pak.as_ref())?);
        let fsd_pak = repak::PakBuilder::new().reader(&mut fsd_pak_reader)?;

        let ar_path = "FSD/AssetRegistry.bin";
        let mut asset_registry =
            AssetRegistry::read(&mut Cursor::new(fsd_pak.get(ar_path, &mut fsd_pak_reader)?))
                .map_err(|e| IntegrationError::GenericError { msg: e.to_string() })?;

        let mut deferred_assets = Self::init_deferred_assets();
        Self::collect_game_assets(&fsd_pak, &mut fsd_pak_reader, &mut deferred_assets)?;

        let path_mod_pak = installation.paks_path().join("mods_P.pak");
        info!("installation path {:?}", installation.paks_path());

        let bundle = ModBundleWriter::new(
            BufWriter::new(
                fs::OpenOptions::new()
                    .write(true)
                    .create(true)
                    .truncate(true)
                    .open(&path_mod_pak)?,
            ),
            &fsd_pak.files(),
        )?;

        Ok(Self {
            installation,
            fsd_pak,
            fsd_pak_reader,
            asset_registry,
            deferred_assets,
            bundle,
            added_paths: HashSet::new(),
        })
    }

    fn init_deferred_assets() -> HashMap<&'static str, RawAsset> {
        let deferred_paths = ["FSD/Content/Game/BP_PlayerControllerBase"];
        HashMap::from_iter(
            deferred_paths
                .iter()
                .map(|&path| (path, RawAsset::default())),
        )
    }

    fn collect_game_assets(
        pak: &repak::PakReader,
        reader: &mut (impl Read + Seek),
        assets: &mut HashMap<&str, RawAsset>,
    ) -> Result<(), IntegrationError> {
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

    #[tracing::instrument(skip_all)]
    pub fn install(mut self, mods: Vec<(ModInfo, PathBuf)>) -> Result<(), IntegrationError> {
        for (mod_info, path) in &mods {
            self.process_mod(mod_info, path)?;
        }

        self.apply_pcb_patch()?;
        self.write_mint_files()?;
        self.serialize_asset_registry()?;
        self.bundle.finish()?;

        info!(
            "{} mods installed to {}",
            mods.len(),
            self.installation.paks_path().join("mods_P.pak").display()
        );

        Ok(())
    }

    fn process_mod(&mut self, mod_info: &ModInfo, path: &Path) -> Result<(), IntegrationError> {
        let (mut pak_buf, dll_buf) = self.load_mod_files(mod_info, path)?;
        self.process_pak_files(mod_info, &mut pak_buf)?;
        //self.process_dll_files(mod_info, &mut dll_buf)?;
        Ok(())
    }

    fn load_mod_files(
        &self,
        mod_info: &ModInfo,
        path: &Path,
    ) -> Result<(Box<dyn ReadSeek>, Option<Box<dyn ReadSeek>>), IntegrationError> {
        let mut buf = [0; 4];
        let mut file = fs::File::open(path).with_context(|_| CtxtIoSnafu {
            mod_info: mod_info.clone(),
        })?;
        file.read_exact(&mut buf).with_context(|_| CtxtIoSnafu {
            mod_info: mod_info.clone(),
        })?;

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
                Err(IntegrationError::MissingPakFile {
                    mod_info: mod_info.clone(),
                })
            }
        } else {
            Ok((Box::new(BufReader::new(file)), None))
        }
    }

    fn process_pak_files(
        &mut self,
        mod_info: &ModInfo,
        pak_buf: &mut Box<dyn ReadSeek>,
    ) -> Result<(), IntegrationError> {
        let pak = repak::PakBuilder::new()
            .reader(pak_buf)
            .with_context(|_| CtxtRepakSnafu {
                mod_info: mod_info.clone(),
            })?;

        let mount = PakPath::new(pak.mount_point());
        let pak_files = self.normalize_pak_paths(mod_info, &pak, &mount)?;

        self.process_asset_registry(mod_info, &pak, &pak_files, pak_buf)?;
        self.write_mod_assets(mod_info, pak, pak_files, pak_buf)?;
        Ok(())
    }

    fn process_dll_files(
        &mut self,
        mod_info: &ModInfo,
        dll_buf: &mut Box<dyn ReadSeek>,
    ) -> Result<(), IntegrationError> {

        Ok(())
    }

    fn normalize_pak_paths(
        &self,
        mod_info: &ModInfo,
        pak: &repak::PakReader,
        mount: &PakPath,
    ) -> Result<HashMap<PathBuf, String>, IntegrationError> {
        pak.files()
            .into_iter()
            .map(|p| {
                let full_path = mount.join(&p);
                let normalized = full_path.strip_prefix("../../../").map_err(|_| {
                    IntegrationError::ModfileInvalidPrefix {
                        mod_info: mod_info.clone(),
                        modfile_path: full_path.to_string(),
                    }
                })?;

                // 将 UTF-8 Path 转换为标准 PathBuf
                let std_path = PathBuf::from(normalized.as_str());

                Ok((std_path, p))
            })
            .collect()
    }

    fn process_asset_registry(
        &mut self,
        mod_info: &ModInfo,
        pak: &repak::PakReader,
        pak_files: &HashMap<PathBuf, String>,
        pak_buf: &mut Box<dyn ReadSeek>
    ) -> Result<(), IntegrationError> {
        for (normalized, pak_path) in pak_files {
            if let Some("uasset" | "umap") = normalized.extension().and_then(|e| e.to_str()) {

                if pak_files.contains_key(&normalized.with_extension("uexp")) {

                    let uasset =
                        pak.get(pak_path,  pak_buf)
                            .with_context(|_| CtxtRepakSnafu {
                                mod_info: mod_info.clone(),
                            })?;

                    let uexp = pak
                        .get(
                            &PakPath::new(pak_path).with_extension("uexp").to_string(),
                             pak_buf,
                        )
                        .with_context(|_| CtxtRepakSnafu {
                            mod_info: mod_info.clone(),
                        })?;

                    let asset = AssetBuilder::new(Cursor::new(uasset), EngineVersion::VER_UE4_27)
                        .bulk(Cursor::new(uexp))
                        .skip_data(true)
                        .build()?;

                    self.asset_registry
                        .populate(normalized.with_extension("").to_str().unwrap(), &asset)
                        .map_err(|e| IntegrationError::CtxtGenericError {
                            source: e.into(),
                            mod_info: mod_info.clone(),
                        })?;
                }
            }
        }
        Ok(())
    }

    fn write_mod_assets(
        &mut self,
        mod_info: &ModInfo,
        pak: repak::PakReader,
        pak_files: HashMap<PathBuf, String>,
        pak_buf: &mut Box<dyn ReadSeek>,
    ) -> Result<(), IntegrationError> {
        for (normalized, pak_path) in pak_files {
            let lowercase = normalized.to_str().unwrap().to_lowercase();
            if self.added_paths.contains(&lowercase) {
                continue;
            }

            let file_data = pak
                .get(&pak_path, pak_buf)
                .with_context(|_| CtxtRepakSnafu {
                    mod_info: mod_info.clone(),
                })?;

            self.bundle
                .write_file(&file_data, normalized.to_str().unwrap())?;
            self.added_paths.insert(lowercase);
        }
        Ok(())
    }

    fn apply_pcb_patch(&mut self) -> Result<(), IntegrationError> {
        let path = "FSD/Content/Game/BP_PlayerControllerBase";
        let mut asset = self.deferred_assets[path].parse()?;

        game_pak_patch::hook_pcb(&mut asset)
            .map_err(|e| IntegrationError::GenericError { msg: e.to_string() })?;

        self.bundle
            .write_asset(asset, &path)
            .map_err(|e| IntegrationError::GenericError { msg: e.to_string() })?;

        Ok(())
    }

    fn write_mint_files(&mut self) -> Result<(), IntegrationError> {
        let integration_dir = include_dir::include_dir!("$CARGO_MANIFEST_DIR/assets/integration");

        let mut int_files = HashMap::new();
        Self::collect_integration_files(&integration_dir, &mut int_files);

        for (path, data) in int_files {
            self.bundle.write_file(&*data, &path)?;
        }
        Ok(())
    }

    fn collect_integration_files(dir: &include_dir::Dir, files: &mut HashMap<String, Vec<u8>>) {
        for entry in dir.entries() {
            match entry {
                include_dir::DirEntry::Dir(d) => Self::collect_integration_files(d, files),
                include_dir::DirEntry::File(f) => {
                    files.insert(
                        f.path().to_str().unwrap().replace('\\', "/"),
                        f.contents().to_vec(),
                    );
                }
            }
        }
    }

    fn serialize_asset_registry(&mut self) -> Result<(), IntegrationError> {
        let mut buf = Vec::new();
        self.asset_registry
            .write(&mut buf)
            .map_err(|e| IntegrationError::GenericError { msg: e.to_string() })?;

        self.bundle.write_file(&buf, "FSD/AssetRegistry.bin")?;

        Ok(())
    }
}

impl PakIntegrator {
    #[tracing::instrument(level = "debug", skip(path_pak))]
    pub fn uninstall<P: AsRef<Path>>(
        path_pak: P,
    ) -> Result<(), Whatever> {
        Ok(())
    }
}
