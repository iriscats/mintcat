use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{anyhow, Result};
use librqbit::{Session, SessionOptions, SessionPersistenceConfig};
use librqbit::api::TorrentIdOrHash;
use tokio::sync::RwLock;

/// 运行时可调节的 P2P 设置。
///
/// - `enabled`: 关闭后 `p2p_download` 直接返回 `P2pDisabled`，调用方需回退 HTTP。
/// - `seed`: 下载完成后是否继续做种（不影响 enabled=true 但 seed=false 的场景，即只下不上）。
/// - `upload_limit_bytes_per_sec`: 会话级上传限速；`None` 表示不限速。
#[derive(Debug, Clone)]
pub struct P2pSettings {
    pub enabled: bool,
    pub seed: bool,
    pub upload_limit_bytes_per_sec: Option<u32>,
}

impl Default for P2pSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            seed: true,
            upload_limit_bytes_per_sec: None,
        }
    }
}

/// P2P 全局状态。Tauri 通过 `app.manage(P2pState::new(...))` 持有。
pub struct P2pState {
    /// 延迟初始化的 librqbit Session。Session 创建会触发 DHT 和端口监听，因此在第一次下载
    /// 或应用启动完成后才创建，避免无 P2P 使用时的资源开销。
    session: RwLock<Option<Arc<Session>>>,
    /// 会话数据目录（DHT 持久化 / 已添加 torrent 状态 / 续种元数据）。
    session_dir: PathBuf,
    /// 默认输出目录（当调用方未指定 output_folder 时使用）。
    default_output_dir: PathBuf,
    /// 运行时设置。
    pub(crate) settings: RwLock<P2pSettings>,
}

impl P2pState {
    pub fn new(session_dir: PathBuf, default_output_dir: PathBuf) -> Self {
        Self {
            session: RwLock::new(None),
            session_dir,
            default_output_dir,
            settings: RwLock::new(P2pSettings::default()),
        }
    }

    pub fn default_output_dir(&self) -> PathBuf {
        self.default_output_dir.clone()
    }

    /// 懒加载 Session。首次调用会创建并持久化到 `session_dir`，
    /// librqbit 会自动恢复之前未完成 / 已完成的 torrent（用于续种）。
    pub async fn get_or_init_session(&self) -> Result<Arc<Session>> {
        {
            let guard = self.session.read().await;
            if let Some(s) = guard.as_ref() {
                return Ok(s.clone());
            }
        }
        let mut guard = self.session.write().await;
        if let Some(s) = guard.as_ref() {
            return Ok(s.clone());
        }
        if let Err(e) = tokio::fs::create_dir_all(&self.session_dir).await {
            log::warn!("[p2p] create session_dir failed ({}): {}", self.session_dir.display(), e);
        }
        let opts = SessionOptions {
            persistence: Some(SessionPersistenceConfig::Json {
                folder: Some(self.session_dir.clone()),
            }),
            // 默认启用 DHT；家庭路由器下绝大多数可依赖 DHT + uTP + UPnP 拿到对端
            disable_dht: false,
            disable_dht_persistence: false,
            // 打开 UPnP 端口映射，用于做种（下载方向只需主动出站）
            enable_upnp_port_forwarding: true,
            fastresume: true,
            ..Default::default()
        };
        let session = Session::new_with_opts(self.default_output_dir.clone(), opts)
            .await
            .map_err(|e| anyhow!("init librqbit session failed: {e:?}"))?;
        *guard = Some(session.clone());
        log::info!(
            "[p2p] session initialized (session_dir={}, default_output_dir={})",
            self.session_dir.display(),
            self.default_output_dir.display()
        );
        Ok(session)
    }

    /// 停止会话（app 退出时调用）。
    pub async fn shutdown(&self) {
        let session = {
            let mut guard = self.session.write().await;
            guard.take()
        };
        if let Some(session) = session {
            log::info!("[p2p] stopping session...");
            session.stop().await;
        }
    }

    pub async fn settings_snapshot(&self) -> P2pSettings {
        self.settings.read().await.clone()
    }

    pub async fn set_enabled(&self, enabled: bool) {
        self.settings.write().await.enabled = enabled;
    }

    pub async fn set_seeding(&self, seed: bool) {
        self.settings.write().await.seed = seed;
    }

    pub async fn set_upload_limit(&self, bytes_per_sec: Option<u32>) {
        self.settings.write().await.upload_limit_bytes_per_sec = bytes_per_sec;
        // librqbit 的 ratelimits 在 Session 层和 torrent 层都存在，这里仅记录；
        // 实际调整由下一次 add_torrent 生效，简单实现避免引入额外 API 依赖。
    }

    /// 返回 (当前活跃下载数, 已完成正在做种的数量)。
    ///
    /// librqbit 的 `with_torrents` 允许遍历当前 Session 管理的所有 torrent；
    /// 通过 `TorrentStats.finished` 区分下载中 vs 做种中。
    pub async fn torrent_counts(&self) -> (u32, u32) {
        let guard = self.session.read().await;
        let Some(session) = guard.as_ref() else {
            return (0, 0);
        };
        session.with_torrents(|iter| {
            let mut active: u32 = 0;
            let mut seeding: u32 = 0;
            for (_id, t) in iter {
                let stats = t.stats();
                if stats.finished {
                    seeding += 1;
                } else {
                    active += 1;
                }
            }
            (active, seeding)
        })
    }

    /// 停止所有已完成正在做种的 torrent（保留已下载文件）。
    ///
    /// 用于用户在设置页关闭"做种"开关，或 `p2p_download` 完成后检测到 `seed=false` 时。
    /// 未完成的下载不会受影响——它们仍需继续，以便完成当前任务。
    pub async fn stop_all_seeding(&self) {
        let session = {
            let guard = self.session.read().await;
            match guard.as_ref() {
                Some(s) => s.clone(),
                None => return,
            }
        };
        let finished_ids: Vec<_> = session.with_torrents(|iter| {
            let mut ids = Vec::new();
            for (id, t) in iter {
                if t.stats().finished {
                    ids.push(id);
                }
            }
            ids
        });
        for id in finished_ids {
            if let Err(e) = session.delete(TorrentIdOrHash::Id(id), false).await {
                log::warn!("[p2p] stop seeding torrent {id} failed: {e:#}");
            }
        }
    }

}
