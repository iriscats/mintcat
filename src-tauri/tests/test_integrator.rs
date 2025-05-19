use mintcat_lib::integrator::mod_info::ModInfo;
use mintcat_lib::integrator::pak_integrator::PakIntegrator;
use std::path::PathBuf;
use std::ptr::null;

#[test]
fn test_pak_integrator() {
    let integrator_result =
        PakIntegrator::new("/Users/bytedance/Desktop/data/Content/Paks/FSD-WindowsNoEditor.pak");
    match integrator_result {
        Ok(integrator) => {
            let mut mods: Vec<(ModInfo)> = Vec::new();

            //遍历 mods文件夹获取全部文件路径
            let mut mod_dir = PathBuf::from("/Users/bytedance/Desktop/data/mods");
            if mod_dir.is_dir() {
                for entry in mod_dir.read_dir().unwrap() {
                    let entry = entry.unwrap();
                    let path = entry.path();
                    if path.is_file() {
                        mods.push(
                            (ModInfo {
                                name: "test".to_string(),
                                modio_id: None,
                                pak_path: entry.path().to_str().unwrap().to_string(),
                            }),
                        );
                    }
                }
            }

            // let install_result = integrator.install(mods);
            // match install_result {
            //     Ok(_) => println!("Installation succeeded."),
            //     Err(e) => eprintln!("Installation failed: {}", e),
            // }
        }
        Err(e) => eprintln!("Failed to create integrator: {}", e),
    }
}
