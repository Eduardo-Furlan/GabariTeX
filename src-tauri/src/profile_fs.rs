use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default, Clone)]
pub struct ProfileFsState {
    write_lock: Arc<Mutex<()>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FsErrorCode {
    NotFound,
    DiskFull,
    Permission,
    InvalidKey,
    Io,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsCommandError {
    pub code: FsErrorCode,
    pub message: String,
}

impl FsCommandError {
    pub fn invalid_key(msg: impl Into<String>) -> Self {
        Self {
            code: FsErrorCode::InvalidKey,
            message: msg.into(),
        }
    }

    pub fn from_io(err: io::Error) -> Self {
        let code = match err.kind() {
            io::ErrorKind::NotFound => FsErrorCode::NotFound,
            io::ErrorKind::PermissionDenied => FsErrorCode::Permission,
            io::ErrorKind::StorageFull => FsErrorCode::DiskFull,
            _ => {
                // Fallback for OS error codes representing ENOSPC (28 on Linux/macOS, 112 on Windows)
                match err.raw_os_error() {
                    Some(28) | Some(112) => FsErrorCode::DiskFull,
                    _ => FsErrorCode::Io,
                }
            }
        };
        Self {
            code,
            message: err.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreOpenInfo {
    pub path: String,
    pub used_bytes: u64,
    pub removed_tmp: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DesktopConfig {
    pub backup_dir: Option<String>,
    pub last_snapshot_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotDirInfo {
    pub dir: String,
    pub last_snapshot_at: Option<String>,
}

const WINDOWS_RESERVED_NAMES: &[&str] = &[
    "con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8",
    "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
];

fn is_valid_id(id: &str) -> bool {
    if id.is_empty() || id.len() > 80 {
        return false;
    }
    if WINDOWS_RESERVED_NAMES.contains(&id) {
        return false;
    }
    let mut chars = id.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !first.is_ascii_lowercase() && !first.is_ascii_digit() {
        return false;
    }
    chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-')
}

fn is_valid_ext(ext: &str) -> bool {
    if ext.is_empty() || ext.len() > 5 {
        return false;
    }
    ext.chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
}

/// Validates a store key according to Plan 12 §4.2 and returns the relative path inside `profile/`.
pub fn resolve_key_relative_path(key: &str) -> Result<PathBuf, FsCommandError> {
    if key.contains("..") || key.contains('\\') || key.starts_with('/') {
        return Err(FsCommandError::invalid_key(format!(
            "Chave de armazenamento inválida: {key}"
        )));
    }

    match key {
        "meta" => Ok(PathBuf::from("meta.json")),
        "settings" => Ok(PathBuf::from("settings.json")),
        "classes" => Ok(PathBuf::from("classes.json")),
        "bank-meta" => Ok(PathBuf::from("bank-meta.json")),
        _ => {
            if let Some(id) = key.strip_prefix("exams/") {
                if is_valid_id(id) {
                    return Ok(PathBuf::from("exams").join(format!("{id}.json")));
                }
            } else if let Some(id) = key.strip_prefix("records/") {
                if is_valid_id(id) {
                    return Ok(PathBuf::from("records").join(format!("{id}.json")));
                }
            } else if let Some(id) = key.strip_prefix("bank/") {
                if is_valid_id(id) {
                    return Ok(PathBuf::from("bank").join(format!("{id}.json")));
                }
            } else if let Some(rest) = key.strip_prefix("assets/") {
                if let Some((id, ext)) = rest.split_once('.') {
                    if is_valid_id(id) && is_valid_ext(ext) {
                        return Ok(PathBuf::from("assets").join(format!("{id}.{ext}")));
                    }
                }
            }
            Err(FsCommandError::invalid_key(format!(
                "Chave de armazenamento inválida: {key}"
            )))
        }
    }
}

pub fn open_profile_dir(profile_root: &Path) -> Result<StoreOpenInfo, FsCommandError> {
    fs::create_dir_all(profile_root).map_err(FsCommandError::from_io)?;
    fs::create_dir_all(profile_root.join("exams")).map_err(FsCommandError::from_io)?;
    fs::create_dir_all(profile_root.join("records")).map_err(FsCommandError::from_io)?;
    fs::create_dir_all(profile_root.join("assets")).map_err(FsCommandError::from_io)?;
    fs::create_dir_all(profile_root.join("bank")).map_err(FsCommandError::from_io)?;

    let mut used_bytes = 0u64;
    let mut removed_tmp = 0usize;

    let subdirs = [
        profile_root.to_path_buf(),
        profile_root.join("exams"),
        profile_root.join("records"),
        profile_root.join("assets"),
        profile_root.join("bank"),
    ];

    for dir in &subdirs {
        let entries = fs::read_dir(dir).map_err(FsCommandError::from_io)?;
        for entry in entries {
            let entry = entry.map_err(FsCommandError::from_io)?;
            let path = entry.path();
            if path.is_file() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.contains(".tmp-") {
                    if fs::remove_file(&path).is_ok() {
                        removed_tmp += 1;
                    }
                } else if let Ok(meta) = entry.metadata() {
                    used_bytes += meta.len();
                }
            }
        }
    }

    Ok(StoreOpenInfo {
        path: profile_root.to_string_lossy().to_string(),
        used_bytes,
        removed_tmp,
    })
}

pub fn read_key_bytes(
    profile_root: &Path,
    key: &str,
    source: &str,
) -> Result<Vec<u8>, FsCommandError> {
    let rel = resolve_key_relative_path(key)?;
    let target = profile_root.join(&rel);
    let path = match source {
        "main" => target,
        "bak" => {
            let mut bak_os = target.into_os_string();
            bak_os.push(".bak");
            PathBuf::from(bak_os)
        }
        _ => {
            return Err(FsCommandError::invalid_key(format!(
                "Fonte inválida: {source}"
            )))
        }
    };
    fs::read(&path).map_err(FsCommandError::from_io)
}

pub fn write_key_atomic(
    profile_root: &Path,
    key: &str,
    bytes: &[u8],
) -> Result<(), FsCommandError> {
    let rel = resolve_key_relative_path(key)?;
    let target = profile_root.join(&rel);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(FsCommandError::from_io)?;
    }

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let mut tmp_os = target.clone().into_os_string();
    tmp_os.push(format!(".tmp-{nanos}"));
    let tmp_path = PathBuf::from(tmp_os);

    {
        let mut f = File::create(&tmp_path).map_err(FsCommandError::from_io)?;
        f.write_all(bytes).map_err(FsCommandError::from_io)?;
        f.sync_all().map_err(FsCommandError::from_io)?;
    }

    if target.exists() {
        let mut bak_os = target.clone().into_os_string();
        bak_os.push(".bak");
        let bak_path = PathBuf::from(bak_os);
        let _ = fs::rename(&target, &bak_path);
    }

    fs::rename(&tmp_path, &target).map_err(FsCommandError::from_io)?;

    if let Some(parent) = target.parent() {
        if let Ok(dir_file) = File::open(parent) {
            let _ = dir_file.sync_all();
        }
    }

    Ok(())
}

pub fn delete_key_files(profile_root: &Path, key: &str) -> Result<(), FsCommandError> {
    let rel = resolve_key_relative_path(key)?;
    let target = profile_root.join(&rel);
    if target.exists() {
        fs::remove_file(&target).map_err(FsCommandError::from_io)?;
    }
    let mut bak_os = target.into_os_string();
    bak_os.push(".bak");
    let bak_path = PathBuf::from(bak_os);
    if bak_path.exists() {
        let _ = fs::remove_file(&bak_path);
    }
    Ok(())
}

pub fn list_keys_with_prefix(
    profile_root: &Path,
    prefix: &str,
) -> Result<Vec<String>, FsCommandError> {
    let dir_name = match prefix {
        "exams/" => "exams",
        "records/" => "records",
        "assets/" => "assets",
        "bank/" => "bank",
        _ => {
            return Err(FsCommandError::invalid_key(format!(
                "Prefixo inválido: {prefix}"
            )))
        }
    };

    let dir_path = profile_root.join(dir_name);
    if !dir_path.exists() {
        return Ok(Vec::new());
    }

    let mut keys = std::collections::BTreeSet::new();
    let entries = fs::read_dir(&dir_path).map_err(FsCommandError::from_io)?;
    for entry in entries {
        let entry = entry.map_err(FsCommandError::from_io)?;
        if !entry.path().is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.contains(".tmp-") {
            continue;
        }
        let clean_name = name.strip_suffix(".bak").unwrap_or(&name);
        if dir_name == "assets" {
            let candidate = format!("assets/{clean_name}");
            if resolve_key_relative_path(&candidate).is_ok() {
                keys.insert(candidate);
            }
        } else if let Some(id) = clean_name.strip_suffix(".json") {
            let candidate = format!("{dir_name}/{id}");
            if resolve_key_relative_path(&candidate).is_ok() {
                keys.insert(candidate);
            }
        }
    }

    Ok(keys.into_iter().collect())
}

/// Checks if a filename matches `^gabaritex-\d{4}-\d{2}-\d{2}-\d{4}(-[a-z-]+)?\.zip$`
pub fn is_snapshot_filename(name: &str) -> bool {
    let Some(stem) = name.strip_suffix(".zip") else {
        return false;
    };
    let Some(rest) = stem.strip_prefix("gabaritex-") else {
        return false;
    };
    // Minimum length for YYYY-MM-DD-HHMM is 15 chars
    let Some(date_part) = rest.get(..15) else {
        return false;
    };
    let bytes = date_part.as_bytes();
    let digits_ok = [0, 1, 2, 3, 5, 6, 8, 9, 11, 12, 13, 14]
        .iter()
        .all(|&i| bytes[i].is_ascii_digit());
    let dashes_ok = bytes[4] == b'-' && bytes[7] == b'-' && bytes[10] == b'-';
    if !digits_ok || !dashes_ok {
        return false;
    }

    let suffix = &rest[15..];
    if suffix.is_empty() {
        return true;
    }
    if !suffix.starts_with('-') || suffix.len() < 2 {
        return false;
    }
    suffix[1..]
        .chars()
        .all(|c| c.is_ascii_lowercase() || c == '-')
}

pub fn rotate_snapshots_in_dir(backup_dir: &Path, keep: usize) -> Result<(), FsCommandError> {
    if !backup_dir.exists() {
        return Ok(());
    }
    let mut matches: Vec<String> = Vec::new();
    for entry in fs::read_dir(backup_dir).map_err(FsCommandError::from_io)? {
        let entry = entry.map_err(FsCommandError::from_io)?;
        if entry.path().is_file() {
            let name = entry.file_name().to_string_lossy().to_string();
            if is_snapshot_filename(&name) {
                matches.push(name);
            }
        }
    }
    matches.sort();
    if matches.len() > keep {
        let to_remove = matches.len() - keep;
        for old_name in matches.into_iter().take(to_remove) {
            let _ = fs::remove_file(backup_dir.join(old_name));
        }
    }
    Ok(())
}

fn get_profile_root(app: &AppHandle) -> Result<PathBuf, FsCommandError> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| FsCommandError {
            code: FsErrorCode::Io,
            message: e.to_string(),
        })?;
    Ok(base.join("profile"))
}

fn get_config_file_path(app: &AppHandle) -> Result<PathBuf, FsCommandError> {
    let base = app
        .path()
        .app_config_dir()
        .map_err(|e| FsCommandError {
            code: FsErrorCode::Io,
            message: e.to_string(),
        })?;
    fs::create_dir_all(&base).map_err(FsCommandError::from_io)?;
    Ok(base.join("config.json"))
}

fn load_desktop_config(app: &AppHandle) -> DesktopConfig {
    let Ok(path) = get_config_file_path(app) else {
        return DesktopConfig::default();
    };
    let Ok(bytes) = fs::read(path) else {
        return DesktopConfig::default();
    };
    serde_json::from_slice(&bytes).unwrap_or_default()
}

fn save_desktop_config(app: &AppHandle, cfg: &DesktopConfig) -> Result<(), FsCommandError> {
    let path = get_config_file_path(app)?;
    let bytes = serde_json::to_vec_pretty(cfg).map_err(|e| FsCommandError {
        code: FsErrorCode::Io,
        message: e.to_string(),
    })?;
    fs::write(path, bytes).map_err(FsCommandError::from_io)
}

fn resolve_backup_dir(app: &AppHandle, cfg: &DesktopConfig) -> Result<PathBuf, FsCommandError> {
    if let Some(ref custom) = cfg.backup_dir {
        if !custom.trim().is_empty() {
            return Ok(PathBuf::from(custom));
        }
    }
    if let Ok(doc_dir) = app.path().document_dir() {
        return Ok(doc_dir.join("GabariTeX").join("Backups"));
    }
    let data_dir = app.path().app_data_dir().map_err(|e| FsCommandError {
        code: FsErrorCode::Io,
        message: e.to_string(),
    })?;
    Ok(data_dir.join("backups"))
}

#[tauri::command]
pub async fn store_open(
    app: AppHandle,
    state: State<'_, ProfileFsState>,
) -> Result<StoreOpenInfo, FsCommandError> {
    let root = get_profile_root(&app)?;
    let lock = state.write_lock.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().unwrap_or_else(|e| e.into_inner());
        open_profile_dir(&root)
    })
    .await
    .map_err(|e| FsCommandError {
        code: FsErrorCode::Io,
        message: e.to_string(),
    })?
}

#[tauri::command]
pub async fn store_get(
    app: AppHandle,
    key: String,
    source: String,
) -> Result<tauri::ipc::Response, FsCommandError> {
    let root = get_profile_root(&app)?;
    let bytes = tauri::async_runtime::spawn_blocking(move || read_key_bytes(&root, &key, &source))
        .await
        .map_err(|e| FsCommandError {
            code: FsErrorCode::Io,
            message: e.to_string(),
        })??;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub async fn store_put(
    app: AppHandle,
    state: State<'_, ProfileFsState>,
    request: tauri::ipc::Request<'_>,
) -> Result<(), FsCommandError> {
    let key = request
        .headers()
        .get("x-store-key")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| FsCommandError::invalid_key("Cabeçalho x-store-key ausente"))?
        .to_string();

    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(raw) => raw.clone(),
        tauri::ipc::InvokeBody::Json(val) => serde_json::to_vec(val).map_err(|e| FsCommandError {
            code: FsErrorCode::Io,
            message: e.to_string(),
        })?,
    };

