use std::fs;
use std::path::PathBuf;
use tracing::info;
use crate::integrator::ReadSeek;

pub fn install_ue4ss(install_path: &PathBuf) {
    info!("install_ue4ss");
    let ue4ss_path = install_path.join("ue4ss");
    fs::create_dir(&ue4ss_path).unwrap();

    let dll_path = ue4ss_path.join("UE4SSL.dll");
    let ue4ss_dll = include_bytes!("../../assets/UE4SSL.dll");
    fs::write(dll_path, ue4ss_dll).unwrap();

    // let ini_path = ue4ss_path.join("UE4SS-settings.ini");
    // let ue4ss_ini = include_bytes!("../../assets/UE4SS-settings.ini");
    // fs::write(ini_path, ue4ss_ini).unwrap();

    let mods_path = ue4ss_path.join("mods");
    fs::create_dir(mods_path).unwrap();
}

pub fn install_ue4ss_mod(install_path: &PathBuf, mod_name: &String, mod_data: &mut Box<dyn ReadSeek>) {
    info!("install_ue4ss_mod");
    let mods_home_path = install_path.join("ue4ss").join("mods");

    let mod_path = mods_home_path.join(mod_name);
    fs::create_dir(&mod_path).unwrap();

    // let enable_txt_path = mod_path.join("enabled.txt");
    // fs::write(enable_txt_path, "").unwrap();

    // let dll_dir_path = mod_path.join("dlls");
    // fs::create_dir(&dll_dir_path).unwrap();

    let dll_path = mod_path.join("main.dll");

    let mut content = Vec::new();
    mod_data.read_to_end(&mut content).unwrap();
    fs::write(dll_path, &content).unwrap();
}


pub fn uninstall_ue4ss(install_path: &PathBuf) {
    info!("uninstall_ue4ss");
    let ue4ss_path = install_path.join("ue4ss");
    if fs::exists(&ue4ss_path).expect("REASON") {
        fs::remove_dir_all(ue4ss_path).unwrap();
    }

    //try to delete other ue4ss file
    let ue4ss_dll = install_path.join("UE4SS.dll");
    if fs::exists(&ue4ss_dll).expect("REASON") {
        fs::remove_file(&ue4ss_dll).unwrap();
    }

    let proxy_dll = install_path.join("dwmapi.dll");
    if fs::exists(&proxy_dll).expect("REASON") {
        fs::remove_file(&proxy_dll).unwrap();
    }

    let ue4ss_mods = install_path.join("mods");
    if fs::exists(&ue4ss_mods).expect("REASON") {
        fs::remove_dir_all(&ue4ss_mods).unwrap();
    }
}