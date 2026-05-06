use crate::download::task::DownloadTask;
use crate::network::{apply_proxy_builder, resolve_proxy};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

pub struct DownloadManager {
    proxy_state: Arc<std::sync::Mutex<Option<String>>>,
    /// (last_used_proxy, client) — 当 proxy 变化时重建 client
    client_cache: Mutex<Option<(Option<String>, reqwest::Client)>>,
    active_downloads: Arc<Mutex<HashMap<String, Arc<DownloadTask>>>>,
}

impl DownloadManager {
    /// 使用与 NetworkProxyState 共享的 Arc（setup 中先 manage proxy 再 clone Arc 传入）。
    pub fn new_with_proxy_arc(proxy_arc: Arc<std::sync::Mutex<Option<String>>>) -> Self {
        Self {
            proxy_state: proxy_arc,
            client_cache: Mutex::new(None),
            active_downloads: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn build_client(proxy_url: Option<&str>) -> reqwest::Client {
        let builder = reqwest::Client::builder()
            .timeout(Duration::from_secs(300))
            .connect_timeout(Duration::from_secs(30))
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(Duration::from_secs(90));
        let builder =
            apply_proxy_builder(builder, proxy_url).expect("Failed to apply proxy to HTTP client");
        builder.build().expect("Failed to create HTTP client")
    }

    pub async fn get_client(&self) -> reqwest::Client {
        let manual = self.proxy_state.lock().ok().and_then(|g| g.clone());
        let proxy = resolve_proxy(manual.clone());
        let mut cache = self.client_cache.lock().await;
        let need_rebuild = cache
            .as_ref()
            .map(|(p, _)| p.as_deref() != proxy.as_deref())
            .unwrap_or(true);
        if need_rebuild {
            let client = Self::build_client(proxy.as_deref());
            let clone = client.clone();
            *cache = Some((proxy, client));
            clone
        } else {
            cache.as_ref().unwrap().1.clone()
        }
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
