use crate::capability::download::task::DownloadTask;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

pub struct DownloadManager {
    client: reqwest::Client,
    active_downloads: Arc<Mutex<HashMap<String, Arc<DownloadTask>>>>,
}

impl DownloadManager {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(300))
            .connect_timeout(Duration::from_secs(30))
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(Duration::from_secs(90))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            active_downloads: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn get_client(&self) -> reqwest::Client {
        self.client.clone()
    }

    pub async fn add_download(&self, download_id: String, task: Arc<DownloadTask>) {
        let mut downloads = self.active_downloads.lock().await;
        downloads.insert(download_id, task);
    }

    pub async fn remove_download(&self, download_id: &str) {
        let mut downloads = self.active_downloads.lock().await;
        downloads.remove(download_id);
    }

    pub async fn get_download(&self, download_id: &str) -> Option<Arc<DownloadTask>> {
        let downloads = self.active_downloads.lock().await;
        downloads.get(download_id).cloned()
    }

    pub async fn cancel_download(&self, download_id: &str) -> Result<(), String> {
        let task = self.get_download(download_id).await;
        if let Some(task) = task {
            task.cancel().await;
            Ok(())
        } else {
            Err(format!("Download {} not found", download_id))
        }
    }
}

impl Default for DownloadManager {
    fn default() -> Self {
        Self::new()
    }
}
