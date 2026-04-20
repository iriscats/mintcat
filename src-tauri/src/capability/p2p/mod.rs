//! BitTorrent P2P 下载模块。
//!
//! 作为 `capability::download` 的加速层：接收 magnet 或 .torrent URL，通过 librqbit 的 DHT/uTP/UPnP +
//! Web Seed (BEP 19) 下载到本地。前端 `DownloadApi.downloadViaP2P` 会在 `InternalAssetService`
//! 中作为 HTTPS 下载的前置尝试，失败/超时时回退 HTTP。
//!
//! 设计约束：
//! - Session 懒加载，没被调用前不会占用端口和 DHT；
//! - 下载完成默认做种（可在设置里关闭），handle 保留在 `downloads` 中；
//! - MD5 终校验与现有 HTTP 路径一致。

mod session;
mod task;

use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

pub use session::{P2pSettings, P2pState};
pub use task::{P2pProgress, P2pStatus};

/// 默认首个 piece 的超时秒数。若在此之前没有任何字节下载，上层会回退 HTTP。
/// 典型 BT 冷启动时间 2-10s，这里给 20s 裕量以容忍较差网络。
const DEFAULT_FIRST_PIECE_TIMEOUT_SECS: u64 = 20;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct P2pDownloadArgs {
    /// magnet:?... 或 https://.../foo.torrent
    pub source: String,
    /// 目标文件绝对路径。librqbit 会把文件写入 `parent(file_path)`，然后本模块将其重命名为 `file_path`。
    pub file_path: String,
    /// 可选的 MD5 终校验（十六进制）；与 HTTP 下载使用相同字段。
    #[serde(default)]
    pub expected_md5: Option<String>,
    /// 首 piece 超时秒数，默认 20；上层可根据网络质量覆盖。
    #[serde(default)]
    pub first_piece_timeout_secs: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct P2pDownloadResult {
    pub download_id: String,
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct P2pGlobalStats {
    pub enabled: bool,
    pub seeding: bool,
    pub upload_limit_bytes_per_sec: Option<u32>,
    pub active_downloads: u32,
    pub seeding_torrents: u32,
}

/// 发起一次 P2P 下载。返回时包括 download_id，进度/状态通过 `p2p-progress` / `p2p-status` 事件推送。
#[tauri::command]
pub async fn p2p_download(
    app: AppHandle,
    state: State<'_, Arc<P2pState>>,
    args: P2pDownloadArgs,
) -> Result<P2pDownloadResult, String> {
    let settings = state.settings_snapshot().await;
    if !settings.enabled {
        return Err("p2p_disabled".to_string());
    }

    let session = state
        .get_or_init_session()
        .await
        .map_err(|e| format!("p2p_init_failed: {e}"))?;

    let file_path = PathBuf::from(&args.file_path);
    let parent = file_path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| state.default_output_dir());
    let file_name = file_path
        .file_name()
        .map(|s| s.to_string_lossy().to_string());

    if !parent.exists() {
        tokio::fs::create_dir_all(&parent)
            .await
            .map_err(|e| format!("create_dir_all failed: {e}"))?;
    }

    let download_id = uuid::Uuid::new_v4().to_string();
    let timeout = args.first_piece_timeout_secs.unwrap_or(DEFAULT_FIRST_PIECE_TIMEOUT_SECS);

    let app_for_task = app.clone();
    let download_id_ret = download_id.clone();
    let download_id_task = download_id.clone();
    let source = args.source.clone();
    let parent_for_task = parent.clone();
    let file_name_for_task = file_name.clone();
    let expected_md5 = args.expected_md5.clone();
    let state_for_task: Arc<P2pState> = (*state).clone();
    let session_for_task = session.clone();

    tauri::async_runtime::spawn(async move {
        match task::add_and_wait(
            app_for_task,
            session_for_task,
            download_id_task.clone(),
            source,
            parent_for_task,
            file_name_for_task,
            expected_md5,
            timeout,
        )
        .await
        {
            Ok(final_path) => {
                log::info!(
                    "[p2p] download {} done: {}",
                    download_id_task,
                    final_path.display()
                );
                // 用户设置为不做种时，完成后立即移除所有已完成的 torrent 以停止上传。
                // 这里批量处理而不是精确到当前任务，因为设置可能在下载中途被切换。
                let settings = state_for_task.settings_snapshot().await;
                if !settings.seed {
                    state_for_task.stop_all_seeding().await;
                }
            }
            Err(e) => {
                log::warn!("[p2p] download {} failed: {e}", download_id_task);
            }
        }
    });

    Ok(P2pDownloadResult {
        download_id: download_id_ret,
        file_path: args.file_path,
    })
}

/// 启停 P2P（关闭后 `p2p_download` 直接返回错误，由前端回退 HTTP）。
#[tauri::command]
pub async fn p2p_set_enabled(
    state: State<'_, Arc<P2pState>>,
    enabled: bool,
) -> Result<(), String> {
    state.set_enabled(enabled).await;
    if !enabled {
        // 关闭 = 不再做种也不再下载；等同于关停 session 释放端口
        state.shutdown().await;
    }
    Ok(())
}

/// 仅切换"做种"；enabled=true 时保持 Session 监听便于下载，但下载完成后不持续上传。
///
/// 关闭做种会把当前所有已完成的 torrent 从 Session 中移除（保留本地文件），立即停止上传。
#[tauri::command]
pub async fn p2p_set_seeding(
    state: State<'_, Arc<P2pState>>,
    seed: bool,
) -> Result<(), String> {
    state.set_seeding(seed).await;
    if !seed {
        state.stop_all_seeding().await;
    }
    Ok(())
}

/// 设置上传限速（字节/秒）；`None` / `0` 表示不限速。
#[tauri::command]
pub async fn p2p_set_upload_limit(
    state: State<'_, Arc<P2pState>>,
    bytes_per_sec: Option<u32>,
) -> Result<(), String> {
    let limit = bytes_per_sec.filter(|v| *v > 0);
    state.set_upload_limit(limit).await;
    Ok(())
}

#[tauri::command]
pub async fn p2p_stats(
    state: State<'_, Arc<P2pState>>,
) -> Result<P2pGlobalStats, String> {
    let settings = state.settings_snapshot().await;
    let (active, seeding_count) = state.torrent_counts().await;
    Ok(P2pGlobalStats {
        enabled: settings.enabled,
        seeding: settings.seed,
        upload_limit_bytes_per_sec: settings.upload_limit_bytes_per_sec,
        active_downloads: active,
        seeding_torrents: seeding_count,
    })
}

/// Tauri setup 调用：根据缓存目录构造 P2pState。
pub fn init_p2p_state(cache_dir: PathBuf) -> Arc<P2pState> {
    let session_dir = cache_dir.join("p2p_state");
    let output_dir = cache_dir;
    Arc::new(P2pState::new(session_dir, output_dir))
}
