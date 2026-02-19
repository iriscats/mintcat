//! Rogue Core (UE 5.6) mod 整合：仅合并 mod pak / unpacked，不做 FSD 专用 patch

use crate::capability::zip::read_files_from_zip_by_extension;
use crate::integrator::drg::mod_bundle_writer::ModBundleWriter;
use crate::integrator::drg::unpacked_mod::UnpackedMod;
use crate::integrator::ue4ss::ue4ss_integrate::{install_ue4ss, uninstall_ue4ss};
use crate::integrator::{ModInfo, ReadSeek};
use anyhow::{Context, Result};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufReader, BufWriter, Cursor, Read};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use crate::uasset_utils::asset_registry::{
    AssetRegistry, Dependencies, Names, Readable as _, Store,
};
use crate::uasset_utils::paths::PakPath;
use unreal_asset::engine_version::EngineVersion;
use unreal_asset::AssetBuilder;

use super::installation::RcInstallation;

/// 当游戏主 pak 使用 Oodle 压缩且运行时无法加载 Oodle（如网络超时）时，使用空 AssetRegistry 继续，
/// 仅合并 mod 内的资源到 registry。
fn empty_asset_registry() -> AssetRegistry {
    AssetRegistry {
        version: [0u8; 16],
        version_int: 0,
        hash_version: 0,
        names: Names(indexmap::IndexSet::new()),
        store: Store {
            pair_count: 0,
            texts: vec![],
            nbl_names: vec![],
            names: vec![],
            nbl_export_paths: vec![],
            export_paths: vec![],
            ansi_strings: vec![],
            wide_strings: vec![],
            pairs: vec![],
        },
        asset_data: vec![],
        dependencies: Dependencies {
            dependencies_size: 0,
            dependencies: vec![],
            package_data_buffer_size: 0,
        },
    }
}

fn is_oodle_or_network_error(e: &anyhow::Error) -> bool {
    let msg = format!("{:#}", e);
    msg.contains("Oodle")
        || msg.contains("Timeout")
        || msg.contains("ureq")
        || msg.contains("Global")
}

/// 解析失败但可回退到空 registry 的情况（如 UE5.6 与 uasset_utils 格式/编码差异）
fn is_asset_registry_parse_fallback(e: &anyhow::Error) -> bool {
    let msg = format!("{:#}", e);
    msg.contains("invalid utf-16")
        || msg.contains("lone surrogate")
        || msg.contains("Failed to parse AssetRegistry")
        || msg.contains("unexpected magic")
        || msg.contains("unsupported format")
}


pub struct RcPakIntegrator {
    installation: RcInstallation,
    asset_registry: AssetRegistry,
    bundle: ModBundleWriter<BufWriter<fs::File>>,
    added_paths: HashSet<String>,
    init_space_rig_assets: HashSet<String>,
    init_cave_assets: HashSet<String>,
}

impl RcPakIntegrator {
    pub fn new<P: AsRef<Path>>(game_pak_path: P) -> Result<Self> {
        let pak_path = game_pak_path.as_ref();
        let installation = RcInstallation::from_pak_path(pak_path)
            .context("Failed to determine RC installation")?;
        let ar_path = installation.asset_registry_pak_path();

        let mut reader = BufReader::new(
            fs::File::open(pak_path)
                .with_context(|| format!("Failed to open game pak: {:?}", pak_path))?,
        );
        let rc_pak = repak::PakBuilder::new()
            .reader(&mut reader)
            .context("Failed to parse RC game pak")?;

        let file_list: Vec<String> = rc_pak.files().iter().map(|p| p.as_str().to_string()).collect();

        let asset_registry = match rc_pak.get(ar_path, &mut reader) {
            Ok(ar_bytes) => match AssetRegistry::read(&mut Cursor::new(ar_bytes)) {
                Ok(ar) => ar,
                Err(e) => {
                    let err = e.context("Failed to parse AssetRegistry");
                    if is_asset_registry_parse_fallback(&err) {
                        log::warn!(
                            "RC game pak AssetRegistry parse failed (e.g. format/encoding): {:#}. Using empty registry and merging mod assets only.",
                            err
                        );
                        empty_asset_registry()
                    } else {
                        return Err(err);
                    }
                }
            },
            Err(e) => {
                let err = anyhow::Error::from(e).context("Failed to read AssetRegistry from game pak");
                if is_oodle_or_network_error(&err) {
                    log::warn!(
                        "RC game pak AssetRegistry unavailable (Oodle/network): {:#}. Using empty registry and merging mod assets only.",
                        err
                    );
                    empty_asset_registry()
                } else {
                    return Err(err.context(format!("path: {}", ar_path)));
                }
            }
        };

        let mod_pak_path = installation.paks_path().join(installation.mod_pak_name());
        let bundle = ModBundleWriter::new(
            BufWriter::new(
                fs::OpenOptions::new()
                    .write(true)
                    .create(true)
                    .truncate(true)
                    .open(&mod_pak_path)
                    .with_context(|| format!("Failed to create mod pak: {:?}", mod_pak_path))?,
            ),
            &file_list,
        )
        .context("Failed to initialize mod bundle writer")?;

        Ok(Self {
            installation,
            asset_registry,
            bundle,
            added_paths: HashSet::new(),
            init_space_rig_assets: HashSet::new(),
            init_cave_assets: HashSet::new(),
        })
    }

