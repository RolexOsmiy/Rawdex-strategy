#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{Manager, State, WebviewWindow, WebviewWindowBuilder};

#[derive(Clone, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
struct Settings {
    fullscreen: bool,
    render_scale: f32,
    msaa: bool,
    fps_counter: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            fullscreen: true,
            render_scale: 1.0,
            msaa: true,
            fps_counter: false,
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphicsPatch {
    render_scale: Option<f32>,
    msaa: Option<bool>,
    fps_counter: Option<bool>,
}

struct SettingsFile {
    path: PathBuf,
    settings: Mutex<Settings>,
}

impl SettingsFile {
    fn load(path: PathBuf) -> Self {
        let read = |path: &Path| {
            let data = fs::read(path)?;
            Ok::<Settings, std::io::Error>(serde_json::from_slice(&data)?)
        };
        let settings = read(path.as_path())
            .or_else(|_| {
                #[cfg(windows)]
                if let Some(app_data) = std::env::var_os("APPDATA") {
                    let legacy = PathBuf::from(app_data).join("Балтийские пути/settings.json");
                    return read(legacy.as_path());
                }
                Ok(Settings::default())
            })
            .unwrap_or_default();
        Self {
            path,
            settings: Mutex::new(settings),
        }
    }

    fn update(&self, apply: impl FnOnce(&mut Settings)) -> Result<(), String> {
        let mut current = self.settings.lock().map_err(|error| error.to_string())?;
        apply(&mut current);
        let dir = self.path.parent().expect("settings path has a parent");
        let data = serde_json::to_vec_pretty(&*current).map_err(|error| error.to_string())?;
        let temporary = self.path.with_extension("tmp");
        fs::create_dir_all(dir)
            .and_then(|_| fs::write(&temporary, data))
            .and_then(|_| fs::rename(&temporary, &self.path))
            .map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn get_settings(state: State<SettingsFile>) -> Result<Settings, String> {
    state
        .settings
        .lock()
        .map(|settings| settings.clone())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_graphics(patch: GraphicsPatch, state: State<SettingsFile>) -> Result<(), String> {
    state.update(|settings| {
        if let Some(scale @ (0.5 | 0.75 | 1.0)) = patch.render_scale {
            settings.render_scale = scale;
        }
        if let Some(msaa) = patch.msaa {
            settings.msaa = msaa;
        }
        if let Some(fps_counter) = patch.fps_counter {
            settings.fps_counter = fps_counter;
        }
    })
}

#[tauri::command]
fn set_fullscreen(
    window: WebviewWindow,
    on: bool,
    state: State<SettingsFile>,
) -> Result<bool, String> {
    window
        .set_fullscreen(on)
        .map_err(|error| error.to_string())?;
    if let Err(error) = state.update(|settings| settings.fullscreen = on) {
        eprintln!("Не удалось сохранить полноэкранный режим: {error}");
    }
    Ok(on)
}

#[tauri::command]
fn close_game(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            get_settings,
            set_graphics,
            set_fullscreen,
            close_game
        ])
        .setup(|app| {
            let settings = SettingsFile::load(app.path().app_config_dir()?.join("settings.json"));
            let fullscreen = settings.settings.lock().unwrap().fullscreen;
            app.manage(settings);

            WebviewWindowBuilder::from_config(app, &app.config().app.windows[0])?
                .fullscreen(fullscreen)
                .initialization_script(include_str!("native-settings.js"))
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("не удалось запустить «Балтийские пути»");
}
