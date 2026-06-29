use keyring::Entry;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const KEYRING_SERVICE: &str = "online.druz9.hone";
const STORE_PATH: &str = "hone-store.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PomodoroSnapshot {
    pub remain_sec: i64,
    pub running: bool,
    pub saved_at: i64,
}

fn vault_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, "vault-passphrase").map_err(|e| e.to_string())
}

pub fn load_vault_pass(_app: &AppHandle) -> Result<Option<String>, String> {
    match vault_entry()?.get_password() {
        Ok(v) if v.is_empty() => Ok(None),
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn save_vault_pass(_app: &AppHandle, passphrase: &str) -> Result<(), String> {
    vault_entry()?
        .set_password(passphrase)
        .map_err(|e| e.to_string())
}

pub fn clear_vault_pass(_app: &AppHandle) -> Result<(), String> {
    match vault_entry()?.delete_password() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
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