    fn format_soft_class(&self, path: &Path) -> String {
        let prefix = self.installation.content_prefix_for_path();
        let name = path.file_stem().unwrap().to_string_lossy();
        let relative = path
            .strip_prefix(prefix)
            .unwrap_or(path)
            .to_string_lossy()
            .strip_suffix("uasset")
            .unwrap_or(&*path.to_string_lossy())
            .to_string();
        format!("/Game/{}{}_C", relative, name)
    }

    pub fn install(
        mut self,
        app: AppHandle,
        mods: &mut Vec<ModInfo>,
        skip_ue4ss: bool,
        ue4ss_zip_path: Option<&Path>,
        _rc_zip_path: Option<&Path>,
    ) -> Result<()> {
        let total_percent = 70.0f32;
        let mods_size = mods.len();

        // 有传入 ue4ssl.zip 且未勾选跳过时安装 UE4SS
        if !skip_ue4ss {
            if let Some(zip_path) = ue4ss_zip_path {
                app.emit("status-bar-log", "backend.install.ue4ss").unwrap();
                install_ue4ss(&self.installation.binaries_directory(), Some(zip_path))?;
            }
        }
        // RC.zip 预留：后续可在此处按 DRG 的 DRG.zip 方式做 RC 专用注入

        for (current_index, mod_info) in mods.iter_mut().enumerate() {
            app.emit(
                "status-bar-log",
                json!({ "key": "backend.install.process_mod_start", "name": mod_info.name }),
            )
            .unwrap();
            let current_percent = (current_index as f32 / mods_size as f32) * total_percent + 10.0;
            app.emit("status-bar-percent", current_percent).unwrap();

            if let Err(e) = self.process_mod(mod_info) {
                app.emit(
                    "install-error",
                    json!({ "key": "backend.install.mod_failed", "name": mod_info.name }),
                )
                .unwrap();
                return Err(e);
            }
            app.emit(
                "status-bar-log",
                json!({ "key": "backend.install.process_mod_success", "name": mod_info.name }),
            )
            .unwrap();
        }

        app.emit("status-bar-log", "backend.install.write_mod").unwrap();
        app.emit("status-bar-percent", 90).unwrap();

        self.serialize_asset_registry()?;
        self.bundle.finish().context("Failed to finalize mod pak")?;

        app.emit("status-bar-log", "backend.install.success").unwrap();
        app.emit("status-bar-percent", 100).unwrap();

        let mod_pak_path = self.installation.paks_path().join(self.installation.mod_pak_name());
        let metadata = fs::metadata(&mod_pak_path)
            .context("Failed to get mod pak metadata after install")?;
        let mod_pak_timestamp = metadata
            .modified()
            .context("Failed to get mod pak modified time")?
            .duration_since(std::time::UNIX_EPOCH)
            .context("Failed to calculate timestamp")?
            .as_secs();
        app.emit("install-success", mod_pak_timestamp).unwrap();
        Ok(())
    }

    fn process_mod(&mut self, mod_info: &mut ModInfo) -> Result<()> {
        let path = Path::new(&mod_info.pak_path);

        if mod_info.is_unpacked {
            return self
                .process_unpacked_mod(path)
                .with_context(|| format!("Failed to process unpacked mod: {}", mod_info.name));
        }

        let (mut pak_buf, mut dll_buf) = self
            .load_mod_files(path)
            .with_context(|| format!("Failed to load mod files: {:?}", path))?;
        if let Some(ref mut pak) = pak_buf {
            self.process_pak_files(pak)
                .with_context(|| format!("Failed to process pak for mod: {}", mod_info.name))?;
        }
        if let Some(ref mut dll) = dll_buf {
            crate::integrator::ue4ss::ue4ss_integrate::install_ue4ss_mod(
                &self.installation.binaries_directory(),
                &mod_info.name,
                dll,
            )?;
        }
        Ok(())
    }

