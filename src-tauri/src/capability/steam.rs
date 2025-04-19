use keyvalues_parser::Vdf;
use std::process::Command;

use std::fs;

// 存在 548430 并且 LaunchOptions 已经设置为 -disablemodding 则返回 true
fn check_launch_options(store: &mut Vdf) -> Option<()> {
    let software = store.value.get_mut_obj()?.get_mut("Software");
    let value = software?.first_mut()?.get_mut_obj()?.get_mut("valve");
    let steam = value?.first_mut()?.get_mut_obj()?.get_mut("Steam");
    let apps = steam?.first_mut()?.get_mut_obj()?.get_mut("apps");
    let drg = apps?.first_mut()?.get_mut_obj()?.get_mut("548430");
    match drg {
        None => return Some(()),
        _ => {}
    }

    let drg_obj = drg?.first_mut()?.get_mut_obj()?;
    match drg_obj.get_mut("LaunchOptions") {
        Some(launch_options) => {
            let launch_options_str = launch_options.first_mut()?.get_mut_str()?.to_mut();
            if launch_options_str == "-disablemodding" {
                return Some(());
            }
        }
        _ => {}
    }

    None
}

// 设置 LaunchOptions 为 -disablemodding
fn set_launch_options(store: &mut Vdf, new_option: String) -> Option<()> {
    let software = store.value.get_mut_obj()?.get_mut("Software");
    let value = software?.first_mut()?.get_mut_obj()?.get_mut("valve");
    let steam = value?.first_mut()?.get_mut_obj()?.get_mut("Steam");
    let apps = steam?.first_mut()?.get_mut_obj()?.get_mut("apps");
    let drg = apps?.first_mut()?.get_mut_obj()?.get_mut("548430");
    let drg_obj = drg?.first_mut()?.get_mut_obj()?;
    match drg_obj.get_mut("LaunchOptions") {
        Some(launch_options) => {
            let launch_options_str = launch_options.first_mut()?.get_mut_str()?.to_mut();
            *launch_options_str = new_option;
        }
        None => {
            drg_obj.insert(
                "LaunchOptions".into(),
                vec![keyvalues_parser::Value::Str(new_option.into())],
            );
        }
    }

    Some(())
}

fn kill_steam() {
    //#[cfg(windows)]
    std::thread::spawn(move || {
        loop {
            // 添加进程存在性检查
            let output = Command::new("tasklist")
                .args(&["/FI", "IMAGENAME eq steam.exe"])
                .output()
                .unwrap();

            if String::from_utf8_lossy(&output.stdout).contains("steam.exe") {
                Command::new("taskkill")
                    .args(&["/F", "/IM", "steam.exe"])
                    .status()
                    .unwrap();

                println!("已找到并关闭Steam进程");
            } else {
                println!("未找到正在运行的Steam进程");
                break;
            }
        }
    });
}

#[tauri::command]
pub fn set_steam_launch_options()  {
    let steam = steamlocate::SteamDir::locate();
    let userdata_dir = steam.unwrap().path().join("userdata");

    //获取 userdata_dir 下全部个人用户文件夹
    let userdata_dirs = fs::read_dir(userdata_dir).unwrap();
    for entry in userdata_dirs {
        let entry = entry.unwrap();
        let path = entry.path();
        if path.is_dir() {
            let local_config_path = path.join("config").join("localconfig.vdf");
            let vdf_text = fs::read_to_string(&local_config_path).unwrap();
            let mut store = Vdf::parse(&vdf_text).unwrap();

            if let Some(_) = check_launch_options(&mut store) {
                continue;
            }

            kill_steam();
            set_launch_options(&mut store, "-disablemodding".to_string());
            fs::write(local_config_path, store.to_string()).unwrap();
        }
    }
    
}
