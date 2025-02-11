use serde::Deserialize;
use snafu::{ResultExt, Whatever};
use std::collections::HashSet;
use std::fs;
use crate::installation::DRGInstallation;

#[tracing::instrument(level = "debug")]
pub fn uninstall_modio(
    installation: &DRGInstallation,
    modio_mods: HashSet<u32>,
) -> Result<(), Whatever> {
    #[derive(Debug, Deserialize)]
    struct ModioState {
        #[serde(rename = "Mods")]
        mods: Vec<ModioMod>,
    }
    #[derive(Debug, Deserialize)]
    struct ModioMod {
        #[serde(rename = "ID")]
        id: u32,
    }
    let Some(modio_dir) = installation.modio_directory() else {
        return Ok(());
    };
    let modio_state: ModioState = serde_json::from_reader(std::io::BufReader::new(
        fs::File::open(modio_dir.join("metadata/state.json"))
            .whatever_context("failed to read mod.io metadata/state.json")?,
    ))
    .whatever_context("failed to parse mod.io metadata/state.json")?;
    let config_path = installation
        .root
        .join("Saved/Config/WindowsNoEditor/GameUserSettings.ini");
    let mut config = ini::Ini::load_from_file(&config_path)
        .whatever_context("failed to load GameUserSettings.ini")?;

    let ignore_keys = HashSet::from(["CurrentModioUserId"]);

    config
        .entry(Some("/Script/FSD.UserGeneratedContent".to_string()))
        .or_insert_with(Default::default);
    if let Some(ugc_section) = config.section_mut(Some("/Script/FSD.UserGeneratedContent")) {
        let local_mods = installation
            .root
            .join("Mods")
            .read_dir()
            .whatever_context("failed to read game Mods directory")?
            .map(|f| {
                let f = f.whatever_context("failed to read game Mods subdirectory")?;
                Ok((!f.path().is_file())
                    .then_some(f.file_name().to_string_lossy().to_string().to_string()))
            })
            .collect::<Result<Vec<Option<String>>, Whatever>>()?;
        let to_remove = HashSet::from_iter(ugc_section.iter().map(|(k, _)| k))
            .difference(&ignore_keys)
            .map(|&k| k.to_owned())
            .collect::<Vec<String>>();
        for r in to_remove {
            let _ = ugc_section.remove_all(r);
        }
        for m in modio_state.mods {
            ugc_section.insert(
                m.id.to_string(),
                if modio_mods.contains(&m.id) {
                    "True"
                } else {
                    "False"
                },
            );
        }
        for m in local_mods.into_iter().flatten() {
            ugc_section.insert(m, "False");
        }
        ugc_section.insert("CheckGameversion", "False");
    }

    config
        .write_to_file_opt(
            config_path,
            ini::WriteOption {
                line_separator: ini::LineSeparator::CRLF,
                ..Default::default()
            },
        )
        .whatever_context("failed to write to GameUserSettings.ini")?;
    Ok(())
}