    fn process_unpacked_mod(&mut self, mod_path: &Path) -> Result<()> {
        let mut unpacked_mod = UnpackedMod::new(mod_path)
            .with_context(|| format!("Failed to create unpacked mod: {:?}", mod_path))?;
        unpacked_mod
            .load_files(self.installation.content_prefix())
            .with_context(|| format!("Failed to load unpacked mod files: {:?}", mod_path))?;

        let files = unpacked_mod.files();
        let pak_files: HashMap<PathBuf, String> = files
            .keys()
            .map(|p| (PathBuf::from(p), p.clone()))
            .collect();
        self.process_init_asset(&pak_files)?;

        for asset_base in unpacked_mod.get_asset_names() {
            if let Some((uasset_data, uexp_data)) = unpacked_mod.get_asset_pair(&asset_base) {
                let normalized_path = PathBuf::from(&asset_base);
                let asset = AssetBuilder::new(
                    Cursor::new(uasset_data.clone()),
                    EngineVersion::VER_UE4_27,
                )
                .bulk(Cursor::new(uexp_data.clone()))
                .skip_data(true)
                .build()
                .with_context(|| format!("Failed to build asset: {}", asset_base))?;
                self.asset_registry
                    .populate(normalized_path.to_str().unwrap(), &asset)
                    .with_context(|| format!("Failed to populate asset registry for: {:?}", normalized_path))?;
            }
        }

        for (pak_path, data) in unpacked_mod.iter() {
            let lowercase = pak_path.to_lowercase();
            if self.added_paths.contains(&lowercase) {
                continue;
            }
            if pak_path.ends_with("AssetRegistry.bin") || pak_path.ends_with(".ushaderbytecode") {
                continue;
            }
            self.bundle
                .write_file(data, pak_path)
                .with_context(|| format!("Failed to write unpacked mod file: {}", pak_path))?;
            self.added_paths.insert(lowercase);
        }
        Ok(())
    }

    fn load_mod_files(
        &self,
        path: &Path,
    ) -> Result<(Option<Box<dyn ReadSeek>>, Option<Box<dyn ReadSeek>>)> {
        let mut buf = [0u8; 4];
        let mut file = fs::File::open(path)
            .with_context(|| format!("Failed to open mod file: {:?}", path))?;
        file.read_exact(&mut buf)
            .with_context(|| format!("Failed to read mod file header: {:?}", path))?;

        if buf == [0x50, 0x4B, 0x03, 0x04] {
            let mut pak: Option<Box<dyn ReadSeek>> = None;
            let mut dll: Option<Box<dyn ReadSeek>> = None;
            if let Ok(paks) = read_files_from_zip_by_extension(path.to_str().unwrap(), "pak") {
                if let Some((_, data)) = paks.first() {
                    pak = Some(Box::new(Cursor::new(data.clone())));
                }
            }
            if let Ok(dlls) = read_files_from_zip_by_extension(path.to_str().unwrap(), "dll") {
                if let Some((_, data)) = dlls.first() {
                    dll = Some(Box::new(Cursor::new(data.clone())));
                }
            }
            Ok((pak, dll))
        } else {
            Ok((Some(Box::new(BufReader::new(file))), None))
        }
    }

    fn process_pak_files(&mut self, pak_buf: &mut Box<dyn ReadSeek>) -> Result<()> {
        let pak = repak::PakBuilder::new()
            .reader(pak_buf)
            .context("Failed to parse mod pak")?;
        let mount = PakPath::new(pak.mount_point());
        let pak_files = self.normalize_pak_paths(&pak, &mount)?;
        self.process_init_asset(&pak_files)?;
        self.process_asset_registry(&pak, &pak_files, pak_buf)?;
        self.write_mod_assets(pak, pak_files, pak_buf)?;
        Ok(())
    }

    fn process_init_asset(&mut self, pak_files: &HashMap<PathBuf, String>) -> Result<()> {
        for pak_file in pak_files {
            if let Some(filename) = pak_file.0.file_name() {
                let lower = filename.to_string_lossy().to_lowercase();
                if lower == "initspacerig.uasset" {
                    self.init_space_rig_assets
                        .insert(self.format_soft_class(&*pak_file.0));
                }
                if lower == "initcave.uasset" {
                    self.init_cave_assets
                        .insert(self.format_soft_class(&*pak_file.0));
                }
            }
        }
        Ok(())
    }

    fn normalize_pak_paths(
        &self,
        pak: &repak::PakReader,
        mount: &PakPath,
    ) -> Result<HashMap<PathBuf, String>> {
        pak.files()
            .into_iter()
            .map(|p| {
                let full_path = mount.join(&p);
                let normalized = full_path
                    .strip_prefix("../../../")
                    .with_context(|| format!("Invalid pak path: {}", p))?;
                Ok((PathBuf::from(normalized.as_str()), p))
            })
            .collect()
    }

