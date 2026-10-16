pub mod omr;
pub mod profile_fs;
pub mod remote_camera;

use profile_fs::ProfileFsState;
use remote_camera::RemoteCameraState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .manage(ProfileFsState::default())
        .manage(RemoteCameraState::default())
        .invoke_handler(tauri::generate_handler![
            profile_fs::store_open,
            profile_fs::store_get,
            profile_fs::store_put,
            profile_fs::store_delete,
            profile_fs::store_list,
            profile_fs::export_file,
            profile_fs::snapshot_dir_get,
            profile_fs::snapshot_dir_pick,
            profile_fs::snapshot_write,
            omr::process_exam_photo,
            remote_camera::remote_start,
            remote_camera::remote_stop,
            remote_camera::remote_status,
            remote_camera::remote_take,
            remote_camera::remote_report,
            remote_camera::remote_list_interfaces,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o aplicativo Tauri GabariTeX");
}

