use crate::integrator::ReadSeek;
use std::error::Error;
use std::fs;
use std::path::PathBuf;

pub fn install_ue4ss(install_path: &PathBuf) {
    let ue4ss_path = install_path.join("ue4ss");
    println!("{:?}", ue4ss_path);

    if !ue4ss_path.exists() {
        fs::create_dir(&ue4ss_path).unwrap();
    }

    let dll_path = ue4ss_path.join("UE4SSL.dll");
    if !dll_path.exists() {
        let ue4ss_dll = include_bytes!("../../assets/UE4SSL.dll");
        fs::write(dll_path, ue4ss_dll).unwrap();

        let proxy_dll_path = install_path.join("dwmapi.dll");
        let proxy_dll = include_bytes!("../../assets/dwmapi.dll");
        fs::write(proxy_dll_path, proxy_dll).unwrap();

        let mods_path = ue4ss_path.join("mods");
        fs::create_dir(mods_path).unwrap();
    }
}

pub fn install_ue4ss_mod(
    install_path: &PathBuf,
    mod_name: &String,
    mod_data: &mut Box<dyn ReadSeek>,
) {
    let mods_home_path = install_path.join("ue4ss").join("mods");

    let mod_path = mods_home_path.join(mod_name);
    fs::create_dir(&mod_path).unwrap();

    let dll_path = mod_path.join("main.dll");

    let mut content = Vec::new();
    mod_data.read_to_end(&mut content).unwrap();
    fs::write(dll_path, &content).unwrap();
}

pub fn uninstall_ue4ss(install_path: &PathBuf) -> Result<(), Box<dyn Error>> {
    let ue4ss_path = install_path.join("ue4ss");
    if fs::exists(&ue4ss_path)? {
        fs::remove_dir_all(ue4ss_path).unwrap();
    }

    //try to delete other ue4ss file
    let ue4ss_dll = install_path.join("UE4SS.dll");
    if fs::exists(&ue4ss_dll)? {
        fs::remove_file(&ue4ss_dll).unwrap();
    }

    let proxy_dll = install_path.join("dwmapi.dll");
    if fs::exists(&proxy_dll)? {
        fs::remove_file(&proxy_dll).unwrap();
    }

    let ue4ss_mods = install_path.join("mods");
    if fs::exists(&ue4ss_mods)? {
        fs::remove_dir_all(&ue4ss_mods).unwrap();
    }

    Ok(())
}
