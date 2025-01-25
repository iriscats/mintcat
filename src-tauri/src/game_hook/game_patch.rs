use crate::capability::hook_resolvers::HookResolution;
use crate::capability::ue_hook_lib::globals::{Globals, GLOBALS, LOG_GUARD};
use crate::logging::setup_logging;
use crate::mod_info::Meta;
use fs_err as fs;
use patternsleuth::resolvers::Context;
use std::{io::BufReader, path::Path};
use tracing::{info, warn};

proxy_dll::proxy_dll!([x3daudio1_7, d3d9], init);
use anyhow::Result;
use crate::game_hook::drg_hooks;

fn init() {
    unsafe {
        patch().ok();
    }
}



unsafe fn patch() -> Result<()> {
    let exe_path = std::env::current_exe().ok();
    let bin_dir = exe_path.as_deref().and_then(Path::parent);

    let guard =
        bin_dir.and_then(|bin_dir| setup_logging(bin_dir.join("mint_hook.log"), "hook").ok());

    if guard.is_none() {
        warn!("failed to set up logging");
    }

    let pak_path = bin_dir
        .and_then(Path::parent)
        .and_then(Path::parent)
        .map(|p| p.join("Content/Paks/mods_P.pak"))
        .context("could not determine pak path")?;

    let mut pak_reader = BufReader::new(fs::File::open(pak_path)?);
    let pak = repak::PakBuilder::new().reader(&mut pak_reader)?;

    let meta_buf = pak.get("meta", &mut pak_reader)?;
    let meta: Meta = postcard::from_bytes(&meta_buf)?;

    #[cfg(target_os = "windows")]
    {
        let image = patternsleuth::process::internal::read_image()?;
        let resolution = image.resolve(HookResolution::resolver())?;
        info!("PS scan: {:#x?}", resolution);

        crate::capability::ue_hook_lib::globals::GLOBALS = Some(Globals { resolution, meta });
        crate::capability::ue_hook_lib::globals::LOG_GUARD.with_borrow_mut(|g| *g = guard);

        drg_hooks::initialize()?;
    }

    info!("hook initialized");

    Ok(())
}