    let root = get_profile_root(&app)?;
    let lock = state.write_lock.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().unwrap_or_else(|e| e.into_inner());
        write_key_atomic(&root, &key, &bytes)
    })
    .await
    .map_err(|e| FsCommandError {
        code: FsErrorCode::Io,
        message: e.to_string(),
    })?
}

#[tauri::command]
pub async fn store_delete(
    app: AppHandle,
    state: State<'_, ProfileFsState>,
    key: String,
) -> Result<(), FsCommandError> {
    let root = get_profile_root(&app)?;
    let lock = state.write_lock.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().unwrap_or_else(|e| e.into_inner());
        delete_key_files(&root, &key)
    })
    .await
    .map_err(|e| FsCommandError {
        code: FsErrorCode::Io,
        message: e.to_string(),
    })?
}

#[tauri::command]
pub async fn store_list(app: AppHandle, prefix: String) -> Result<Vec<String>, FsCommandError> {
    let root = get_profile_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || list_keys_with_prefix(&root, &prefix))
        .await
        .map_err(|e| FsCommandError {
            code: FsErrorCode::Io,
            message: e.to_string(),
        })?
}

fn percent_decode(input: &str) -> String {
    let mut out = Vec::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex_str) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                if let Ok(val) = u8::from_str_radix(hex_str, 16) {
                    out.push(val);
                    i += 3;
                    continue;
                }
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

