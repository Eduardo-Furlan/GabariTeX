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
    #[serde(default = "default_total_questions")]
    pub total_questions: usize,
    #[serde(default)]
    pub subjective_questions: Vec<usize>,
    #[serde(default = "default_true")]
    pub read_qr: bool,
    #[serde(default = "default_true")]
    pub read_omr: bool,
    #[serde(default = "default_true")]
    pub generate_debug_image: bool,
}

fn default_total_questions() -> usize {
    20
}

fn default_true() -> bool {
    true
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
    pub timing_marks: Vec<reader::TimingMarkDebugItem>,
    pub bubbles: Vec<reader::BubbleDebugItem>,
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

    // Se o modo OMR estiver desativado, o usuário está lendo exclusivamente o QR Code
    if !req.read_omr {
        if qr_text.is_none() {
            return Ok(NativeOmrResponse {
                qr_raw_text: None,
                omr_error: Some(OmrError {
                    code: "NO_QR".to_string(),
                    message: "Nenhum QR Code detectado na imagem. Aproxime a câmera do QR Code e verifique o enquadramento.".to_string(),
                }),
                detections: Vec::new(),
                debug_info: OmrDebugInfoPayload {
                    method: "qr_only".to_string(),
                    logs: vec!["Modo QR Code ativo: nenhum código decodificado na imagem.".to_string()],
                    timing_marks: Vec::new(),
                    bubbles: Vec::new(),
                },
                debug_image_data_url: String::new(),
                row_crops: HashMap::new(),
            });
        }

        return Ok(NativeOmrResponse {
            qr_raw_text: qr_text,
            omr_error: None,
            detections: Vec::new(),
            debug_info: OmrDebugInfoPayload {
                method: "qr_only".to_string(),
                logs: vec!["QR Code detectado e decodificado com sucesso.".to_string()],
                timing_marks: Vec::new(),
                bubbles: Vec::new(),
            },
            debug_image_data_url: String::new(),
            row_crops: HashMap::new(),
        });
    }

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
                    timing_marks: Vec::new(),
                    bubbles: Vec::new(),
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

    let canonical_fid = detector::canonical_fiducials();

    // 4. Read bubbles with timing marks and morphological opening
    let subj_set: HashSet<usize> = req.subjective_questions.into_iter().collect();
    let read_res = match reader::read_bubbles_on_warped(&warped, req.total_questions, &subj_set) {
        Ok(r) => r,
        Err(err_msg) => {
            logs.push(format!("Erro ao ler linhas/bolinhas: {err_msg}"));
            let debug_url = if req.generate_debug_image {
                debug_overlay::draw_debug_overlay_base64(
                    &mut warped_bgr,
                    Some(&canonical_fid),
                    &[],
                    &[],
                    &format!("Erro na leitura: {err_msg}"),
                    true,
                )
            } else {
                String::new()
            };

            return Ok(NativeOmrResponse {
                qr_raw_text: qr_text,
                omr_error: Some(OmrError {
                    code: "NO_MARK_COLUMNS".to_string(),
                    message: err_msg,
                }),
                detections: Vec::new(),
                debug_info: OmrDebugInfoPayload {
                    method: "fiducials_timing_marks".to_string(),
                    logs,
                    timing_marks: Vec::new(),
                    bubbles: Vec::new(),
                },
                debug_image_data_url: debug_url,
                row_crops: HashMap::new(),
            });
        }
    };

    logs.push(format!(
        "Sincronizadores detectados: {} linhas | Questões objetivas lidas: {}",
        read_res.timing_marks_debug.len(),
        read_res.detections.len()
    ));

    // 5. Generate debug overlay image on rectified canvas using canonical fiducials
    let debug_url = if req.generate_debug_image {
        debug_overlay::draw_debug_overlay_base64(
            &mut warped_bgr,
            Some(&canonical_fid),
            &read_res.timing_marks_debug,
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
            method: "fiducials_timing_marks".to_string(),
            logs,
            timing_marks: read_res.timing_marks_debug,
            bubbles: read_res.bubbles_debug,
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
    fn test_decode_qr_4qr_png_and_1_jpg() {
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        for file in ["../tests/4qr.png", "../tests/1.jpg"] {
            let path = Path::new(manifest_dir).join(file);
            let bytes = fs::read(&path).expect("arquivo QR deve existir");

            // Modo 1: apenas QR (read_omr = false). Não procura fiduciais, sem erro de OMR.
            let req_qr_only = NativeOmrRequest {
                total_questions: 13,
                subjective_questions: vec![7, 9, 10],
                read_qr: true,
                read_omr: false,
                generate_debug_image: false,
            };
            let res_qr = process_image_bytes(&bytes, req_qr_only).unwrap();
            assert!(res_qr.qr_raw_text.is_some(), "QR não lido em {file}");
            assert!(res_qr.qr_raw_text.as_ref().unwrap().starts_with("MCORR:"));
            assert!(res_qr.omr_error.is_none(), "Não deve retornar erro de OMR no modo QR puro");

            // Modo 2: combinado (read_qr = true, read_omr = true). Lê QR mas rejeita fiduciais no close-up.
            let req_both = NativeOmrRequest {
                total_questions: 13,
                subjective_questions: vec![7, 9, 10],
                read_qr: true,
                read_omr: true,
                generate_debug_image: true,
            };
            let res_both = process_image_bytes(&bytes, req_both).unwrap();
            assert!(res_both.qr_raw_text.is_some());
            assert!(res_both.omr_error.is_some(), "Deveria rejeitar fiduciais no close-up de {file}");
        }
    }

    #[test]
    fn test_process_sheet_4gb_png_exact_answers() {
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        let path = Path::new(manifest_dir).join("../tests/4gb.png");
        let bytes = fs::read(&path).expect("tests/4gb.png deve existir");
        let req = NativeOmrRequest {
            total_questions: 13,
            subjective_questions: vec![7, 9, 10],
            read_qr: false,
            read_omr: true,
            generate_debug_image: true,
        };
        let res = process_image_bytes(&bytes, req).unwrap();
        assert!(res.omr_error.is_none(), "omr_error: {:?}", res.omr_error);
        assert_eq!(res.detections.len(), 10);

        let expected: Vec<(usize, &str)> = vec![
            (1, "A"),
            (2, "B"),
            (3, "C"),
            (4, "D"),
            (5, "E"),
            (6, "E"),
            (8, "A"),
            (11, "A"),
            (12, "A"),
            (13, "B"),
        ];

        for (q, exp) in expected {
            let det = res
                .detections
                .iter()
                .find(|d| d.question_number == q)
                .unwrap_or_else(|| panic!("Questão {q} não encontrada"));
            assert_eq!(
                det.detected_mark.as_deref(),
                Some(exp),
                "Questão {q} lida incorretamente: {:?} (ratios: {:?})",
                det.detected_mark,
                det.fill_ratios
            );
        }
    }

    #[test]
    fn test_process_sheets_2_jpg_and_3_jpg_exact_answers() {
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        for filename in ["../tests/2.jpg", "../tests/3.jpg"] {
            let path = Path::new(manifest_dir).join(filename);
            let bytes = fs::read(&path).expect("arquivo de teste deve existir");
            let req = NativeOmrRequest {
                total_questions: 10,
                subjective_questions: vec![3, 6],
                read_qr: false,
                read_omr: true,
                generate_debug_image: true,
            };
            let res = process_image_bytes(&bytes, req).unwrap();
            assert!(
                res.omr_error.is_none(),
                "{filename} omr_error: {:?}",
                res.omr_error
            );
            assert_eq!(res.detections.len(), 8);

            let expected: Vec<(usize, &str)> = vec![
                (1, "A"),
                (2, "B"),
                (4, "C"),
                (5, "D"),
                (7, "E"),
                (8, "A"),
                (9, "B"),
                (10, "C"),
            ];

            for (q, exp) in expected {
                let det = res
                    .detections
                    .iter()
                    .find(|d| d.question_number == q)
                    .unwrap_or_else(|| panic!("{filename}: Questão {q} não encontrada"));
                assert_eq!(
                    det.detected_mark.as_deref(),
                    Some(exp),
                    "{filename}: Questão {q} lida incorretamente: {:?} (ratios: {:?})",
                    det.detected_mark,
                    det.fill_ratios
                );
            }
        }
    }
}
