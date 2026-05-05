use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum InstallEvent {
    StatusLog(Value),
    Percent(f32),
    Success(u64),
    Error(Value),
}

pub trait InstallProgress: Send + Sync {
    fn emit(&self, event: InstallEvent) -> Result<()>;
}

pub fn text(value: impl Into<String>) -> Value {
    Value::String(value.into())
}

pub fn json_value(value: impl Serialize) -> Value {
    serde_json::to_value(value).unwrap_or_else(|_| Value::Null)
}
