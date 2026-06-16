use serde::Deserialize;
use tauri::AppHandle;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlPlaneInvokeRequest {
    pub command: String,
    #[serde(default)]
    pub payload: serde_json::Value,
}

#[tauri::command]
pub async fn control_plane_invoke(
    app: AppHandle,
    request: ControlPlaneInvokeRequest,
) -> Result<serde_json::Value, String> {
    match request.command.as_str() {
        "open_managed_webview" => {
            let payload = serde_json::from_value(request.payload)
                .map_err(|error| format!("invalid open_managed_webview payload: {error}"))?;
            crate::webview_host::open_managed_webview(app, payload).await?;
            Ok(serde_json::json!({ "ok": true }))
        }
        command => Err(format!("unknown control plane command: {command}")),
    }
}
