pub(crate) mod error;
mod game_patch;
mod mod_bundle_writer;
mod modio;
mod raw_asset;
mod ue4ss;

use fs_err as fs;
use std::collections::{HashMap, HashSet};
use std::io::{BufReader, BufWriter, Cursor, ErrorKind, Read, Seek, Write};
use std::path::{Path, PathBuf};

use mint_lib::mod_info::{ApprovalStatus, Meta, MetaConfig, MetaMod, SemverVersion};
use mint_lib::DRGInstallation;
use serde::Deserialize;
use snafu::{prelude::*, Whatever};
use tracing::info;
use uasset_utils::asset_registry::{AssetRegistry, Readable as _, Writable as _};
use uasset_utils::paths::{PakPath, PakPathBuf, PakPathComponentTrait};
use uasset_utils::splice::{
    extract_tracked_statements, inject_tracked_statements, walk, AssetVersion, TrackedStatement,
};
use unreal_asset::engine_version::EngineVersion;
use unreal_asset::{Asset, AssetBuilder};
use zip::ZipArchive;

use crate::integrate::error::{CtxtIoSnafu, CtxtRepakSnafu, GenericSnafu, IntegrationError};
use crate::integrate::mod_bundle_writer::ModBundleWriter;
use crate::integrate::raw_asset::RawAsset;
use crate::mod_lints::LintError;
use crate::providers::{ModInfo, ProviderError, ReadSeek};

static INTEGRATION_DIR: include_dir::Dir<'_> =
    include_dir::include_dir!("$CARGO_MANIFEST_DIR/assets/integration");

