mod checksum;
mod error;
mod manager;
mod task;

use crate::capability::download::checksum::ChecksumType;
use crate::capability::download::manager::DownloadManager;
use crate::capability::download::task::{DownloadOptions, DownloadTask};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;

// Global download manager
pub struct DownloadManagerState(pub Arc<Mutex<DownloadManager>>);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadOptionsDto {
    pub checksum: Option<String>,
    pub checksum_type: Option<String>,
    pub timeout_secs: Option<u64>,
    pub retry_count: Option<u32>,
    pub resume: Option<bool>,
}

impl From<DownloadOptionsDto> for DownloadOptions {
    fn from(dto: DownloadOptionsDto) -> Self {
        let checksum_type = dto
            .checksum_type
            .and_then(|t| ChecksumType::from_str(&t));

        DownloadOptions {
            checksum: dto.checksum,
            checksum_type,
            timeout_secs: dto.timeout_secs,
            retry_count: dto.retry_count,
            resume: dto.resume,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub download_id: String,
    pub file_path: String,
}

#[tauri::command]
pub async fn download_file(
    app: AppHandle,
    manager_state: State<'_, DownloadManagerState>,
    url: String,
    file_path: String,
    options: Option<DownloadOptionsDto>,
) -> Result<DownloadResult, String> {
    // Generate unique download ID
    let download_id = uuid::Uuid::new_v4().to_string();
    
    // Convert options
    let download_options = options
        .map(|o| o.into())
        .unwrap_or_else(DownloadOptions::default);

    // Get manager and client
    let manager = manager_state.0.lock().await;
    let client = manager.get_client();

    // Create download task
    let task = Arc::new(DownloadTask::new(
        download_id.clone(),
        url,
        PathBuf::from(&file_path),
        download_options,
        app.clone(),
        client,
    ));

    // Add to active downloads
    manager.add_download(download_id.clone(), task.clone()).await;
    drop(manager);

    // Execute download in background
    let manager_state_arc = manager_state.0.clone();
    let download_id_clone = download_id.clone();

    tauri::async_runtime::spawn(async move {
        let result = task.execute().await;

        // Remove from active downloads when done
        let manager = manager_state_arc.lock().await;
        manager.remove_download(&download_id_clone).await;

        if let Err(e) = result {
            log::error!("Download {} failed: {}", download_id_clone, e);
        }
    });

    Ok(DownloadResult {
        download_id,
        file_path,
    })
}

#[tauri::command]
pub async fn cancel_download(
    manager_state: State<'_, DownloadManagerState>,
    download_id: String,
) -> Result<(), String> {
    let manager = manager_state.0.lock().await;
    manager.cancel_download(&download_id).await
}

pub fn init_download_manager() -> DownloadManagerState {
    DownloadManagerState(Arc::new(Mutex::new(DownloadManager::new())))
}
