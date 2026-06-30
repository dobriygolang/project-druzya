use keyring::Entry;

const KEYRING_SERVICE: &str = "online.druz9.hone";

fn vault_entry(user_id: &str) -> Result<Entry, String> {
    let uid = user_id.trim();
    if uid.is_empty() {
        return Err("userId required".into());
    }
    Entry::new(KEYRING_SERVICE, &format!("vault-passphrase:{uid}"))
        .map_err(|e| e.to_string())
}

pub fn load_passphrase(user_id: &str) -> Result<Option<String>, String> {
    let entry = vault_entry(user_id)?;
    match entry.get_password() {
        Ok(raw) if !raw.is_empty() => Ok(Some(raw)),
        Ok(_) => Ok(None),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn save_passphrase(user_id: &str, passphrase: &str) -> Result<(), String> {
    if passphrase.trim().is_empty() {
        return Err("passphrase empty".into());
    }
    let entry = vault_entry(user_id)?;
    entry.set_password(passphrase).map_err(|e| e.to_string())
}

pub fn clear_passphrase(user_id: &str) -> Result<(), String> {
    let entry = vault_entry(user_id)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
