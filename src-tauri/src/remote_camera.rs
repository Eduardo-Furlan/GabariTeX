use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, Path, State as AxumState};
use axum::http::header::{HeaderMap, HeaderValue, CACHE_CONTROL, CONTENT_TYPE};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use subtle::ConstantTimeEq;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{oneshot, Mutex as TokioMutex, RwLock};

pub const DEFAULT_PORT: u16 = 47831;
pub const MAX_PHOTO_BYTES: usize = 25 * 1024 * 1024; // 25 MB
pub const MAX_PENDING_PHOTOS: usize = 60;
pub const MAX_PENDING_BYTES: usize = 400 * 1024 * 1024; // 400 MB
pub const PHOTO_TTL: Duration = Duration::from_secs(600); // 10 min
pub const SESSION_IDLE_TIMEOUT: Duration = Duration::from_secs(1800); // 30 min

const INDEX_HTML: &str = include_str!("../remote/index.html");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInterfaceInfo {
    pub name: String,
    pub ip: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteSessionInfo {
    pub url: String,
    pub ip: String,
    pub port: u16,
    pub token: String,
    pub interfaces: Vec<NetworkInterfaceInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PhotoProcessingStatus {
    Received,
    Processing,
    Ok,
    Review,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoFeedback {
    pub status: PhotoProcessingStatus,
    pub label: Option<String>,
    pub message: Option<String>,
}

pub struct PhotoItem {
    pub id: String,
    pub bytes: Vec<u8>,
    pub mime: String,
    pub target: String,
    pub received_at: Instant,
    pub feedback: PhotoFeedback,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemotePhotoEvent {
    pub id: String,
    pub size: usize,
    pub mime: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteStoppedEvent {
    pub reason: String,
}

pub struct ActiveSession {
    pub ip: String,
    pub port: u16,
    pub token: String,
    pub shutdown_tx: Option<oneshot::Sender<()>>,
    pub photos: Arc<RwLock<HashMap<String, PhotoItem>>>,
    pub last_activity: Arc<AtomicU64>,
}

#[derive(Default)]
pub struct RemoteCameraState {
    pub session: TokioMutex<Option<ActiveSession>>,
}

#[derive(Clone)]
pub(crate) struct AppServerState {
    pub(crate) token: String,
    pub(crate) photos: Arc<RwLock<HashMap<String, PhotoItem>>>,
    pub(crate) last_activity: Arc<AtomicU64>,
    pub(crate) app_handle: Option<AppHandle>,
}

fn current_epoch_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub fn constant_time_compare(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.as_bytes().ct_eq(b.as_bytes()).into()
}

pub fn validate_image_magic(bytes: &[u8]) -> Result<&'static str, &'static str> {
    if bytes.len() >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF {
        return Ok("image/jpeg");
    }
    if bytes.len() >= 8 && &bytes[0..8] == b"\x89PNG\r\n\x1a\n" {
        return Ok("image/png");
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Ok("image/webp");
    }
    Err("Formato de imagem inválido. Envie JPEG, PNG ou WebP.")
}

pub fn is_private_ipv4(ip: &std::net::Ipv4Addr) -> bool {
    let oct = ip.octets();
    (oct[0] == 10)
        || (oct[0] == 172 && oct[1] >= 16 && oct[1] <= 31)
        || (oct[0] == 192 && oct[1] == 168)
}

pub fn is_virtual_or_loopback_interface(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.starts_with("lo")
        || lower.starts_with("docker")
        || lower.starts_with("br-")
        || lower.starts_with("veth")
        || lower.starts_with("virbr")
        || lower.starts_with("vmnet")
        || lower.starts_with("tailscale")
        || lower.starts_with("tun")
}

pub fn list_network_interfaces() -> Vec<NetworkInterfaceInfo> {
    let mut result = Vec::new();

    if let Ok(ifaces) = local_ip_address::list_afinet_netifas() {
        for (name, ip) in ifaces {
            if is_virtual_or_loopback_interface(&name) {
                continue;
            }
            if let IpAddr::V4(ipv4) = ip {
                if is_private_ipv4(&ipv4) && !ipv4.is_loopback() && !ipv4.is_link_local() {
                    let ip_str = ipv4.to_string();
                    if !result.iter().any(|item: &NetworkInterfaceInfo| item.ip == ip_str) {
                        result.push(NetworkInterfaceInfo {
                            name,
                            ip: ip_str,
                        });
                    }
                }
            }
        }
    }

    // Tenta colocar a rota padrão como primeiro item da lista
    if let Ok(IpAddr::V4(default_ip)) = local_ip_address::local_ip() {
        let def_str = default_ip.to_string();
        if let Some(pos) = result.iter().position(|i| i.ip == def_str) {
            if pos != 0 {
                let item = result.remove(pos);
                result.insert(0, item);
            }
        } else if is_private_ipv4(&default_ip) {
            result.insert(
                0,
                NetworkInterfaceInfo {
                    name: "default".to_string(),
                    ip: def_str,
                },
            );
        }
    }

    result
}

pub fn generate_session_token() -> String {
    let mut buf = [0u8; 16];
    if getrandom::getrandom(&mut buf).is_err() {
        // Fallback defensivo com timestamp
        let now = current_epoch_seconds();
        buf[0..8].copy_from_slice(&now.to_le_bytes());
    }
    URL_SAFE_NO_PAD.encode(buf)
}

pub(crate) fn build_remote_router(server_state: AppServerState) -> Router {
    Router::new()
        .route("/", get(handle_index))
        .route("/api/photo", post(handle_upload_photo))
        .route("/api/photo/:id", get(handle_get_photo_status))
        .layer(DefaultBodyLimit::max(MAX_PHOTO_BYTES))
        .with_state(server_state)
}

async fn handle_index() -> Response {
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("text/html; charset=utf-8"));
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert("X-Content-Type-Options", HeaderValue::from_static("nosniff"));
    (headers, INDEX_HTML).into_response()
}

fn check_auth(headers: &HeaderMap, expected_token: &str) -> Result<(), StatusCode> {
    let token_header = headers
        .get("x-gabaritex-token")
        .and_then(|v| v.to_str().ok());

    match token_header {
        Some(t) if constant_time_compare(t, expected_token) => Ok(()),
        _ => Err(StatusCode::UNAUTHORIZED),
    }
}

async fn handle_upload_photo(
    AxumState(state): AxumState<AppServerState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, StatusCode> {
    check_auth(&headers, &state.token)?;

    state.last_activity.store(current_epoch_seconds(), Ordering::Relaxed);

    if body.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let mime = validate_image_magic(&body).map_err(|_| StatusCode::BAD_REQUEST)?;

    let mut map = state.photos.write().await;

    // Remove fotos expiradas (> 10 min)
    let now = Instant::now();
    map.retain(|_, v| now.duration_since(v.received_at) < PHOTO_TTL);

    let current_bytes: usize = map.values().map(|v| v.bytes.len()).sum();
    if map.len() >= MAX_PENDING_PHOTOS || current_bytes + body.len() > MAX_PENDING_BYTES {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    let target = headers
        .get("x-gabaritex-target")
        .and_then(|v| v.to_str().ok())
        .map(|s| {
            if s.eq_ignore_ascii_case("sheet") {
                "sheet".to_string()
            } else {
                "qr".to_string()
            }
        })
        .unwrap_or_else(|| "qr".to_string());

    let photo_id = format!(
        "p_{}_{:06x}",
        current_epoch_seconds(),
        rand_u32() & 0xFFFFFF
    );

    let photo_item = PhotoItem {
        id: photo_id.clone(),
        bytes: body.to_vec(),
        mime: mime.to_string(),
        target: target.clone(),
        received_at: now,
        feedback: PhotoFeedback {
            status: PhotoProcessingStatus::Received,
            label: None,
            message: None,
        },
    };

    let photo_size = photo_item.bytes.len();
    let photo_mime = photo_item.mime.clone();
    map.insert(photo_id.clone(), photo_item);

    // Emite evento para a interface do Tauri no desktop
    if let Some(app) = &state.app_handle {
        match app.emit(
            "remote:photo",
            RemotePhotoEvent {
                id: photo_id.clone(),
                size: photo_size,
                mime: photo_mime,
                target,
            },
        ) {
            Ok(_) => println!("[RemoteCamera] Evento remote:photo emitido com sucesso: {photo_id}"),
            Err(e) => eprintln!("[RemoteCamera] Erro ao emitir remote:photo: {e}"),
        }
    }

    let response_body = serde_json::json!({ "id": photo_id });
    let mut resp = (StatusCode::ACCEPTED, Json(response_body)).into_response();
    resp.headers_mut().insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    resp.headers_mut().insert("X-Content-Type-Options", HeaderValue::from_static("nosniff"));
    Ok(resp)
}

async fn handle_get_photo_status(
    AxumState(state): AxumState<AppServerState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, StatusCode> {
    check_auth(&headers, &state.token)?;

    state.last_activity.store(current_epoch_seconds(), Ordering::Relaxed);

    let map = state.photos.read().await;
    match map.get(&id) {
        Some(item) => {
            let mut resp = Json(&item.feedback).into_response();
            resp.headers_mut().insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
            resp.headers_mut().insert("X-Content-Type-Options", HeaderValue::from_static("nosniff"));
            Ok(resp)
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

fn rand_u32() -> u32 {
    let mut b = [0u8; 4];
    let _ = getrandom::getrandom(&mut b);
    u32::from_le_bytes(b)
}

#[tauri::command]
pub async fn remote_list_interfaces() -> Result<Vec<NetworkInterfaceInfo>, String> {
    Ok(list_network_interfaces())
}

#[tauri::command]
pub async fn remote_status(
    state: State<'_, RemoteCameraState>,
) -> Result<Option<RemoteSessionInfo>, String> {
    let guard = state.session.lock().await;
    let Some(active) = guard.as_ref() else {
        return Ok(None);
    };

    let interfaces = list_network_interfaces();
    let url = format!("http://{}:{}/#t={}", active.ip, active.port, active.token);
    Ok(Some(RemoteSessionInfo {
        url,
        ip: active.ip.clone(),
        port: active.port,
        token: active.token.clone(),
        interfaces,
    }))
}

#[tauri::command]
pub async fn remote_start(
    app: AppHandle,
    state: State<'_, RemoteCameraState>,
    ip: Option<String>,
) -> Result<RemoteSessionInfo, String> {
    let mut guard = state.session.lock().await;

    // Se já houver sessão ativa, interrompe
    if let Some(old) = guard.take() {
        if let Some(tx) = old.shutdown_tx {
            let _ = tx.send(());
        }
    }

    let interfaces = list_network_interfaces();
    let selected_ip = match ip {
        Some(chosen) if interfaces.iter().any(|i| i.ip == chosen) => chosen,
        _ => {
            if let Some(first) = interfaces.first() {
                first.ip.clone()
            } else {
                "127.0.0.1".to_string()
            }
        }
    };

    let parsed_ip: IpAddr = selected_ip
        .parse()
        .map_err(|e| format!("IP inválido ({selected_ip}): {e}"))?;

    // Tenta a porta preferida 47831, ou porta livre atribuída pelo SO
    let (listener, actual_port) = match tokio::net::TcpListener::bind(SocketAddr::new(parsed_ip, DEFAULT_PORT)).await {
        Ok(l) => (l, DEFAULT_PORT),
        Err(_) => {
            let l = tokio::net::TcpListener::bind(SocketAddr::new(parsed_ip, 0))
                .await
                .map_err(|e| format!("Não foi possível vincular porta em {selected_ip}: {e}"))?;
            let p = l.local_addr().map_err(|e| e.to_string())?.port();
            (l, p)
        }
    };

    let token = generate_session_token();
    let photos = Arc::new(RwLock::new(HashMap::new()));
    let last_activity = Arc::new(AtomicU64::new(current_epoch_seconds()));
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    let server_state = AppServerState {
        token: token.clone(),
        photos: photos.clone(),
        last_activity: last_activity.clone(),
        app_handle: Some(app.clone()),
    };

    let router = build_remote_router(server_state);

    let app_clone = app.clone();
    let last_act_for_monitor = last_activity.clone();

    // Spawn do servidor HTTP
    tauri::async_runtime::spawn(async move {
        let server = axum::serve(listener, router).with_graceful_shutdown(async move {
            let _ = shutdown_rx.await;
        });
        if let Err(err) = server.await {
            eprintln!("[RemoteCamera] Erro no servidor HTTP: {err}");
        }
    });

    // Spawn do monitor de ociosidade (30 minutos)
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(15)).await;
            let last = last_act_for_monitor.load(Ordering::Relaxed);
            let now = current_epoch_seconds();
            if now.saturating_sub(last) > SESSION_IDLE_TIMEOUT.as_secs() {
                let _ = app_clone.emit(
                    "remote:stopped",
                    RemoteStoppedEvent {
                        reason: "idle".to_string(),
                    },
                );
                if let Some(state_ref) = app_clone.try_state::<RemoteCameraState>() {
                    let mut lock = state_ref.session.lock().await;
                    if let Some(old) = lock.take() {
                        if let Some(tx) = old.shutdown_tx {
                            let _ = tx.send(());
                        }
                    }
                }
                break;
            }
        }
    });

    let url = format!("http://{}:{}/#t={}", selected_ip, actual_port, token);

    let session_info = RemoteSessionInfo {
        url,
        ip: selected_ip.clone(),
        port: actual_port,
        token: token.clone(),
        interfaces,
    };

    *guard = Some(ActiveSession {
        ip: selected_ip,
        port: actual_port,
        token,
        shutdown_tx: Some(shutdown_tx),
        photos,
        last_activity,
    });

    Ok(session_info)
}

#[tauri::command]
pub async fn remote_stop(
    app: AppHandle,
    state: State<'_, RemoteCameraState>,
) -> Result<(), String> {
    let mut guard = state.session.lock().await;
    if let Some(active) = guard.take() {
        if let Some(tx) = active.shutdown_tx {
            let _ = tx.send(());
        }
        let _ = app.emit(
            "remote:stopped",
            RemoteStoppedEvent {
                reason: "stopped".to_string(),
            },
        );
    }
    Ok(())
}

#[tauri::command]
pub async fn remote_take(
    state: State<'_, RemoteCameraState>,
    id: String,
) -> Result<tauri::ipc::Response, String> {
    let guard = state.session.lock().await;
    let Some(active) = guard.as_ref() else {
        return Err("Nenhuma sessão de câmera remota ativa".to_string());
    };

    let map = active.photos.read().await;
    match map.get(&id) {
        Some(item) if !item.bytes.is_empty() => Ok(tauri::ipc::Response::new(item.bytes.clone())),
        _ => Err("Foto não encontrada ou já processada".to_string()),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingPhotoInfo {
    pub id: String,
    pub mime: String,
    pub size: usize,
    pub target: String,
}

#[tauri::command]
pub async fn remote_list_pending(
    state: State<'_, RemoteCameraState>,
) -> Result<Vec<PendingPhotoInfo>, String> {
    let guard = state.session.lock().await;
    let Some(active) = guard.as_ref() else {
        return Ok(Vec::new());
    };

    let map = active.photos.read().await;
    let list = map
        .values()
        .filter(|p| !p.bytes.is_empty())
        .map(|p| PendingPhotoInfo {
            id: p.id.clone(),
            mime: p.mime.clone(),
            size: p.bytes.len(),
            target: p.target.clone(),
        })
        .collect();
    Ok(list)
}

#[tauri::command]
pub async fn remote_report(
    state: State<'_, RemoteCameraState>,
    id: String,
    status: String,
    label: Option<String>,
    message: Option<String>,
) -> Result<(), String> {
    let guard = state.session.lock().await;
    let Some(active) = guard.as_ref() else {
        return Err("Nenhuma sessão de câmera remota ativa".to_string());
    };

    let parsed_status = match status.to_lowercase().as_str() {
        "ok" => PhotoProcessingStatus::Ok,
        "review" => PhotoProcessingStatus::Review,
        "error" => PhotoProcessingStatus::Error,
        "processing" => PhotoProcessingStatus::Processing,
        _ => PhotoProcessingStatus::Received,
    };

    let mut map = active.photos.write().await;
    if let Some(item) = map.get_mut(&id) {
        item.feedback = PhotoFeedback {
            status: parsed_status,
            label,
            message,
        };
        item.bytes = Vec::new();
        Ok(())
    } else {
        // Se a foto já foi removida da fila de bytes, armazenamos um stub de feedback para o celular consultar
        map.insert(
            id.clone(),
            PhotoItem {
                id,
                bytes: Vec::new(),
                mime: "image/jpeg".to_string(),
                target: "qr".to_string(),
                received_at: Instant::now(),
                feedback: PhotoFeedback {
                    status: parsed_status,
                    label,
                    message,
                },
            },
        );
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    #[test]
    fn test_validate_image_magic() {
        let jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00];
        assert_eq!(validate_image_magic(&jpeg), Ok("image/jpeg"));

        let png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00];
        assert_eq!(validate_image_magic(&png), Ok("image/png"));

        let mut webp = b"RIFF____WEBP".to_vec();
        webp.extend_from_slice(b"VP8 ");
        assert_eq!(validate_image_magic(&webp), Ok("image/webp"));

        let invalid = b"<html><body>not an image</body></html>";
        assert!(validate_image_magic(invalid).is_err());
        assert!(validate_image_magic(&[]).is_err());
    }

    #[test]
    fn test_token_constant_time_compare() {
        let t1 = "secret-token-1234";
        let t2 = "secret-token-1234";
        let t3 = "secret-token-9999";
        let t4 = "short";

        assert!(constant_time_compare(t1, t2));
        assert!(!constant_time_compare(t1, t3));
        assert!(!constant_time_compare(t1, t4));
    }

    #[test]
    fn test_network_interface_filtering() {
        assert!(is_virtual_or_loopback_interface("lo"));
        assert!(is_virtual_or_loopback_interface("docker0"));
        assert!(is_virtual_or_loopback_interface("br-1234"));
        assert!(is_virtual_or_loopback_interface("vethabc"));
        assert!(is_virtual_or_loopback_interface("virbr0"));
        assert!(!is_virtual_or_loopback_interface("wlan0"));
        assert!(!is_virtual_or_loopback_interface("eth0"));
        assert!(!is_virtual_or_loopback_interface("enp3s0"));

        let ip_priv1: std::net::Ipv4Addr = "192.168.1.50".parse().unwrap();
        let ip_priv2: std::net::Ipv4Addr = "10.0.0.12".parse().unwrap();
        let ip_priv3: std::net::Ipv4Addr = "172.20.1.1".parse().unwrap();
        let ip_pub: std::net::Ipv4Addr = "8.8.8.8".parse().unwrap();
        let ip_loop: std::net::Ipv4Addr = "127.0.0.1".parse().unwrap();

        assert!(is_private_ipv4(&ip_priv1));
        assert!(is_private_ipv4(&ip_priv2));
        assert!(is_private_ipv4(&ip_priv3));
        assert!(!is_private_ipv4(&ip_pub));
        assert!(!is_private_ipv4(&ip_loop));
    }

    #[tokio::test]
    async fn test_router_authentication_and_routes() {
        let photos = Arc::new(RwLock::new(HashMap::new()));
        let last_activity = Arc::new(AtomicU64::new(current_epoch_seconds()));
        let token = "test-token-xyz".to_string();

        let state = AppServerState {
            token: token.clone(),
            photos: photos.clone(),
            last_activity,
            app_handle: None,
        };

        let app = build_remote_router(state);

        // 1. GET / serve index.html sem autenticação
        let req = axum::http::Request::builder()
            .uri("/")
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        // 2. POST /api/photo sem token deve falhar com 401
        let req = axum::http::Request::builder()
            .method("POST")
            .uri("/api/photo")
            .body(axum::body::Body::from(vec![0xFF, 0xD8, 0xFF]))
            .unwrap();
        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);

        // 3. POST /api/photo com token errado deve falhar com 401
        let req = axum::http::Request::builder()
            .method("POST")
            .uri("/api/photo")
            .header("x-gabaritex-token", "token-errado")
            .body(axum::body::Body::from(vec![0xFF, 0xD8, 0xFF]))
            .unwrap();
        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);

        // 4. POST /api/photo com token correto e magic bytes válidos deve retornar 202
        let jpeg_bytes = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
        let req = axum::http::Request::builder()
            .method("POST")
            .uri("/api/photo")
            .header("x-gabaritex-token", &token)
            .body(axum::body::Body::from(jpeg_bytes))
            .unwrap();
        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::ACCEPTED);

        let body_bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let json_val: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        let photo_id = json_val["id"].as_str().unwrap().to_string();

        // 5. GET /api/photo/:id com token correto deve retornar o status da foto
        let req = axum::http::Request::builder()
            .uri(format!("/api/photo/{photo_id}"))
            .header("x-gabaritex-token", &token)
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let status_bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let status_json: serde_json::Value = serde_json::from_slice(&status_bytes).unwrap();
        assert_eq!(status_json["status"], "received");
    }
}

