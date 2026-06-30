mod auth;
mod store;
mod vault;
mod window_macos;

use auth::{AuthSession, TelegramPollResult, TelegramStart};
use store::PomodoroSnapshot;
use tauri::{AppHandle, Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
                });
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window_macos::set_traffic_lights(&window, false);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth_session,
            auth_persist,
            auth_logout,
            auth_tg_start,
            auth_tg_poll,
            vault_pass_load,
            vault_pass_save,
            vault_pass_clear,
            pomodoro_load,
            pomodoro_save,
            shell_open_external,
            tray_update,
            window_traffic_lights_show,
        ])
        .run(tauri::generate_context!())
        .expect("error while running hone");
}

#[derive(Clone, serde::Serialize)]
struct DeepLinkPayload {
    url: String,
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
fn vault_pass_load(user_id: String) -> Result<Option<String>, String> {
    vault::load_passphrase(&user_id)
}

#[tauri::command]
fn vault_pass_save(user_id: String, passphrase: String) -> Result<(), String> {
    vault::save_passphrase(&user_id, &passphrase)
}

#[tauri::command]
fn vault_pass_clear(user_id: String) -> Result<(), String> {
    vault::clear_passphrase(&user_id)
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
fn tray_update(_title: String, _tooltip: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn window_traffic_lights_show(window: tauri::WebviewWindow, visible: bool) -> Result<(), String> {
    window_macos::set_traffic_lights(&window, visible)
}
