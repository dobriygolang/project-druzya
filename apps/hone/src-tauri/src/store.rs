use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_PATH: &str = "hone-store.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PomodoroSnapshot {
    pub remain_sec: i64,
    pub running: bool,
    pub saved_at: i64,
}

pub fn load_pomodoro(app: &AppHandle) -> Result<Option<PomodoroSnapshot>, String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    match store.get("pomodoro") {
        Some(v) => serde_json::from_value(v.clone()).map(Some).map_err(|e| e.to_string()),
        None => Ok(None),
    }
}

pub fn save_pomodoro(app: &AppHandle, snapshot: &PomodoroSnapshot) -> Result<(), String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    store.set(
        "pomodoro",
        serde_json::to_value(snapshot).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())
}