#[tauri::command]
pub async fn export_file(
    app: AppHandle,
    request: tauri::ipc::Request<'_>,
) -> Result<Option<String>, FsCommandError> {
    let raw_name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("arquivo");
    let suggested_name = percent_decode(raw_name);

    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(raw) => raw.clone(),
        tauri::ipc::InvokeBody::Json(val) => serde_json::to_vec(val).map_err(|e| FsCommandError {
            code: FsErrorCode::Io,
            message: e.to_string(),
        })?,
    };

    tauri::async_runtime::spawn_blocking(move || {
        let picked = app
            .dialog()
            .file()
            .set_file_name(&suggested_name)
            .blocking_save_file();
        let Some(file_path) = picked else {
            return Ok(None);
        };
        let path_buf = file_path.into_path().map_err(|e| FsCommandError {
            code: FsErrorCode::Io,
            message: e.to_string(),
        })?;
        fs::write(&path_buf, &bytes).map_err(FsCommandError::from_io)?;
        Ok(Some(path_buf.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| FsCommandError {
        code: FsErrorCode::Io,
        message: e.to_string(),
    })?
}

#[tauri::command]
pub async fn snapshot_dir_get(app: AppHandle) -> Result<SnapshotDirInfo, FsCommandError> {
    let cfg = load_desktop_config(&app);
    let dir = resolve_backup_dir(&app, &cfg)?;
    Ok(SnapshotDirInfo {
        dir: dir.to_string_lossy().to_string(),
        last_snapshot_at: cfg.last_snapshot_at,
    })
}

#[tauri::command]
pub async fn snapshot_dir_pick(app: AppHandle) -> Result<Option<String>, FsCommandError> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let picked = app_clone.dialog().file().blocking_pick_folder();
        let Some(folder) = picked else {
            return Ok(None);
        };
        let path_buf = folder.into_path().map_err(|e| FsCommandError {
            code: FsErrorCode::Io,
            message: e.to_string(),
        })?;
        let dir_str = path_buf.to_string_lossy().to_string();
        let mut cfg = load_desktop_config(&app_clone);
        cfg.backup_dir = Some(dir_str.clone());
        save_desktop_config(&app_clone, &cfg)?;
        Ok(Some(dir_str))
    })
    .await
    .map_err(|e| FsCommandError {
        code: FsErrorCode::Io,
        message: e.to_string(),
    })?
}

