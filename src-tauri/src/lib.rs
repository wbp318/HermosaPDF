mod pdfops;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            pdfops::pdf_decrypt,
            pdfops::pdf_is_encrypted,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
