fn main() {
    let commands = tauri_build::AppManifest::new().commands(&[
        "get_settings",
        "set_graphics",
        "set_fullscreen",
        "close_game",
    ]);
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(commands))
        .expect("failed to configure the Tauri build");
}
