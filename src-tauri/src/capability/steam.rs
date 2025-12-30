#[allow(dead_code)]
fn kill_steam() {
    #[cfg(windows)]
    std::thread::spawn(move || {
        use std::process::Command;
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
pub fn check_steam_game(_exe_name: String) -> bool {
    return false;
    #[cfg(windows)]
    {
        let output = Command::new("tasklist")
            .args(&["/FI", format!("IMAGENAME eq {}", exe_name).as_str()])
            .output()
            .unwrap();

        if String::from_utf8_lossy(&output.stdout).contains(exe_name.as_str()) {
            true
        } else {
            false
        }
    }
}

#[tauri::command]
pub fn launch_steam_game() {
    #[cfg(target_os = "windows")]
    {
        let game_id = "548430";
        //let url = format!("steam://run/{}//-disablemodding", game_id);
        let url = format!("steam://run/{}", game_id);
        let status = Command::new("cmd")
            .args(&["/C", "start", "", &url])
            .status()
            .expect("启动游戏失败");

        if status.success() {
            println!("游戏启动成功！");
        } else {
            println!("游戏启动失败！");
        }
    }
}
