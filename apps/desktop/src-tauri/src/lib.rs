use font_kit::source::SystemSource;
use tauri::{Manager};
use media_session_reader::current_track;
use media_session_reader::Track;
mod mouse;
use base64::{
    engine::general_purpose,
    Engine as _,
};
use std::panic;
use serde::Serialize;
use std::collections::HashMap;

#[tauri::command]
fn get_installed_fonts() -> Vec<String> {
    let source = SystemSource::new();
    source.all_families().unwrap_or_default()
}


#[derive(Debug, Serialize)]
pub struct FrontendTrack {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub cover: Option<String>,
    pub duration_ms: u64,
    pub position_ms: u64,
    pub playing: bool,
}


impl From<Track> for FrontendTrack {
    fn from(track: Track) -> Self {
        let cover =
            track.cover.map(|cover| {
                format!(
                    "data:{};base64,{}",
                    cover.mime,
                    general_purpose::STANDARD.encode(cover.data)
                )

            });
        Self {
            title: track.title,
            artist: track.artist,
            album: track.album,
            cover,
            duration_ms: track.duration_ms,
            position_ms: track.position_ms,
            playing: track.playing,
            album_artist: track.album_artist,
        }
    }
}


#[tauri::command]
fn get_current_track() -> Option<FrontendTrack> {
    match panic::catch_unwind(|| {
        current_track().map(FrontendTrack::from)
    }) {
        Ok(track) => track,
        Err(err) => {
            eprintln!("Panic caught: {:?}", err);
            None
        }
    }
}

#[tauri::command]
async fn http_get(
    url: String,
    headers: HashMap<String, String>,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(false)
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.get(&url);
    for (k, v) in &headers {
        req = req.header(k.as_str(), v.as_str());
    }

    let res = req.send().await.map_err(|e| e.to_string())?;
    res.text().await.map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      Some(vec![])
    ))
    .setup(|app| {
      app.manage(mouse::MouseProcessState {
        is_running: std::sync::Mutex::new(false),
      });

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_installed_fonts,
      mouse::start_global_mouse_stream,
      mouse::stop_global_mouse_stream,
      get_current_track,
      http_get
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}