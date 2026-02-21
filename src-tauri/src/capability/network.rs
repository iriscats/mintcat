//! 网络代理状态，供下载、.NET 运行时等 HTTP 请求走 Clash 等代理。
//! 前端通过 set_network_proxy 设置后，所有后端 reqwest 请求会使用该代理。
//! 若未设置，则回退到系统代理（Windows：IE/系统代理；其他：环境变量 HTTP_PROXY/HTTPS_PROXY）。

use std::sync::{Arc, Mutex};
use tauri::State;

/// 全局网络代理 URL（如 http://127.0.0.1:7890）。
/// 由前端在应用启动时根据设置调用 set_network_proxy 写入。
pub struct NetworkProxyState(pub Arc<Mutex<Option<String>>>);

impl NetworkProxyState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }

    pub fn get(&self) -> Option<String> {
        self.0.lock().ok().and_then(|g| g.clone())
    }

    pub fn set(&self, proxy: Option<String>) {
        if let Ok(mut g) = self.0.lock() {
            *g = proxy;
        }
    }
}

/// 设置网络代理 URL（如 http://127.0.0.1:7890）。传空字符串或 null 表示不使用代理。
#[tauri::command]
pub fn set_network_proxy(
    state: State<'_, NetworkProxyState>,
    proxy: Option<String>,
) {
    let value = proxy.filter(|s| !s.is_empty());
    if let Some(ref u) = value {
        log::info!("Network proxy set to: {}", u);
    } else {
        log::info!("Network proxy cleared");
    }
    state.set(value);
}

/// 解析出实际使用的代理 URL：优先使用手动设置的代理，否则尝试系统代理（Windows IE/系统代理或环境变量）。
pub fn resolve_proxy(manual: Option<String>) -> Option<String> {
    let manual = manual.filter(|s| !s.is_empty());
    if let Some(ref u) = manual {
        return Some(u.clone());
    }
    if let Some(system) = crate::capability::system_proxy::get_system_proxy_url() {
        log::info!("Using system proxy: {}", system);
        return Some(system);
    }
    None
}

/// 为 reqwest (async) ClientBuilder 应用当前代理（若已设置）。
pub fn apply_proxy_builder(
    builder: reqwest::ClientBuilder,
    proxy_url: Option<&str>,
) -> Result<reqwest::ClientBuilder, reqwest::Error> {
    if let Some(url) = proxy_url.filter(|s| !s.is_empty()) {
        let proxy = reqwest::Proxy::all(url)?;
        Ok(builder.proxy(proxy))
    } else {
        Ok(builder)
    }
}

/// 为 reqwest blocking ClientBuilder 应用当前代理（若已设置）。
pub fn apply_proxy_blocking_builder(
    builder: reqwest::blocking::ClientBuilder,
    proxy_url: Option<&str>,
) -> Result<reqwest::blocking::ClientBuilder, reqwest::Error> {
    if let Some(url) = proxy_url.filter(|s| !s.is_empty()) {
        let proxy = reqwest::Proxy::all(url)?;
        Ok(builder.proxy(proxy))
    } else {
        Ok(builder)
    }
}
