#![allow(deprecated)]

#[cfg(target_os = "macos")]
pub fn set_traffic_lights(window: &tauri::WebviewWindow, visible: bool) -> Result<(), String> {
    use cocoa::appkit::{NSWindow, NSWindowButton};
    use cocoa::base::{id, NO, YES};
    use objc::{msg_send, sel, sel_impl};

    let ns_window = window.ns_window().map_err(|e| e.to_string())? as id;
    unsafe {
        let hidden = if visible { NO } else { YES };
        for kind in [
            NSWindowButton::NSWindowCloseButton,
            NSWindowButton::NSWindowMiniaturizeButton,
            NSWindowButton::NSWindowZoomButton,
        ] {
            let btn: id = ns_window.standardWindowButton_(kind);
            if !btn.is_null() {
                let _: () = msg_send![btn, setHidden: hidden];
            }
        }
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn set_traffic_lights(_window: &tauri::WebviewWindow, _visible: bool) -> Result<(), String> {
    Ok(())
}
