// OS keychain storage for the Anthropic API key. The key never touches the
// filesystem in plaintext — it lives in Windows Credential Manager (or
// macOS Keychain / libsecret on Linux).

use keyring::Entry;

const SERVICE: &str = "HermosaPDF";
const USER: &str = "anthropic-api-key";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, USER).map_err(|e| format!("keyring init: {e}"))
}

#[tauri::command]
pub fn ai_set_api_key(key: String) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("empty key".into());
    }
    entry()?
        .set_password(&key)
        .map_err(|e| format!("keyring set: {e}"))
}

#[tauri::command]
pub fn ai_get_api_key() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(k) => Ok(Some(k)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("keyring get: {e}")),
    }
}

#[tauri::command]
pub fn ai_clear_api_key() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("keyring delete: {e}")),
    }
}