#[tracing::instrument(skip_all)]
pub fn integrate<P: AsRef<Path>>(
    path_pak: P,
    config: MetaConfig,
    mods: Vec<(ModInfo, PathBuf)>,
) -> Result<(), IntegrationError> {
    let Ok(installation) = DRGInstallation::from_pak_path(&path_pak) else {
        return Err(IntegrationError::DrgInstallationNotFound {
            path: path_pak.as_ref().to_path_buf(),
        });
    };
    let path_mod_pak = installation.paks_path().join("mods_P.pak");
    info!("installation path {:?}", installation.paks_path());

    let mut fsd_pak_reader = BufReader::new(fs::File::open(path_pak.as_ref())?);
    let fsd_pak = repak::PakBuilder::new().reader(&mut fsd_pak_reader)?;

    let ar_path = "FSD/AssetRegistry.bin";
    let mut asset_registry =
        AssetRegistry::read(&mut Cursor::new(fsd_pak.get(ar_path, &mut fsd_pak_reader)?))
            .map_err(|e| IntegrationError::GenericError { msg: e.to_string() })?;

    let mut other_deferred = vec![];
    let mut deferred = |path| {
        other_deferred.push(path);
        path
    };

    let pcb_path = "FSD/Content/Game/BP_PlayerControllerBase";
    let patch_paths = [
        "FSD/Content/Game/BP_GameInstance",
        "FSD/Content/Game/SpaceRig/BP_PlayerController_SpaceRig",
        "FSD/Content/Game/StartMenu/Bp_StartMenu_PlayerController",
        "FSD/Content/UI/Menu_DeepDives/ITM_DeepDives_Join",
        "FSD/Content/UI/Menu_ServerList/_MENU_ServerList",
        "FSD/Content/UI/Menu_ServerList/WND_JoiningModded",
    ];
    let escape_menu_path = deferred("FSD/Content/UI/Menu_EscapeMenu/MENU_EscapeMenu");
    let modding_tab_path = deferred("FSD/Content/UI/Menu_EscapeMenu/Modding/MENU_Modding");
    let server_list_entry_path = deferred("FSD/Content/UI/Menu_ServerList/ITM_ServerList_Entry");

    let mut deferred_assets: HashMap<&str, RawAsset> = HashMap::from_iter(
        [pcb_path]
            .iter()
            .chain(patch_paths.iter())
            .chain(other_deferred.iter())
            .map(|path| (*path, RawAsset::default())),
    );

    // collect assets from game pak file
    for (path, asset) in &mut deferred_assets {
        // TODO repak should return an option...
        asset.uasset = match fsd_pak.get(&format!("{path}.uasset"), &mut fsd_pak_reader) {
            Ok(file) => Ok(Some(file)),
            Err(repak::Error::MissingEntry(_)) => Ok(None),
            Err(e) => Err(e),
        }?;
        asset.uexp = match fsd_pak.get(&format!("{path}.uexp"), &mut fsd_pak_reader) {
            Ok(file) => Ok(Some(file)),
            Err(repak::Error::MissingEntry(_)) => Ok(None),
            Err(e) => Err(e),
        }?;
    }

    let mut bundle = ModBundleWriter::new(
        BufWriter::new(
            fs::OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(true)
                .open(&path_mod_pak)?,
        ),
        &fsd_pak.files(),
    )?;

    #[cfg(feature = "hook")]
    {
        let path_hook_dll = installation
            .binaries_directory()
            .join(installation.installation_type.hook_dll_name());
        let hook_dll = include_bytes!(env!("CARGO_CDYLIB_FILE_HOOK_hook"));
        if path_hook_dll
            .metadata()
            .map(|m| m.len() != hook_dll.len() as u64)
            .unwrap_or(true)
        {
            fs::write(&path_hook_dll, hook_dll)?;
        }

        ue4ss::uninstall_ue4ss(&installation.binaries_directory());
        ue4ss::install_ue4ss(&installation.binaries_directory());
    }

    let mut init_spacerig_assets = HashSet::new();
    let mut init_cave_assets = HashSet::new();
    let mut added_paths = HashSet::new();

    for (mod_info, path) in &mods {
        let raw_mod_file = fs::File::open(path).with_context(|_| CtxtIoSnafu {
            mod_info: mod_info.clone(),
        })?;

        // check file is zip by magic number
        let mut buf = BufReader::new(raw_mod_file);
        let mut magic = [0; 4];
        buf.read_exact(&mut magic).with_context(|_| CtxtIoSnafu {
            mod_info: mod_info.clone(),
        })?;

        // is zip file
        let mut pak_buf;
        let mut dll_buf: Option<Box<dyn ReadSeek>> = None;
        if magic == [0x50, 0x4B, 0x03, 0x04] {
            let raw_mod_file = fs::File::open(path).with_context(|_| CtxtIoSnafu {
                mod_info: mod_info.clone(),
            })?;
            pak_buf = get_pak_from_data(Box::new(BufReader::new(raw_mod_file)), "pak", true)
                .map_err(|e| {
                    if let IntegrationError::IoError { source } = e {
                        IntegrationError::CtxtIoError {
                            source,
                            mod_info: mod_info.clone(),
                        }
                    } else {
                        e
                    }
                })?;

            let raw_mod_file = fs::File::open(path).with_context(|_| CtxtIoSnafu {
                mod_info: mod_info.clone(),
            })?;


            dll_buf = get_pak_from_data(Box::new(BufReader::new(raw_mod_file)), "dll", false)
                .map_err(|e| {
                    if let IntegrationError::IoError { source } = e {
                        IntegrationError::CtxtIoError {
                            source,
                            mod_info: mod_info.clone(),
                        }
                    } else {
                        e
                    }
                })?;
        }
        // is pak file
        else {
            let raw_mod_file = fs::File::open(path).with_context(|_| CtxtIoSnafu {
                mod_info: mod_info.clone(),
            })?;
            pak_buf = Some(Box::new(BufReader::new(raw_mod_file)));
        }

        info!("process mod {:?}", mod_info.name);
        if dll_buf.is_none() {
            info!("mod {:?} no dll", mod_info.name);
        } else {
            ue4ss::install_ue4ss_mod(
                &installation.binaries_directory(),
                &mod_info.name,
                &mut dll_buf.unwrap(),
            );
        }

        let pak = repak::PakBuilder::new()
            .reader(&mut pak_buf.unwrap())
            .with_context(|_| CtxtRepakSnafu {
                mod_info: mod_info.clone(),
            })?;

        let mount = PakPath::new(pak.mount_point());

        let pak_files = pak
            .files()
            .into_iter()
            .map(|p| -> Result<_, IntegrationError> {
                let j = mount.join(&p);
                Ok((
                    j.strip_prefix("../../../")
                        .map_err(|_| IntegrationError::ModfileInvalidPrefix {
                            mod_info: mod_info.clone(),
                            modfile_path: j.to_string(),
                        })?
                        .to_path_buf(),
                    p,
                ))
            })
            .collect::<Result<HashMap<_, _>, _>>()?;

        for (normalized, pak_path) in &pak_files {
            match normalized.extension() {
                Some("uasset" | "umap")
                    if pak_files.contains_key(&normalized.with_extension("uexp")) =>
                {
                    let uasset =
                        pak.get(pak_path, &mut pak_buf)
                            .with_context(|_| CtxtRepakSnafu {
                                mod_info: mod_info.clone(),
                            })?;

                    let uexp = pak
                        .get(
                            PakPath::new(pak_path).with_extension("uexp").as_str(),
                            &mut pak_buf,
                        )
                        .with_context(|_| CtxtRepakSnafu {
                            mod_info: mod_info.clone(),
                        })?;

                    let asset = AssetBuilder::new(Cursor::new(uasset), EngineVersion::VER_UE4_27)
                        .bulk(Cursor::new(uexp))
                        .skip_data(true)
                        .build()?;
                    asset_registry
                        .populate(normalized.with_extension("").as_str(), &asset)
                        .map_err(|e| IntegrationError::CtxtGenericError {
                            source: e.into(),
                            mod_info: mod_info.clone(),
                        })?;
                }
                _ => {}
            }
        }

        for (normalized, pak_path) in pak_files {
            let lowercase = normalized.as_str().to_ascii_lowercase();
            if added_paths.contains(&lowercase) {
                continue;
            }

            if let Some(filename) = normalized.file_name() {
                if filename == "AssetRegistry.bin" {
                    continue;
                }
                if normalized.extension() == Some("ushaderbytecode") {
                    continue;
                }
                let lower = filename.to_lowercase();
                if lower == "initspacerig.uasset" {
                    init_spacerig_assets.insert(format_soft_class(&normalized));
                }
                if lower == "initcave.uasset" {
                    init_cave_assets.insert(format_soft_class(&normalized));
                }
            }

            let file_data = pak
                .get(&pak_path, &mut pak_buf)
                .with_context(|_| CtxtRepakSnafu {
                    mod_info: mod_info.clone(),
                })?;
            if let Some(raw) = normalized
                .as_str()
                .strip_suffix(".uasset")
                .and_then(|path| deferred_assets.get_mut(path))
            {
                raw.uasset = Some(file_data);
            } else if let Some(raw) = normalized
                .as_str()
                .strip_suffix(".uexp")
                .and_then(|path| deferred_assets.get_mut(path))
            {
                raw.uexp = Some(file_data);
            } else {
                bundle.write_file(&file_data, normalized.as_str())?;
                added_paths.insert(lowercase);
            }
        }
    }

    {
        let mut pcb_asset = deferred_assets[&pcb_path].parse()?;
        game_patch::hook_pcb(&mut pcb_asset);
        bundle.write_asset(pcb_asset, pcb_path)?;
    }

    let mut patch_deferred = |path_str: &str,
                              f: fn(&mut _) -> Result<(), IntegrationError>|
     -> Result<(), IntegrationError> {
        let mut asset = deferred_assets[path_str].parse()?;
        f(&mut asset)?;
        bundle.write_asset(asset, path_str)
    };

    // apply patches to base assets
    for patch_path in patch_paths {
        patch_deferred(patch_path, game_patch::patch)?;
    }
    patch_deferred(escape_menu_path, game_patch::patch_modding_tab)?;
    patch_deferred(modding_tab_path, game_patch::patch_modding_tab_item)?;
    patch_deferred(server_list_entry_path, game_patch::patch_server_list_entry)?;

    let mut int_files = HashMap::new();
    collect_dir_files(&INTEGRATION_DIR, &mut int_files);

    for (path, data) in &int_files {
        bundle.write_file(data, path)?;
    }

    bundle.write_meta(config, &mods)?;

    let mut buf = vec![];
    asset_registry
        .write(&mut buf)
        .map_err(|e| IntegrationError::GenericError { msg: e.to_string() })?;
    bundle.write_file(&buf, ar_path)?;

    bundle.finish()?;

    info!(
        "{} mods installed to {}",
        mods.len(),
        path_mod_pak.display()
    );

    Ok(())
}

