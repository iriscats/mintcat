use mintcat_lib::integrator::pak_integrator::PakIntegrator;
use mintcat_lib::mod_info::ModInfo;
use std::path::PathBuf;

#[test]
fn test_pak_integrator() {
    // ... existing code ...
    let integrator_result =
        PakIntegrator::new("/Users/bytedance/Desktop/data/Content/Paks/FSD-WindowsNoEditor.pak");
    match integrator_result {
        Ok(integrator) => {
            let mut mods: Vec<(ModInfo, PathBuf)> = Vec::new();

            //遍历 mods文件夹获取全部文件路径
            let mut mod_dir = PathBuf::from("/Users/bytedance/Desktop/data/mods");
            if mod_dir.is_dir() {
                for entry in mod_dir.read_dir().unwrap() {
                    let entry = entry.unwrap();
                    let path = entry.path();
                    if path.is_file() {
                        mods.push((
                            ModInfo {
                                provider: "",
                                name: "test".to_string(),
                                modio_tags: None,
                                suggested_require: false,
                                versions: vec![],
                                suggested_dependencies: vec![],
                                modio_id: None,
                            },
                            path,
                        ));
                    }
                }
            }

            let install_result = integrator.install(mods);
            match install_result {
                Ok(_) => println!("Installation succeeded."),
                Err(e) => eprintln!("Installation failed: {}", e),
            }
        }
        Err(e) => eprintln!("Failed to create integrator: {}", e),
    }
    // ... existing code ...
}