#[tauri::command]
pub async fn snapshot_write(
    app: AppHandle,
    state: State<'_, ProfileFsState>,
    request: tauri::ipc::Request<'_>,
) -> Result<String, FsCommandError> {
    let file_name = request
        .headers()
        .get("x-snapshot-name")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| FsCommandError::invalid_key("Cabeçalho x-snapshot-name ausente"))?
        .to_string();

    if !is_snapshot_filename(&file_name) {
        return Err(FsCommandError::invalid_key(format!(
            "Nome de snapshot inválido: {file_name}"
        )));
    }

    let iso_now = request
        .headers()
        .get("x-snapshot-timestamp")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(raw) => raw.clone(),
        tauri::ipc::InvokeBody::Json(val) => serde_json::to_vec(val).map_err(|e| FsCommandError {
            code: FsErrorCode::Io,
            message: e.to_string(),
        })?,
    };

    let lock = state.write_lock.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().unwrap_or_else(|e| e.into_inner());
        let mut cfg = load_desktop_config(&app);
        let dir = resolve_backup_dir(&app, &cfg)?;
        fs::create_dir_all(&dir).map_err(FsCommandError::from_io)?;
        let target = dir.join(&file_name);
        fs::write(&target, &bytes).map_err(FsCommandError::from_io)?;
        rotate_snapshots_in_dir(&dir, 10)?;
        if let Some(ts) = iso_now {
            cfg.last_snapshot_at = Some(ts);
            let _ = save_desktop_config(&app, &cfg);
        }
        Ok(file_name)
    })
    .await
    .map_err(|e| FsCommandError {
        code: FsErrorCode::Io,
        message: e.to_string(),
    })?
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_key_validation_accepts_valid_keys() {
        assert!(resolve_key_relative_path("meta").is_ok());
        assert!(resolve_key_relative_path("settings").is_ok());
        assert!(resolve_key_relative_path("classes").is_ok());
        assert!(resolve_key_relative_path("bank-meta").is_ok());
        assert!(resolve_key_relative_path("exams/prova-nova").is_ok());
        assert!(resolve_key_relative_path("exams/550e8400-e29b-41d4-a716-446655440000").is_ok());
        assert!(resolve_key_relative_path("records/prova-mat-2026-1").is_ok());
        assert!(resolve_key_relative_path("bank/550e8400-e29b-41d4-a716-446655440000").is_ok());
        assert!(resolve_key_relative_path("bank/q-mat-1").is_ok());
        assert!(resolve_key_relative_path("assets/a1b2c3d4.png").is_ok());
        assert!(resolve_key_relative_path("assets/9f8e7d.jpeg").is_ok());
    }

    #[test]
    fn test_key_validation_rejects_invalid_keys() {
        assert!(resolve_key_relative_path("../meta").is_err());
        assert!(resolve_key_relative_path("exams/../meta").is_err());
        assert!(resolve_key_relative_path("bank/../meta").is_err());
        assert!(resolve_key_relative_path("bank/../x").is_err());
        assert!(resolve_key_relative_path("/etc/passwd").is_err());
        assert!(resolve_key_relative_path("C:\\Users\\test").is_err());
        assert!(resolve_key_relative_path("exams/CON").is_err());
        assert!(resolve_key_relative_path("exams/con").is_err());
        assert!(resolve_key_relative_path("bank/CON").is_err());
        assert!(resolve_key_relative_path("bank/con").is_err());
        assert!(resolve_key_relative_path("exams/lpt1").is_err());
        assert!(resolve_key_relative_path("exams/ProvaMaiuscula").is_err());
        assert!(resolve_key_relative_path("bank/UPPER").is_err());
        assert!(resolve_key_relative_path("exams/").is_err());
        assert!(resolve_key_relative_path("bank/").is_err());
        let long_id = "a".repeat(81);
        assert!(resolve_key_relative_path(&format!("exams/{long_id}")).is_err());
        assert!(resolve_key_relative_path(&format!("bank/{long_id}")).is_err());
        assert!(resolve_key_relative_path("assets/abc.too_long_ext").is_err());
    }

    #[test]
    fn test_atomic_write_and_bak_recovery() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        write_key_atomic(root, "exams/prova-1", b"{\"v\":1}").unwrap();
        let read1 = read_key_bytes(root, "exams/prova-1", "main").unwrap();
        assert_eq!(read1, b"{\"v\":1}");

        // Second write moves v1 to .bak
        write_key_atomic(root, "exams/prova-1", b"{\"v\":2}").unwrap();
        let read_main = read_key_bytes(root, "exams/prova-1", "main").unwrap();
        let read_bak = read_key_bytes(root, "exams/prova-1", "bak").unwrap();
        assert_eq!(read_main, b"{\"v\":2}");
        assert_eq!(read_bak, b"{\"v\":1}");

        // Simulate missing main target -> .bak is still intact
        fs::remove_file(root.join("exams/prova-1.json")).unwrap();
        assert_eq!(
            read_key_bytes(root, "exams/prova-1", "main").unwrap_err().code,
            FsErrorCode::NotFound
        );
        assert_eq!(
            read_key_bytes(root, "exams/prova-1", "bak").unwrap(),
            b"{\"v\":1}"
        );
    }

    #[test]
    fn test_store_open_removes_tmp_and_preserves_valid_files() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        open_profile_dir(root).unwrap();

        write_key_atomic(root, "settings", b"{}").unwrap();
        let orphan_tmp = root.join("exams/prova-1.json.tmp-99999");
        fs::write(&orphan_tmp, b"partial").unwrap();

        let info = open_profile_dir(root).unwrap();
        assert_eq!(info.removed_tmp, 1);
        assert!(!orphan_tmp.exists());
        assert!(root.join("settings.json").exists());
    }

    #[test]
    fn test_snapshot_rotation_keeps_10_and_ignores_unrelated_files() {
        let dir = tempdir().unwrap();
        let backup_dir = dir.path();

        fs::write(backup_dir.join("notas-importantes.txt"), b"keep me").unwrap();
        fs::write(backup_dir.join("outro-arquivo.zip"), b"keep me too").unwrap();

        for i in 1..=13 {
            let name = format!("gabaritex-2026-10-{i:02}-0930-auto.zip");
            fs::write(backup_dir.join(name), b"zipdata").unwrap();
        }

        rotate_snapshots_in_dir(backup_dir, 10).unwrap();

        assert!(backup_dir.join("notas-importantes.txt").exists());
        assert!(backup_dir.join("outro-arquivo.zip").exists());

        // Days 01, 02, 03 should be rotated out; 04..=13 kept
        assert!(!backup_dir.join("gabaritex-2026-10-01-0930-auto.zip").exists());
        assert!(!backup_dir.join("gabaritex-2026-10-03-0930-auto.zip").exists());
        assert!(backup_dir.join("gabaritex-2026-10-04-0930-auto.zip").exists());
        assert!(backup_dir.join("gabaritex-2026-10-13-0930-auto.zip").exists());
    }

    #[test]
    fn test_snapshot_filename_non_ascii_does_not_panic() {
        assert!(!is_snapshot_filename("gabaritex-2026-10-01-093é.zip"));

        let dir = tempdir().unwrap();
        let backup_dir = dir.path();

        let odd_file = "gabaritex-2026-10-01-093é.zip";
        fs::write(backup_dir.join(odd_file), b"odd").unwrap();
        fs::write(
            backup_dir.join("gabaritex-2026-10-01-0930-auto.zip"),
            b"valid1",
        )
        .unwrap();
        fs::write(
            backup_dir.join("gabaritex-2026-10-02-0930-auto.zip"),
            b"valid2",
        )
        .unwrap();

        rotate_snapshots_in_dir(backup_dir, 1).unwrap();

        assert!(backup_dir.join(odd_file).exists());
        assert!(!backup_dir.join("gabaritex-2026-10-01-0930-auto.zip").exists());
        assert!(backup_dir.join("gabaritex-2026-10-02-0930-auto.zip").exists());
    }

    #[test]
    fn test_bank_key_atomic_write_and_listing() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        open_profile_dir(root).unwrap();

        // 1. Write bank-meta
        write_key_atomic(root, "bank-meta", b"{\"schema\":1,\"groups\":[]}").unwrap();
        let meta_bytes = read_key_bytes(root, "bank-meta", "main").unwrap();
        assert_eq!(meta_bytes, b"{\"schema\":1,\"groups\":[]}");

        // 2. Write bank question
        write_key_atomic(root, "bank/q-test-1", b"{\"id\":\"q-test-1\",\"prompt\":\"Test\"}").unwrap();
        let q1_bytes = read_key_bytes(root, "bank/q-test-1", "main").unwrap();
        assert_eq!(q1_bytes, b"{\"id\":\"q-test-1\",\"prompt\":\"Test\"}");

        // 3. Update question (checks .bak creation)
        write_key_atomic(root, "bank/q-test-1", b"{\"id\":\"q-test-1\",\"prompt\":\"Updated\"}").unwrap();
        let q1_main = read_key_bytes(root, "bank/q-test-1", "main").unwrap();
        let q1_bak = read_key_bytes(root, "bank/q-test-1", "bak").unwrap();
        assert_eq!(q1_main, b"{\"id\":\"q-test-1\",\"prompt\":\"Updated\"}");
        assert_eq!(q1_bak, b"{\"id\":\"q-test-1\",\"prompt\":\"Test\"}");

        // 4. Write second question and list with prefix
        write_key_atomic(root, "bank/q-test-2", b"{\"id\":\"q-test-2\"}").unwrap();
        let keys = list_keys_with_prefix(root, "bank/").unwrap();
        assert_eq!(keys, vec!["bank/q-test-1".to_string(), "bank/q-test-2".to_string()]);

        // 5. Delete question
        delete_key_files(root, "bank/q-test-1").unwrap();
        let keys_after = list_keys_with_prefix(root, "bank/").unwrap();
        assert_eq!(keys_after, vec!["bank/q-test-2".to_string()]);
    }
}
