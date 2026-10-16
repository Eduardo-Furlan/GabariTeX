pub mod debug_overlay;
pub mod detector;
pub mod layout;
pub mod qr;
pub mod reader;

use opencv::core::{AlgorithmHint, Vector};
use opencv::imgcodecs;
use opencv::imgproc;
use opencv::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeOmrRequest {
    pub total_questions: usize,
    pub subjective_questions: Vec<usize>,
    pub read_qr: bool,
    pub generate_debug_image: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OmrError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OmrDebugInfoPayload {
    pub method: String,
    pub logs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeOmrResponse {
    pub qr_raw_text: Option<String>,
    pub omr_error: Option<OmrError>,
    pub detections: Vec<reader::RawDetection>,
    pub debug_info: OmrDebugInfoPayload,
    pub debug_image_data_url: String,
    pub row_crops: HashMap<usize, String>,
}

pub fn process_image_bytes(
    image_bytes: &[u8],
    req: NativeOmrRequest,
) -> Result<NativeOmrResponse, String> {
    let buf = Vector::from_slice(image_bytes);
    let mut bgr =
        imgcodecs::imdecode(&buf, imgcodecs::IMREAD_COLOR).map_err(|e| e.to_string())?;
    if bgr.empty() {
        return Err("Não foi possível decodificar os bytes da imagem".to_string());
    }

    let mut gray = Mat::default();
    imgproc::cvt_color(
        &bgr,
        &mut gray,
        imgproc::COLOR_BGR2GRAY,
        0,
        AlgorithmHint::ALGO_HINT_DEFAULT,
    )
    .map_err(|e| e.to_string())?;

    // 1. QR Code decoding
    let qr_text = if req.read_qr {
        qr::decode_qr_from_mat(&gray)
    } else {
        None
    };

    // 2. Fiducial detection
    let mut logs = vec![format!(
        "Dimensões originais: {}x{}px",
        bgr.cols(),
        bgr.rows()
    )];

    let fid_result = detector::find_fiducials(&gray);
    let fid = match fid_result {
        Ok(f) => {
            logs.push("Fiduciais de canto detectados com sucesso via RETR_TREE".to_string());
            f
        }
        Err(err_msg) => {
            let debug_url = if req.generate_debug_image {
                debug_overlay::draw_debug_overlay_base64(
                    &mut bgr,
                    None,
                    &[],
                    &format!("Erro na detecção: {err_msg}"),
                    true,
                )
            } else {
                String::new()
            };

            return Ok(NativeOmrResponse {
                qr_raw_text: qr_text,
                omr_error: Some(OmrError {
                    code: "NO_FIDUCIALS".to_string(),
                    message: err_msg,
                }),
                detections: Vec::new(),
                debug_info: OmrDebugInfoPayload {
                    method: "none".to_string(),
                    logs,
                },
                debug_image_data_url: debug_url,
                row_crops: HashMap::new(),
            });
        }
    };

    // 3. Perspective warp to canonical dimensions
    let warped = match detector::warp_perspective_to_canonical(&gray, &fid) {
        Ok(w) => w,
        Err(e) => {
            return Err(format!("Falha na retificação de perspectiva: {e}"));
        }
    };

    let mut warped_bgr = Mat::default();
    let _ = imgproc::cvt_color(
        &warped,
        &mut warped_bgr,
        imgproc::COLOR_GRAY2BGR,
        0,
        AlgorithmHint::ALGO_HINT_DEFAULT,
    );

    // 4. Read bubbles with morphological opening
    let subj_set: HashSet<usize> = req.subjective_questions.into_iter().collect();
    let read_res = reader::read_bubbles_on_warped(&warped, req.total_questions, &subj_set)?;

    logs.push(format!(
        "OMR processado: {} questões lidas com morfologia OpenCV",
        read_res.detections.len()
    ));

    // 5. Generate debug overlay image
    let debug_url = if req.generate_debug_image {
        debug_overlay::draw_debug_overlay_base64(
            &mut warped_bgr,
            Some(&fid),
            &read_res.bubbles_debug,
            "OMR OpenCV Nativo - Folha retificada e lida com sucesso",
            false,
        )
    } else {
        String::new()
    };

    Ok(NativeOmrResponse {
        qr_raw_text: qr_text,
        omr_error: None,
        detections: read_res.detections,
        debug_info: OmrDebugInfoPayload {
            method: "opencv_native_homography".to_string(),
            logs,
        },
        debug_image_data_url: debug_url,
        row_crops: read_res.row_crops_base64,
    })
}

#[tauri::command]
pub async fn process_exam_photo(
    request: tauri::ipc::Request<'_>,
) -> Result<NativeOmrResponse, String> {
    let req_json = request
        .headers()
        .get("x-omr-options")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| "Cabeçalho x-omr-options ausente".to_string())?;

    let req: NativeOmrRequest =
        serde_json::from_str(req_json).map_err(|e| format!("JSON de opções inválido: {e}"))?;

    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(raw) => raw.clone(),
        tauri::ipc::InvokeBody::Json(val) => serde_json::to_vec(val).map_err(|e| e.to_string())?,
    };

    tauri::async_runtime::spawn_blocking(move || process_image_bytes(&bytes, req))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    #[test]
    fn test_decode_qr_4qr_png() {
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        let path = Path::new(manifest_dir).join("../tests/4qr.png");
        if let Ok(bytes) = fs::read(&path) {
            let req = NativeOmrRequest {
                total_questions: 13,
                subjective_questions: vec![7, 9, 10],
                read_qr: true,
                generate_debug_image: false,
            };
            let res = process_image_bytes(&bytes, req).unwrap();
            assert!(res.qr_raw_text.is_some());
            assert!(res.qr_raw_text.as_ref().unwrap().starts_with("MCORR:"));
        }
    }

    #[test]
    fn test_process_sheet_4gb_png() {
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        let path = Path::new(manifest_dir).join("../tests/4gb.png");
        if let Ok(bytes) = fs::read(&path) {
            let req = NativeOmrRequest {
                total_questions: 13,
                subjective_questions: vec![7, 9, 10],
                read_qr: true,
                generate_debug_image: true,
            };
            let res = process_image_bytes(&bytes, req).unwrap();
            assert!(res.omr_error.is_none());
            assert_eq!(res.detections.len(), 10); // 13 - 3 subjective = 10 objective
            assert!(!res.debug_image_data_url.is_empty());
        }
    }
}

