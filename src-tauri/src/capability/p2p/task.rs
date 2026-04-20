use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Context, Result};
use librqbit::{AddTorrent, AddTorrentOptions, AddTorrentResponse, ManagedTorrent};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncReadExt;

/// 与 HTTP 下载任务保持一致的进度事件。前端 `DownloadApi.downloadViaP2P` 会透传到回调。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct P2pProgress {
    pub download_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed_bytes_per_sec: f64,
    pub eta_secs: f64,
    /// 已连接的 peer 数量，用于前端可视化；HTTP 下载无此字段。
    pub peers: u32,
    /// 上行速度，用于统计面板。
    pub upload_bytes_per_sec: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct P2pStatus {
    pub download_id: String,
    pub status: String,
    pub error: Option<String>,
    pub file_path: Option<String>,
}

/// 在 Session 中添加 torrent 并等待完成。
///
/// - `source`: 可以是 `magnet:?...`、`http(s)://.../foo.torrent`，或内置 `file:`/直接的 .torrent 字节
///   （当前仅支持前两种 URL 形式，足以覆盖 `checkUpdatesBatch` 下发的 magnet/torrentUrl）。
/// - `output_folder`: 写入目录，torrent 中的文件会以自己的文件名保存在这里。
/// - `expected_filename`: 若提供，在完成后尝试把 torrent 文件重命名为该名；用于保证与 InternalAssetService 约定的路径一致。
/// - `expected_md5`: 可选；完成后整体 MD5 校验，失败则删除文件并返错。
pub async fn add_and_wait(
    app: AppHandle,
    session: Arc<librqbit::Session>,
    download_id: String,
    source: String,
    output_folder: PathBuf,
    expected_filename: Option<String>,
    expected_md5: Option<String>,
    first_piece_timeout_secs: u64,
) -> Result<PathBuf> {
    emit_status(&app, &download_id, "starting", None, None);

    let opts = AddTorrentOptions {
        output_folder: Some(output_folder.to_string_lossy().to_string()),
        overwrite: true,
        paused: false,
        ..Default::default()
    };

    let resp = session
        .add_torrent(AddTorrent::Url(source.clone().into()), Some(opts))
        .await
        .map_err(|e| anyhow!("add_torrent failed: {e:?}"))?;

    let handle = extract_handle(resp)
        .context("add_torrent did not return a managed handle (already-managed/list-only?)")?;

    // 轮询进度并发出事件；若 `first_piece_timeout_secs` 内没有任何 piece 下载则放弃，
    // 让上层回退 HTTP。Web Seed 一般能让 BT 连接快速拿到第一块，所以超时同时保护了两种失败路径：
    // DHT/tracker 无响应、Web Seed 连不上。
    let started_at = Instant::now();
    let mut last_progress_emit = Instant::now();
    let mut last_progress_bytes = 0u64;
    let mut last_sample_time = Instant::now();
    let first_piece_deadline = started_at + Duration::from_secs(first_piece_timeout_secs);

    let mut last_uploaded_bytes = 0u64;
    let output_file_path = loop {
        let stats = handle.stats();

        if let Some(err) = stats.error.as_deref() {
            let msg = format!("torrent error: {err}");
            emit_status(&app, &download_id, "failed", Some(msg.clone()), None);
            return Err(anyhow!(msg));
        }

        // 进度事件：速率按 progress_bytes 差分计算，避开各版本 LiveStats 内部结构差异
        let now = Instant::now();
        if now.duration_since(last_progress_emit) >= Duration::from_millis(500) {
            let dt = now.duration_since(last_sample_time).as_secs_f64().max(0.001);
            let speed = (stats.progress_bytes.saturating_sub(last_progress_bytes)) as f64 / dt;
            let up_speed = (stats.uploaded_bytes.saturating_sub(last_uploaded_bytes)) as f64 / dt;

            let eta = if speed > 0.0 && stats.total_bytes > stats.progress_bytes {
                (stats.total_bytes - stats.progress_bytes) as f64 / speed
            } else {
                0.0
            };

            let _ = app.emit(
                "p2p-progress",
                P2pProgress {
                    download_id: download_id.clone(),
                    downloaded_bytes: stats.progress_bytes,
                    total_bytes: stats.total_bytes,
                    speed_bytes_per_sec: speed,
                    eta_secs: eta,
                    peers: 0,
                    upload_bytes_per_sec: up_speed,
                },
            );

            last_progress_emit = now;
            last_sample_time = now;
            last_progress_bytes = stats.progress_bytes;
            last_uploaded_bytes = stats.uploaded_bytes;
        }

        // 首 piece 超时：未收到任何进度就退出
        if stats.progress_bytes == 0 && now > first_piece_deadline {
            emit_status(
                &app,
                &download_id,
                "failed",
                Some("no progress within first-piece timeout".to_string()),
                None,
            );
            return Err(anyhow!("p2p no-progress timeout"));
        }

        if stats.finished {
            // 找到实际写出的单文件（UE4SSL.zip/DRG.zip/RC.zip 都是单文件 torrent）
            let file_path = resolve_output_file(&handle, &output_folder)
                .ok_or_else(|| anyhow!("cannot resolve output file after completion"))?;
            break file_path;
        }

        tokio::time::sleep(Duration::from_millis(250)).await;
    };

    // 如调用方要求把文件重命名为特定名称（和 InternalAssetService 的 destPath 对齐）
    let final_path = if let Some(expected) = expected_filename {
        let target = output_folder.join(&expected);
        if output_file_path != target {
            if target.exists() {
                let _ = tokio::fs::remove_file(&target).await;
            }
            tokio::fs::rename(&output_file_path, &target)
                .await
                .with_context(|| format!(
                    "rename {} -> {} failed",
                    output_file_path.display(),
                    target.display()
                ))?;
            target
        } else {
            output_file_path
        }
    } else {
        output_file_path
    };

    if let Some(expected_md5) = expected_md5 {
        let ok = verify_md5(&final_path, &expected_md5).await?;
        if !ok {
            let _ = tokio::fs::remove_file(&final_path).await;
            emit_status(
                &app,
                &download_id,
                "failed",
                Some("md5 mismatch".to_string()),
                None,
            );
            return Err(anyhow!("md5 mismatch for {}", final_path.display()));
        }
    }

    emit_status(
        &app,
        &download_id,
        "completed",
        None,
        Some(final_path.to_string_lossy().to_string()),
    );

    Ok(final_path)
}

