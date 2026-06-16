use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{
    webview::{DownloadEvent, NewWindowResponse},
    AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindowBuilder,
};

const EVENT_NEXUS_DOWNLOAD_CAPTURED: &str = "nexus-download-captured";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenNexusDownloadWebviewRequest {
    pub page_url: String,
    pub profile_url: String,
    pub domain: String,
    pub mod_id: u32,
    pub file_id: Option<u32>,
    pub auto_start: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NexusDownloadCapturedPayload {
    pub url: String,
    pub source: String,
    pub domain: String,
    pub mod_id: u32,
    pub file_id: Option<u32>,
    pub profile_url: String,
}

#[tauri::command]
pub async fn open_nexus_download_webview(
    app: AppHandle,
    request: OpenNexusDownloadWebviewRequest,
) -> Result<(), String> {
    let page_url = request
        .page_url
        .parse::<Url>()
        .map_err(|error| format!("invalid Nexus Mods URL: {}", error))?;
    let label = format!(
        "nexus-download-{}-{}-{}",
        sanitize_label_part(&request.domain),
        request.mod_id,
        request.file_id.unwrap_or(0)
    );

    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.close();
    }

    let nav_app = app.clone();
    let nav_label = label.clone();
    let nav_context = request.clone();
    let download_context = request.clone();
    let new_window_app = app.clone();
    let new_window_label = label.clone();
    let new_window_context = request.clone();
    let auto_download_script = build_auto_download_script(&request);

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(page_url))
        .title("Nexus Mods Download")
        .inner_size(1100.0, 760.0)
        .decorations(true)
        .visible(true)
        .focusable(true)
        .focused(true)
        .accept_first_mouse(true)
        .initialization_script(&auto_download_script)
        .on_navigation(move |url| {
            if let Some(source) = capture_source(url) {
                emit_captured_deferred(
                    nav_app.clone(),
                    nav_label.clone(),
                    nav_context.clone(),
                    url.to_string(),
                    source,
                );
                return false;
            }
            true
        })
        .on_download(move |webview, event| {
            if let DownloadEvent::Requested { url, .. } = event {
                if let Some(source) = capture_source(&url) {
                    emit_captured_deferred(
                        webview.app_handle().clone(),
                        webview.label().to_string(),
                        download_context.clone(),
                        url.to_string(),
                        source,
                    );
                    return false;
                }
            }
            true
        })
        .on_new_window(move |url, _features| {
            if let Some(source) = capture_source(&url) {
                emit_captured_deferred(
                    new_window_app.clone(),
                    new_window_label.clone(),
                    new_window_context.clone(),
                    url.to_string(),
                    source,
                );
                return NewWindowResponse::Deny;
            }

            navigate_deferred(new_window_app.clone(), new_window_label.clone(), url);
            NewWindowResponse::Deny
        })
        .build()
        .map(|window| {
            focus_download_window(&app, &window);
        })
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn build_auto_download_script(context: &OpenNexusDownloadWebviewRequest) -> String {
    let config = json!({
        "autoStart": context.auto_start.unwrap_or(true),
        "domain": context.domain.as_str(),
        "modId": context.mod_id,
        "fileId": context.file_id,
    });
    let mut script = String::from("(function () {\nconst config = ");
    script.push_str(&config.to_string());
    script.push_str(
        r#";
if (!config.autoStart || window.__mintcatNexusAutoDownloadStarted) {
    return;
}
window.__mintcatNexusAutoDownloadStarted = true;

const maxRuntimeMs = 45000;
const intervalMs = 700;
const startedAt = Date.now();
const attempts = new WeakMap();
let timer = null;
let observer = null;
let generateDownloadUrlStarted = false;

function log(message) {
    try {
        console.debug('[MintCat Nexus AutoDownload] ' + message);
    } catch (_) {
        // ignore logging failures in external pages
    }
}

function getGameId() {
    const candidates = [
        document.querySelector('[data-gameid]'),
        document.querySelector('[data-game-id]'),
        document.querySelector('[data-game-id-text]'),
        document.body,
        document.documentElement,
    ].filter(Boolean);
    for (const element of candidates) {
        const dataset = element.dataset || {};
        const value = dataset.gameid
            || dataset.gameId
            || dataset.gameIdText
            || element.getAttribute('data-gameid')
            || element.getAttribute('data-game-id');
        const id = Number(value || 0);
        if (Number.isFinite(id) && id > 0) {
            return id;
        }
    }

    const html = document.documentElement ? document.documentElement.innerHTML : '';
    const match = html.match(/["']game_id["']\s*:\s*["']?(\d+)/i)
        || html.match(/data-gameid=["'](\d+)/i)
        || html.match(/data-game-id=["'](\d+)/i);
    return match ? Number(match[1]) : 0;
}

function generateDownloadUrl() {
    if (generateDownloadUrlStarted || !config.fileId) {
        return false;
    }

    const gameId = getGameId();
    if (!gameId) {
        return false;
    }

    generateDownloadUrlStarted = true;
    log('request GenerateDownloadUrl for file ' + config.fileId + ', game ' + gameId);

    const body = new URLSearchParams();
    body.set('fid', String(config.fileId));
    body.set('game_id', String(gameId));

    fetch(window.location.origin + '/Core/Libs/Common/Managers/Downloads?GenerateDownloadUrl', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest',
        },
        body,
    })
        .then((response) => response.text())
        .then((text) => {
            const data = JSON.parse(text);
            if (data && data.url) {
                log('navigate generated download URL');
                window.location.href = data.url;
                return;
            }
            log('GenerateDownloadUrl returned no URL');
        })
        .catch((error) => {
            log('GenerateDownloadUrl failed: ' + (error && error.message ? error.message : error));
        });

    return true;
}

function isTargetPage() {
    const host = window.location.hostname.toLowerCase();
    if (host !== 'www.nexusmods.com' && host !== 'nexusmods.com') {
        return false;
    }

    const parts = window.location.pathname.split('/').filter(Boolean);
    const gameOffset = parts[0] && parts[0].toLowerCase() === 'games' ? 1 : 0;
    const domain = (parts[gameOffset] || '').toLowerCase();
    const modsSegment = (parts[gameOffset + 1] || '').toLowerCase();
    const modId = Number(parts[gameOffset + 2] || 0);
    return domain === String(config.domain).toLowerCase()
        && modsSegment === 'mods'
        && modId === Number(config.modId);
}

function textOf(element) {
    return [
        element.textContent || '',
        element.getAttribute('aria-label') || '',
        element.getAttribute('title') || '',
        element.getAttribute('href') || '',
        element.getAttribute('data-download-url') || '',
        element.getAttribute('data-file-id') || '',
        element.id || '',
    ].join(' ').toLowerCase();
}

function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0
        && rect.height > 0
        && style.visibility !== 'hidden'
        && style.display !== 'none'
        && !element.hasAttribute('disabled')
        && element.getAttribute('aria-disabled') !== 'true';
}

function matchesFileId(element) {
    if (!config.fileId) {
        return true;
    }
    if (Date.now() - startedAt > 6000) {
        return true;
    }
    const fileId = String(config.fileId);
    let current = element;
    for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
        const text = textOf(current);
        if (text.includes(fileId) || text.includes('file_id=' + fileId) || text.includes('/files/' + fileId)) {
            return true;
        }
    }
    return false;
}

function canAttempt(element, key, cooldownMs, maxAttempts) {
    const now = Date.now();
    const entry = attempts.get(element) || {};
    const state = entry[key] || { count: 0, lastAt: 0 };
    if (state.count >= maxAttempts || now - state.lastAt < cooldownMs) {
        return false;
    }
    entry[key] = { count: state.count + 1, lastAt: now };
    attempts.set(element, entry);
    return true;
}

function dispatchSlowDownload(component) {
    if (!component || !matchesFileId(component)) {
        return false;
    }
    if (!canAttempt(component, 'slowDownloadEvent', 900, 30)) {
        return false;
    }
    log('dispatch slowDownload event');
    component.dispatchEvent(new CustomEvent('slowDownload', { bubbles: true, composed: true }));
    return true;
}

function clickElement(element) {
    if (!element || !isVisible(element) || !matchesFileId(element)) {
        return false;
    }
    if (!canAttempt(element, 'click', 1600, 8)) {
        return false;
    }
    log('click ' + textOf(element).slice(0, 80));
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    element.click();
    return true;
}

function findDownloadButtons() {
    const candidates = Array.from(document.querySelectorAll('a, button, [role="button"]'));
    const buttons = candidates.filter((element) => {
        const text = textOf(element);
        if (!text) {
            return false;
        }
        if (text.includes('preview file contents') || text.includes('requirements') || text.includes('changelog')) {
            return false;
        }
        return text.includes('slow download')
            || text.includes('mod manager download')
            || text.includes('manual download')
            || text.includes('download with manager')
            || text.includes('nxm://')
            || text.includes('nexus-cdn.com');
    });
    const priority = (element) => {
        const text = textOf(element);
        if (text.includes('slow download')) return 0;
        if (text.includes('manual download')) return 1;
        if (text.includes('mod manager download') || text.includes('download with manager')) return 2;
        return 3;
    };
    return buttons.sort((a, b) => priority(a) - priority(b));
}

function tick() {
    if (!isTargetPage()) {
        return;
    }

    if (generateDownloadUrl()) {
        return;
    }

    const components = Array.from(document.querySelectorAll('mod-file-download'));
    const matchingComponents = components.filter(matchesFileId);
    let dispatchedComponentEvent = false;
    for (const component of matchingComponents.length > 0 ? matchingComponents : components) {
        if (dispatchSlowDownload(component)) {
            dispatchedComponentEvent = true;
        }
    }

    // Give Nexus' custom element path a short head start. If it does not work,
    // continue with visible button clicks such as Manual Download -> Slow Download.
    if (dispatchedComponentEvent && Date.now() - startedAt < 3500) {
        return;
    }

    for (const element of findDownloadButtons()) {
        if (clickElement(element)) {
            return;
        }
    }

    if (Date.now() - startedAt > maxRuntimeMs && timer) {
        window.clearInterval(timer);
        timer = null;
    }
}

function startObserver() {
    if (!window.MutationObserver || observer || !document.documentElement) {
        return;
    }
    observer = new MutationObserver(() => window.setTimeout(tick, 50));
    observer.observe(document.documentElement, { childList: true, subtree: true });
}

timer = window.setInterval(tick, intervalMs);
startObserver();
if (window.customElements && window.customElements.whenDefined) {
    window.customElements.whenDefined('mod-file-download').then(tick).catch(() => {});
}
window.addEventListener('DOMContentLoaded', () => {
    startObserver();
    tick();
}, { once: true });
window.addEventListener('load', tick, { once: true });
window.addEventListener('beforeunload', () => {
    if (timer) {
        window.clearInterval(timer);
    }
    if (observer) {
        observer.disconnect();
    }
});
tick();
})();"#,
    );
    script
}

