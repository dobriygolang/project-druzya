use keyring::Entry;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

const KEYRING_SERVICE: &str = "online.druz9.hone";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthSession {
    pub user_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelegramStart {
    pub code: String,
    pub deep_link: String,
    pub expires_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum TelegramPollResult {
    Ok {
        session: AuthSession,
        #[serde(rename = "isNewUser")]
        is_new_user: bool,
    },
    Pending,
    Expired,
    RateLimited {
        retry_after: i64,
    },
    Error {
        message: String,
    },
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

pub fn api_base() -> String {
    std::env::var("HONE_API_BASE")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| {
            if cfg!(debug_assertions) {
                "http://localhost:8080".to_string()
            } else {
                "https://druz9.online".to_string()
            }
        })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub telegram_bot_username: String,
}

fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

fn map_http_error(err: reqwest::Error) -> String {
    if err.is_connect() || err.is_timeout() || err.is_request() {
        return "network_error".into();
    }
    err.to_string()
}

fn parse_error_message(body: &str) -> Option<String> {
    let json: serde_json::Value = serde_json::from_str(body).ok()?;
    json.get("error")
        .or_else(|| json.get("message"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
}

pub async fn fetch_auth_config() -> Result<AuthConfig, String> {
    let url = format!("{}/v1/auth/config", api_base());
    let resp = http_client()
        .get(url)
        .send()
        .await
        .map_err(map_http_error)?;
    if !resp.status().is_success() {
        return Err(format!("auth config: HTTP {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(map_http_error)?;
    let username = body
        .get("telegram_bot_username")
        .or_else(|| body.get("telegramBotUsername"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    Ok(AuthConfig {
        telegram_bot_username: username,
    })
}

pub async fn exchange_telegram_code(code: &str) -> Result<AuthSession, String> {
    let trimmed = code.trim();
    if trimmed.is_empty() {
        return Err("code is required".into());
    }
    let url = format!("{}/v1/auth/telegram", api_base());
    let resp = http_client()
        .post(url)
        .header("content-type", "application/json")
        .json(&serde_json::json!({ "code": trimmed }))
        .send()
        .await
        .map_err(map_http_error)?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(parse_error_message(&text).unwrap_or_else(|| {
            if text.trim().is_empty() {
                format!("telegram auth: HTTP {status}")
            } else {
                text
            }
        }));
    }
    let body: serde_json::Value = resp.json().await.map_err(map_http_error)?;
    let access_token = body
        .get("accessToken")
        .or_else(|| body.get("access_token"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let refresh_token = body
        .get("refreshToken")
        .or_else(|| body.get("refresh_token"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let user = body.get("user").and_then(|v| v.as_object());
    let user_id = user
        .and_then(|u| u.get("id"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if access_token.is_empty() || user_id.is_empty() {
        return Err("invalid auth response".into());
    }
    Ok(AuthSession {
        user_id,
        access_token,
        refresh_token,
        expires_at: 0,
    })
}

pub async fn telegram_start(_app: &AppHandle) -> Result<TelegramStart, String> {
    let url = format!("{}/api/v1/auth/telegram/start", api_base());
    let client = reqwest::Client::new();
    let resp = client
        .post(url)
        .header("content-type", "application/json")
        .body("{}")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("telegram start: HTTP {}", resp.status()));
    }
    resp.json::<TelegramStart>().await.map_err(|e| e.to_string())
}

pub async fn telegram_poll(app: &AppHandle, code: &str) -> Result<TelegramPollResult, String> {
    let url = format!("{}/api/v1/auth/telegram/poll", api_base());
    let client = reqwest::Client::new();
    let resp = client
        .post(url)
        .header("content-type", "application/json")
        .json(&serde_json::json!({ "code": code }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        let retry_after = resp
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse().ok())
            .unwrap_or(60);
        return Ok(TelegramPollResult::RateLimited { retry_after });
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let status = body.get("status").and_then(|v| v.as_str()).unwrap_or("");

    match status {
        "pending" => Ok(TelegramPollResult::Pending),
        "expired" => Ok(TelegramPollResult::Expired),
        "ok" => {
            let session = AuthSession {
                user_id: body
                    .get("userId")
                    .or_else(|| body.get("user_id"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                access_token: body
                    .get("accessToken")
                    .or_else(|| body.get("access_token"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                refresh_token: body
                    .get("refreshToken")
                    .or_else(|| body.get("refresh_token"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                expires_at: body
                    .get("expiresAt")
                    .or_else(|| body.get("expires_at"))
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0),
            };
            if session.access_token.is_empty() {
                return Ok(TelegramPollResult::Error {
                    message: "empty session from backend".into(),
                });
            }
            let is_new_user = body
                .get("isNewUser")
                .or_else(|| body.get("is_new_user"))
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            save_session(app, &session)?;
            let _ = app.emit("auth:changed", session.clone());
            Ok(TelegramPollResult::Ok {
                session,
                is_new_user,
            })
        }
        _ => Ok(TelegramPollResult::Error {
            message: body
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("poll failed")
                .to_string(),
        }),
    }
}
