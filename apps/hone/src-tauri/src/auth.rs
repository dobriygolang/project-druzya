use keyring::Entry;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

const KEYRING_SERVICE: &str = "online.druz9.hone";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthSession {
    pub user_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64,
}

fn auth_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, "auth-session").map_err(|e| e.to_string())
}

pub fn load_session(_app: &AppHandle) -> Result<Option<AuthSession>, String> {
    let entry = auth_entry()?;
    match entry.get_password() {
        Ok(raw) => {
            let parsed: AuthSession = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
            if parsed.access_token.is_empty() || parsed.user_id.is_empty() {
                return Ok(None);
            }
            Ok(Some(parsed))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn save_session(_app: &AppHandle, session: &AuthSession) -> Result<(), String> {
    let entry = auth_entry()?;
    let raw = serde_json::to_string(session).map_err(|e| e.to_string())?;
    entry.set_password(&raw).map_err(|e| e.to_string())
}

pub fn clear_session(_app: &AppHandle) -> Result<(), String> {
    let entry = auth_entry()?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