fn navigate_deferred(app: AppHandle, window_label: String, url: Url) {
    tauri::async_runtime::spawn(async move {
        if let Some(window) = app.get_webview_window(&window_label) {
            if let Err(error) = window.navigate(url) {
                log::warn!(
                    "[NexusWebView] failed to navigate popup in {}: {}",
                    window_label,
                    error
                );
            }
        }
    });
}

fn focus_download_window(app: &AppHandle, window: &tauri::WebviewWindow) {
    #[cfg(target_os = "macos")]
    {
        let _ = app.show();
    }

    let _ = window.set_focusable(true);
    let _ = window.show();
    let _ = window.set_focus();
}

fn capture_source(url: &Url) -> Option<&'static str> {
    if url.scheme().eq_ignore_ascii_case("nxm") {
        return Some("nxm");
    }

    let host = url.host_str()?.to_ascii_lowercase();
    if (url.scheme() == "http" || url.scheme() == "https") && host.ends_with("nexus-cdn.com") {
        return Some("cdn");
    }

    None
}

fn emit_captured(
    app: &AppHandle,
    window_label: &str,
    context: &OpenNexusDownloadWebviewRequest,
    url: &str,
    source: &str,
) {
    log::info!(
        "[NexusWebView] captured {} download URL for {}/{}: {}",
        source,
        context.domain,
        context.mod_id,
        sanitize_url_for_log(url)
    );

    let payload = NexusDownloadCapturedPayload {
        url: url.to_string(),
        source: source.to_string(),
        domain: context.domain.clone(),
        mod_id: context.mod_id,
        file_id: context.file_id,
        profile_url: context.profile_url.clone(),
    };

    let _ = app.emit(EVENT_NEXUS_DOWNLOAD_CAPTURED, payload);
    if let Some(window) = app.get_webview_window(window_label) {
        let _ = window.close();
    }
}

fn emit_captured_deferred(
    app: AppHandle,
    window_label: String,
    context: OpenNexusDownloadWebviewRequest,
    url: String,
    source: &'static str,
) {
    tauri::async_runtime::spawn(async move {
        emit_captured(&app, &window_label, &context, &url, source);
    });
}

fn sanitize_label_part(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect()
}

fn sanitize_url_for_log(value: &str) -> String {
    match value.parse::<Url>() {
        Ok(mut url) => {
            let pairs: Vec<(String, String)> = url
                .query_pairs()
                .map(|(name, value)| {
                    let value = if matches!(name.as_ref(), "key" | "expires" | "user_id" | "md5") {
                        "[REDACTED]".to_string()
                    } else {
                        value.into_owned()
                    };
                    (name.into_owned(), value)
                })
                .collect();
            if !pairs.is_empty() {
                let mut query = url.query_pairs_mut();
                query.clear();
                for (name, value) in pairs {
                    query.append_pair(&name, &value);
                }
            }
            url.to_string()
        }
        Err(_) => "download-url-[REDACTED]".to_string(),
    }
}
