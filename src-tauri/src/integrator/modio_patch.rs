use crate::integrator::installation::DRGInstallation;
use serde::Deserialize;
use std::collections::HashSet;
use std::fs;
use std::io::Error;

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

#[tracing::instrument(level = "debug")]
pub fn recovery_modio(
    installation: &DRGInstallation,
    //modio_mods: HashSet<u32>,
) -> Result<(), Error> {
    let Some(modio_dir) = installation.modio_directory() else {
        return Ok(());
    };
    let modio_state: ModioState = serde_json::from_reader(std::io::BufReader::new(
        fs::File::open(modio_dir.join("metadata/state.json"))
            .expect("failed to read mod.io metadata/state.json"),
    ))
    .expect("failed to parse mod.io metadata/state.json");
    let config_path = installation
        .root
        .join("Saved/Config/WindowsNoEditor/GameUserSettings.ini");
    let mut config =
        ini::Ini::load_from_file(&config_path).expect("failed to load GameUserSettings.ini");

    let ignore_keys = HashSet::from(["CurrentModioUserId"]);

    config
        .entry(Some("/Script/FSD.UserGeneratedContent".to_string()))
        .or_insert_with(Default::default);
    if let Some(ugc_section) = config.section_mut(Some("/Script/FSD.UserGeneratedContent")) {
        let local_mods = installation
            .root
            .join("Mods")
            .read_dir()
            .expect("failed to read game Mods directory")
            .map(|f| {
                let f = f.expect("failed to read game Mods subdirectory");
                Ok((!f.path().is_file())
                    .then_some(f.file_name().to_string_lossy().to_string().to_string()))
            })
            .collect::<Result<Vec<Option<String>>, Error>>()?;

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
                // if modio_mods.contains(&m.id) {
                //     "True"
                // } else {
                    "False"
                //},
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
        .expect("failed to write to GameUserSettings.ini");
    Ok(())
}