fn extract_handle(resp: AddTorrentResponse) -> Option<Arc<ManagedTorrent>> {
    match resp {
        AddTorrentResponse::Added(_, handle) => Some(handle),
        AddTorrentResponse::AlreadyManaged(_, handle) => Some(handle),
        AddTorrentResponse::ListOnly(_) => None,
    }
}

/// 定位 torrent 完成后的本地文件路径。对于单文件 torrent 直接等于 `output_folder/name`；
/// 对于多文件 torrent（当前不使用），选择最大的那个文件作为目标。
fn resolve_output_file(handle: &ManagedTorrent, output_folder: &std::path::Path) -> Option<PathBuf> {
    let meta = handle.metadata.load();
    let meta = meta.as_ref()?;
    let file_infos = &meta.file_infos;
    if file_infos.is_empty() {
        return None;
    }
    // 选最大的 file
    let best = file_infos
        .iter()
        .enumerate()
        .max_by_key(|(_, fi)| fi.len)?;
    let rel = &best.1.relative_filename;
    Some(output_folder.join(rel))
}

async fn verify_md5(path: &std::path::Path, expected_hex: &str) -> Result<bool> {
    let mut file = tokio::fs::File::open(path)
        .await
        .with_context(|| format!("open for md5: {}", path.display()))?;
    let mut hasher = md5::Context::new();
    let mut buf = vec![0u8; 1024 * 1024];
    loop {
        let n = file.read(&mut buf).await?;
        if n == 0 {
            break;
        }
        hasher.consume(&buf[..n]);
    }
    let digest = hasher.compute();
    let actual = format!("{:x}", digest);
    let expected = expected_hex.trim().to_ascii_lowercase();
    Ok(actual == expected)
}

pub(crate) fn emit_status(
    app: &AppHandle,
    download_id: &str,
    status: &str,
    error: Option<String>,
    file_path: Option<String>,
) {
    let _ = app.emit(
        "p2p-status",
        P2pStatus {
            download_id: download_id.to_string(),
            status: status.to_string(),
            error,
            file_path,
        },
    );
}