fn collect_dir_files(dir: &'static include_dir::Dir, collect: &mut HashMap<String, &[u8]>) {
    for entry in dir.entries() {
        match entry {
            include_dir::DirEntry::Dir(dir) => {
                collect_dir_files(dir, collect);
            }
            include_dir::DirEntry::File(file) => {
                collect.insert(
                    file.path().to_str().unwrap().replace('\\', "/"),
                    file.contents(),
                );
            }
        }
    }
}

fn format_soft_class<P: AsRef<PakPath>>(path: P) -> String {
    let path = path.as_ref();
    let name = path.file_stem().unwrap();
    format!(
        "/Game/{}{}_C",
        path.strip_prefix("FSD/Content")
            .unwrap()
            .as_str()
            .strip_suffix("uasset")
            .unwrap(),
        name
    )
}

pub(crate) fn get_pak_from_data(
    mut data: Box<dyn ReadSeek>,
    file_name: &str,
    is_need: bool,
) -> Result<Option<Box<dyn ReadSeek>>, IntegrationError> {
    if let Ok(mut archive) = ZipArchive::new(&mut data) {
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).unwrap();

            if let Some(p) = file.enclosed_name() {
                if file.is_file() && p.extension() == Some(std::ffi::OsStr::new(file_name)) {
                    let mut buf = vec![];
                    file.read_to_end(&mut buf)?;
                    return Ok(Some(Box::new(Cursor::new(buf))));
                }
            }
        }

        if is_need {
            Err(IntegrationError::GenericError {
                msg: "File no found in zip file".to_string(),
            })
        } else {
            Ok(None)
        }
    } else {
        data.rewind()?;
        Err(IntegrationError::GenericError {
            msg: "failed to open zip file".to_string(),
        })
    }
}

