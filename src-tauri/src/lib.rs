use std::collections::VecDeque;
use std::path::Path;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_fs::FsExt;

#[derive(Default)]
struct PendingProjectPaths(Mutex<VecDeque<String>>);

fn queue_project_path(app: &tauri::AppHandle, argument: &str, cwd: &Path) {
    let candidate = Path::new(argument);
    let candidate = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        cwd.join(candidate)
    };
    let is_project = candidate
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.to_ascii_lowercase().ends_with(".graphbuilder"));
    if !is_project {
        return;
    }
    let Ok(path) = candidate.canonicalize() else {
        return;
    };
    if !path.is_file() || app.fs_scope().allow_file(&path).is_err() {
        return;
    }
    if let Ok(mut pending) = app.state::<PendingProjectPaths>().0.lock() {
        pending.push_back(path.to_string_lossy().into_owned());
        let _ = app.emit("project-file-open", ());
    }
}

#[tauri::command]
fn take_pending_project_paths(pending: tauri::State<'_, PendingProjectPaths>) -> Vec<String> {
    pending
        .0
        .lock()
        .map(|mut paths| paths.drain(..).collect())
        .unwrap_or_default()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PendingProjectPaths::default())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            for argument in args.iter().skip(1) {
                queue_project_path(app, argument, Path::new(&cwd));
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![take_pending_project_paths])
        .setup(|app| {
            let cwd = std::env::current_dir().unwrap_or_default();
            for argument in std::env::args().skip(1) {
                queue_project_path(app.handle(), &argument, &cwd);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Graph Builder could not start");
}
