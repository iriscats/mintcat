use std::fs::File;
use std::io::{Read, Write};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    downloaded_size: u64,
    total_size: u64,
}

#[tauri::command]
pub fn download_large_file(app: AppHandle, url: String, file_path: String) -> Result<(), String> {
    std::thread::spawn(move || {
        // 初始化HTTP客户端
        let client = reqwest::blocking::Client::new();
        let mut response = match client.get(url).send() {
            Ok(res) => res,
            Err(e) => {
                app.emit("download-api-statue", format!("请求失败: {}", e))
                    .unwrap();
                return;
            }
        };

        // 检查响应状态
        if !response.status().is_success() {
            app.emit(
                "download-api-statue",
                format!("HTTP错误: {}", response.status()),
            )
                .unwrap();
            return;
        }

        // 获取文件总大小
        let total_size = response.content_length().unwrap_or(0);

        // 创建文件
        let mut file = match File::create(file_path) {
            Ok(f) => f,
            Err(e) => {
                app.emit("download-api-statue", format!("创建文件失败: {}", e))
                    .unwrap();
                return;
            }
        };

        // 分块下载
        let mut downloaded = 0;
        let mut buffer = [0u8; 1024 * 1024]; // 2mb 缓冲区

        loop {
            let bytes_read = match response.read(&mut buffer) {
                Ok(0) => break, // 读取结束
                Ok(n) => n,
                Err(e) => {
                    app.emit("download-api-statue", format!("读取失败: {}", e))
                        .unwrap();
                    return;
                }
            };

            if let Err(e) = file.write_all(&buffer[..bytes_read]) {
                app.emit("download-api-statue", format!("写入失败: {}", e))
                    .unwrap();
                return;
            }

            // 更新进度
            downloaded += bytes_read as u64;
            if total_size > 0 {
                //let percent = (downloaded as f64 / total_size as f64 * 100.0) as i32;
                app.emit(
                    "download-api-progress",
                    DownloadProgress {
                        downloaded_size: downloaded,
                        total_size: total_size,
                    },
                )
                    .unwrap();
            }
        }

        app.emit("download-api-statue", "success").unwrap();
    });

    Ok(())
}