/// Why does the uninstall function require a list of Modio mod IDs?
/// Glad you ask. The official integration enables *every mod the user has installed* once it gets
/// re-enabled. We do the user a favor and collect all the installed mods and explicitly add them
/// back to the config so they will be disabled when the game is launched again. Since we have
/// Modio IDs anyway, with just a little more effort we can make the 'uninstall' button work as an
/// 'install' button for the official integration. Best anti-feature ever.
#[tracing::instrument(level = "debug", skip(path_pak))]
pub fn uninstall<P: AsRef<Path>>(path_pak: P, modio_mods: HashSet<u32>) -> Result<(), Whatever> {
    let installation = DRGInstallation::from_pak_path(path_pak)
        .whatever_context("failed to get DRG installation")?;
    let path_mods_pak = installation.paks_path().join("mods_P.pak");

    match std::fs::remove_file(&path_mods_pak) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e),
    }
    .with_whatever_context(|_| format!("failed to remove {}", path_mods_pak.display()))?;
    #[cfg(feature = "hook")]
    {
        let path_hook_dll = installation
            .binaries_directory()
            .join(installation.installation_type.hook_dll_name());

        match std::fs::remove_file(&path_hook_dll) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e),
        }
        .with_whatever_context(|_| format!("failed to remove {}", path_hook_dll.display()))?;
    }

    crate::integrate::modio::uninstall_modio(&installation, modio_mods).ok();
    ue4ss::uninstall_ue4ss(&installation.binaries_directory());
    Ok(())
}
