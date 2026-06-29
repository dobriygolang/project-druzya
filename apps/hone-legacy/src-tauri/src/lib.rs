mod auth;
mod focus;
mod store;

use auth::{AuthSession, TelegramPollResult, TelegramStart};
use store::PomodoroSnapshot;
use tauri::{AppHandle, Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let handle = app.handle().clone();
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let h = handle.clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        let _ = h.emit("app:deep-link", DeepLinkPayload {
                            url: url.to_string(),
                        });
                    }
                })?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth_session,
            auth_persist,
            auth_logout,
            auth_tg_start,
            auth_tg_poll,
            pomodoro_load,
            pomodoro_save,
            shell_open_external,
            vault_pass_load,
            vault_pass_save,
            vault_pass_clear,
            focus_mode_start,
            focus_mode_stop,
            tray_update,
            window_traffic_lights_show,
            updater_install,
        ])
        .run(tauri::generate_context!())
        .expect("error while running hone");
}

#[derive(Clone, serde::Serialize)]
struct DeepLinkPayload {
    url: String,
}

#[derive(serde::Serialize)]
struct FocusModeResult {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[tauri::command]
fn auth_session(app: AppHandle) -> Result<Option<AuthSession>, String> {
    auth::load_session(&app)
}

#[tauri::command]
fn auth_persist(app: AppHandle, session: AuthSession) -> Result<(), String> {
    auth::save_session(&app, &session)?;
    let _ = app.emit("auth:changed", session);
    Ok(())
}

#[tauri::command]
fn auth_logout(app: AppHandle) -> Result<(), String> {
    auth::clear_session(&app)?;
    store::clear_vault_pass(&app)?;
    let _ = app.emit("auth:changed", Option::<AuthSession>::None);
    Ok(())
}

#[tauri::command]
async fn auth_tg_start(app: AppHandle) -> Result<TelegramStart, String> {
    auth::telegram_start(&app).await
}

#[tauri::command]
async fn auth_tg_poll(app: AppHandle, code: String) -> Result<TelegramPollResult, String> {
    auth::telegram_poll(&app, &code).await
}

#[tauri::command]
fn pomodoro_load(app: AppHandle) -> Result<Option<PomodoroSnapshot>, String> {
    store::load_pomodoro(&app)
}

#[tauri::command]
fn pomodoro_save(app: AppHandle, snapshot: PomodoroSnapshot) -> Result<(), String> {
    store::save_pomodoro(&app, &snapshot)
}

#[tauri::command]
async fn shell_open_external(app: AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    app.shell()
        .open(url, None)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn vault_pass_load(app: AppHandle) -> Result<Option<String>, String> {
    store::load_vault_pass(&app)
}

#[tauri::command]
fn vault_pass_save(app: AppHandle, passphrase: String) -> Result<(), String> {
    store::save_vault_pass(&app, &passphrase)
}

#[tauri::command]
fn vault_pass_clear(app: AppHandle) -> Result<(), String> {
    store::clear_vault_pass(&app)
}

#[tauri::command]
fn focus_mode_start(name: String) -> FocusModeResult {
    focus::run_shortcut(&name)
}

#[tauri::command]
fn focus_mode_stop(name: String) -> FocusModeResult {
    focus::run_shortcut(&name)
}

#[tauri::command]
fn tray_update(_title: String, _tooltip: String) -> Result<(), String> {
    // TODO: system tray title (Tauri tray plugin)
    Ok(())
}

#[tauri::command]
fn window_traffic_lights_show(_visible: bool) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn updater_install() -> Result<(), String> {
    Err("auto-updater not wired yet".into())
}
