#[cfg(target_os = "macos")]
pub fn run_shortcut(name: &str) -> crate::FocusModeResult {
    use std::process::Command;
    let name = name.trim();
    if name.is_empty() {
        return crate::FocusModeResult {
            ok: false,
            error: Some("focus name is empty".into()),
        };
    }
    match Command::new("shortcuts").arg("run").arg(name).output() {
        Ok(out) if out.status.success() => crate::FocusModeResult {
            ok: true,
            error: None,
        },
        Ok(out) => crate::FocusModeResult {
            ok: false,
            error: Some(
                String::from_utf8_lossy(&out.stderr)
                    .trim()
                    .to_string(),
            ),
        },
        Err(e) => crate::FocusModeResult {
            ok: false,
            error: Some(e.to_string()),
        },
    }
}

#[cfg(not(target_os = "macos"))]
pub fn run_shortcut(_name: &str) -> crate::FocusModeResult {
    crate::FocusModeResult {
        ok: false,
        error: Some("macOS Focus shortcuts are not supported on this platform".into()),
    }
}