    /// 从 mod pak 中的 uasset/uexp 填充 AssetRegistry。单个 asset 解析失败（如 UE5.6 格式差异）
    /// 时仅跳过并打 log，不中断整包；write_mod_assets 仍会按原始字节写入该文件。
    fn process_asset_registry(
        &mut self,
        pak: &repak::PakReader,
        pak_files: &HashMap<PathBuf, String>,
        pak_buf: &mut Box<dyn ReadSeek>,
    ) -> Result<()> {
        for (normalized, pak_path) in pak_files {
            if let Some("uasset" | "umap") = normalized.extension().and_then(|e| e.to_str()) {
                if !pak_files.contains_key(&normalized.with_extension("uexp")) {
                    continue;
                }
                let uasset = match pak.get(pak_path, pak_buf) {
                    Ok(d) => d,
                    Err(e) => {
                        log::warn!("Skip registry for {}: failed to read uasset: {}", pak_path, e);
                        continue;
                    }
                };
                let uexp = match pak.get(
                    &PakPath::new(pak_path).with_extension("uexp").to_string(),
                    pak_buf,
                ) {
                    Ok(d) => d,
                    Err(e) => {
                        log::warn!("Skip registry for {}: failed to read uexp: {}", pak_path, e);
                        continue;
                    }
                };
                let asset = match AssetBuilder::new(Cursor::new(uasset), EngineVersion::VER_UE4_27)
                    .bulk(Cursor::new(uexp))
                    .skip_data(true)
                    .build()
                {
                    Ok(a) => a,
                    Err(e) => {
                        log::warn!(
                            "Skip registry for {} (e.g. UE5.6 format): {:#}. File will still be written as raw bytes.",
                            pak_path, e
                        );
                        continue;
                    }
                };
                if let Err(e) = self.asset_registry.populate(
                    normalized.with_extension("").to_str().unwrap(),
                    &asset,
                ) {
                    log::warn!("Skip registry populate for {}: {:#}", pak_path, e);
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
    ) -> Result<()> {
        for (pak_file, pak_path) in pak_files {
            let lowercase = pak_file.to_str().unwrap().to_lowercase();
            if self.added_paths.contains(&lowercase) {
                continue;
            }
            if let Some(filename) = pak_file.file_name() {
                if filename == "AssetRegistry.bin" {
                    continue;
                }
                if pak_file.extension().and_then(std::ffi::OsStr::to_str) == Some("ushaderbytecode") {
                    continue;
                }
            }
            let file_data = pak
                .get(&pak_path, pak_buf)
                .with_context(|| format!("Failed to read file from pak: {}", pak_path))?;
            self.bundle
                .write_file(&file_data, pak_file.to_str().unwrap())
                .with_context(|| format!("Failed to write mod file: {:?}", pak_file))?;
            self.added_paths.insert(lowercase);
        }
        Ok(())
    }

    fn serialize_asset_registry(&mut self) -> Result<()> {
        // RC 生成 AssetRegistry.bin 的逻辑暂时屏蔽（UE 5.6 格式兼容未就绪）
        // let mut buf = Vec::new();
        // self.asset_registry
        //     .write(&mut buf)
        //     .context("Failed to serialize asset registry")?;
        // self.bundle
        //     .write_file(&buf, self.installation.asset_registry_pak_path())
        //     .context("Failed to write asset registry to mod pak")?;
        Ok(())
    }

    pub fn check_installed(game_pak_path: String, timestamp: u64) -> Result<String> {
        let installation = RcInstallation::from_pak_path(&game_pak_path)
            .context("Failed to determine RC installation")?;
        let mod_pak_path = installation.paks_path().join(installation.mod_pak_name());
        if mod_pak_path.exists() {
            let metadata = fs::metadata(&mod_pak_path)
                .with_context(|| format!("Failed to get metadata for: {:?}", mod_pak_path))?;
            let mod_pak_timestamp = metadata
                .modified()
                .context("Failed to get mod pak modified time")?
                .duration_since(std::time::UNIX_EPOCH)
                .context("Failed to calculate timestamp")?
                .as_secs();
            if mod_pak_timestamp == timestamp {
                return Ok("mintcat_installed".to_string());
            }
        }
        Ok("no_installed".to_string())
    }

    pub fn uninstall(game_pak_path: String, is_delete_ue4ss: bool) -> Result<()> {
        let installation = RcInstallation::from_pak_path(&game_pak_path)
            .context("Failed to determine RC installation")?;
        let mod_pak_path = installation.paks_path().join(installation.mod_pak_name());
        if mod_pak_path.exists() {
            fs::remove_file(&mod_pak_path)
                .with_context(|| format!("Failed to remove mod pak: {:?}", mod_pak_path))?;
        }
        if is_delete_ue4ss {
            uninstall_ue4ss(&installation.binaries_directory())?;
        }
        Ok(())
    }
}
