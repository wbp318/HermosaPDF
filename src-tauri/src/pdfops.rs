use lopdf::Document;

fn save_to_bytes(doc: &mut Document) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    doc.save_to(&mut buf).map_err(|e| e.to_string())?;
    Ok(buf)
}

/// Try to decrypt a PDF. If not encrypted, returns bytes round-tripped through
/// lopdf (which also normalizes the XRef — useful for pdf-lib's stricter parser).
/// Tries the supplied password first; falls back to empty password (common for
/// owner-only encryption).
#[tauri::command]
pub fn pdf_decrypt(bytes: Vec<u8>, password: Option<String>) -> Result<Vec<u8>, String> {
    let mut doc = Document::load_mem(&bytes).map_err(|e| format!("load: {e}"))?;
    if doc.is_encrypted() {
        let first = password.clone().unwrap_or_default();
        if doc.decrypt(&first).is_err() {
            // Fall back to empty password if a non-empty one was supplied and failed
            if !first.is_empty() {
                doc.decrypt("")
                    .map_err(|e| format!("decrypt (empty fallback): {e}"))?;
            } else {
                return Err("decrypt: password required".into());
            }
        }
    }
    save_to_bytes(&mut doc)
}

/// Probe whether a PDF is encrypted without attempting to decrypt.
#[tauri::command]
pub fn pdf_is_encrypted(bytes: Vec<u8>) -> Result<bool, String> {
    let doc = Document::load_mem(&bytes).map_err(|e| format!("load: {e}"))?;
    Ok(doc.is_encrypted())
}

/// Open WebView devtools for the current window. Only does anything in debug builds.
#[tauri::command]
pub fn open_devtools(window: tauri::WebviewWindow) {
    #[cfg(debug_assertions)]
    window.open_devtools();
    #[cfg(not(debug_assertions))]
    let _ = window;
}
