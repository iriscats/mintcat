//! 读取系统代理配置。当用户未在应用内设置代理时，下载等请求可回退到系统代理（Windows IE/系统代理、环境变量等）。

/// 返回当前应使用的系统代理 URL（如 `http://127.0.0.1:7890`），若无法获取则返回 None。
/// 不写入应用状态，仅用于与「手动代理」二选一时的回退。
pub fn get_system_proxy_url() -> Option<String> {
    #[cfg(windows)]
    {
        get_system_proxy_url_windows()
    }

    #[cfg(not(windows))]
    {
        get_system_proxy_url_env()
    }
}

#[cfg(windows)]
fn get_system_proxy_url_windows() -> Option<String> {
    let config = winhttp::get_ie_proxy_config().ok()?;
    let raw = config.proxy?.trim().to_string();
    if raw.is_empty() {
        return None;
    }
    // IE 格式可能为 "http=127.0.0.1:7890;https=127.0.0.1:7890" 或 "127.0.0.1:7890"
    let first = raw.split(';').next()?.trim();
    let host_port = if let Some((_, right)) = first.split_once('=') {
        right.trim()
    } else {
        first
    };
    if host_port.is_empty() {
        return None;
    }
    let lower = to_ascii_lowercase(host_port);
    if lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("socks4://")
        || lower.starts_with("socks5://")
    {
        return Some(host_port.to_string());
    }
    Some(format!("http://{}", host_port))
}

#[cfg(windows)]
fn to_ascii_lowercase(s: &str) -> String {
    s.chars()
        .map(|c| {
            if ('A'..='Z').contains(&c) {
                ((c as u8) + 32) as char
            } else {
                c
            }
        })
        .collect::<String>()
}

#[cfg(not(windows))]
fn get_system_proxy_url_env() -> Option<String> {
    std::env::var("HTTPS_PROXY")
        .ok()
        .or_else(|| std::env::var("https_proxy").ok())
        .or_else(|| std::env::var("HTTP_PROXY").ok())
        .or_else(|| std::env::var("http_proxy").ok())
        .or_else(|| std::env::var("ALL_PROXY").ok())
        .or_else(|| std::env::var("all_proxy").ok())
        .and_then(|s| {
            let s = s.trim();
            if s.is_empty() {
                None
            } else {
                Some(s.to_string())
            }
        })
}

