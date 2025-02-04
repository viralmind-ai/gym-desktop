use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use display_info::DisplayInfo;
use serde_json;
use std::io::Cursor;
use tauri::{Emitter, Manager};
use window_vibrancy::*;
use xcap::{image::ImageFormat, Monitor};
mod axtree;
mod ffmpeg;
mod input;
mod logger;
mod record;

use record::{start_recording, stop_recording, QuestState};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn take_screenshot() -> Result<String, String> {
    // Get primary monitor
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let primary = monitors
        .into_iter()
        .next()
        .ok_or_else(|| "No monitor found".to_string())?;

    // Capture image
    let xcap_image = primary.capture_image().map_err(|e| e.to_string())?;

    // Convert to PNG bytes
    let mut buffer = Vec::new();
    let mut cursor = Cursor::new(&mut buffer);
    xcap_image
        .write_to(&mut cursor, ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    // Convert to base64
    Ok(format!("data:image/png;base64,{}", BASE64.encode(&buffer)))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize FFmpeg and dump-tree synchronously before starting Tauri
    if let Err(e) = ffmpeg::init_ffmpeg() {
        eprintln!("Failed to initialize FFmpeg: {}", e);
        std::process::exit(1);
    }

    if let Err(e) = axtree::init_dump_tree() {
        eprintln!("Failed to initialize dump-tree: {}", e);
        std::process::exit(1);
    }

    let _app = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .manage(QuestState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            start_recording,
            stop_recording,
            take_screenshot,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            #[cfg(target_os = "windows")]
            apply_mica(&window, Some(true))
                .expect("Unsupported platform! 'apply_mica' is only supported on Windows");

            // TODO: multimonitor support
            // Get primary display info
            let displays =
                DisplayInfo::all().map_err(|e| format!("Failed to get display info: {}", e))?;
            let primary = displays
                .iter()
                .find(|d| d.is_primary)
                .or_else(|| displays.first())
                .ok_or_else(|| "No display found".to_string())?;

            // Create transparent overlay window
            let overlay_window = tauri::WebviewWindowBuilder::new(
                app,
                "overlay",
                tauri::WebviewUrl::App("overlay".into()),
            )
            .transparent(true)
            .always_on_top(true)
            .decorations(false)
            .focused(false)
            .shadow(false)
            .position(primary.x as f64, primary.y as f64)
            .inner_size(primary.width as f64, primary.height as f64)
            .skip_taskbar(true)
            .visible_on_all_workspaces(true)
            .build()?;

            overlay_window.set_ignore_cursor_events(true)?;

            // Emit initial recording status
            app.emit(
                "recording-status",
                serde_json::json!({
                    "state": "stopped"
                }),
            )
            .unwrap();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
