use super::layout::{get_column_layout, OPTION_OFFSETS_PX};
use opencv::core::{Mat, Point, Rect, Scalar, Size, Vector};
use opencv::imgproc;
use opencv::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawDetection {
    #[serde(rename = "questionNumber")]
    pub question_number: usize,
    #[serde(rename = "fillRatios")]
    pub fill_ratios: HashMap<String, f64>,
    #[serde(rename = "detectedMark")]
    pub detected_mark: Option<String>,
    pub status: String, // "marked", "blank", "multiple"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BubbleDebugItem {
    #[serde(rename = "questionNumber")]
    pub question_number: usize,
    #[serde(rename = "optionLabel")]
    pub option_label: String,
    pub cx: f64,
    pub cy: f64,
    pub radius: f64,
    #[serde(rename = "fillRatio")]
    pub fill_ratio: f64,
    #[serde(rename = "isMarked")]
    pub is_marked: bool,
}

#[derive(Debug, Clone)]
pub struct ReadSheetResult {
    pub detections: Vec<RawDetection>,
    pub bubbles_debug: Vec<BubbleDebugItem>,
    pub row_crops_base64: HashMap<usize, String>,
}

/// Reads bubbles with morphological opening on canonical warped image.
pub fn read_bubbles_on_warped(
    warped: &Mat,
    total_questions: usize,
    subjective_set: &std::collections::HashSet<usize>,
) -> Result<ReadSheetResult, String> {
    let (columns, per_column) = get_column_layout(total_questions);

    // 1. Morphological opening to strip printed letter strokes and bubble ring
    let mut bin = Mat::default();
    imgproc::adaptive_threshold(
        warped,
        &mut bin,
        255.0,
        imgproc::ADAPTIVE_THRESH_GAUSSIAN_C,
        imgproc::THRESH_BINARY_INV,
        25,
        5.0,
    )
    .map_err(|e| e.to_string())?;

    let kernel = imgproc::get_structuring_element(
        imgproc::MORPH_ELLIPSE,
        Size::new(3, 3),
        Point::new(-1, -1),
    )
    .map_err(|e| e.to_string())?;

    let mut opened = Mat::default();
    imgproc::morphology_ex(
        &bin,
        &mut opened,
        imgproc::MORPH_OPEN,
        &kernel,
        Point::new(-1, -1),
        1,
        opencv::core::BORDER_CONSTANT,
        Scalar::all(0.0),
    )
    .map_err(|e| e.to_string())?;

    let labels = ["A", "B", "C", "D", "E"];
    let mut detections = Vec::new();
    let mut bubbles_debug = Vec::new();
    let mut row_crops_base64 = HashMap::new();

    let canonical_top_y = 120.0;
    let canonical_row_step = 28.0;

    for col in 0..columns {
        let col_start_q = col * per_column + 1;
        let col_end_q = (col_start_q + per_column - 1).min(total_questions);

        let left_mark_x = if columns == 1 {
            440.0
        } else if col == 0 {
            160.0
        } else {
            680.0
        };

        for q in col_start_q..=col_end_q {
            if subjective_set.contains(&q) {
                continue;
            }

            let row_idx = q - col_start_q;
            let center_y = canonical_top_y + (row_idx as f64) * canonical_row_step;

            let mut ratios_map: HashMap<String, f64> = HashMap::new();
            let mut detected_opt: Option<String> = None;
            let mut marked_count = 0;

            let scale: f64 = 1.0;
            let bubble_radius: f64 = 10.0;

            for (opt_idx, &label) in labels.iter().enumerate() {
                let opt_cx = left_mark_x + OPTION_OFFSETS_PX[opt_idx] * scale;
                let opt_cy = center_y;

                // Sample inner circle fill ratio
                let r_roi = (bubble_radius * 0.75f64).round() as i32;
                let roi_x = (opt_cx - r_roi as f64).round() as i32;
                let roi_y = (opt_cy - r_roi as f64).round() as i32;
                let roi_w = r_roi * 2;
                let roi_h = r_roi * 2;

                let mut fill_ratio = 0.0;
                if roi_x >= 0
                    && roi_y >= 0
                    && roi_x + roi_w <= opened.cols()
                    && roi_y + roi_h <= opened.rows()
                {
                    if let Ok(roi) = Mat::roi(&opened, Rect::new(roi_x, roi_y, roi_w, roi_h)) {
                        let total_px = (roi_w * roi_h) as f64;
                        let count_white = opencv::core::count_non_zero(&roi).unwrap_or(0);
                        fill_ratio = (count_white as f64 / total_px).min(1.0);
                    }
                }

                ratios_map.insert(label.to_string(), fill_ratio);
                let is_marked = fill_ratio >= 0.40;
                if is_marked {
                    marked_count += 1;
                    detected_opt = Some(label.to_string());
                }

                bubbles_debug.push(BubbleDebugItem {
                    question_number: q,
                    option_label: label.to_string(),
                    cx: opt_cx,
                    cy: opt_cy,
                    radius: bubble_radius,
                    fill_ratio,
                    is_marked,
                });
            }

            let status = if marked_count == 1 {
                "marked"
            } else if marked_count == 0 {
                "blank"
            } else {
                "multiple"
            };

            if status != "marked" {
                detected_opt = None;
            }

            // Create row crop for visual evidence in review modal
            let crop_x = (left_mark_x - 10.0).max(0.0) as i32;
            let crop_y = (center_y - 14.0).max(0.0) as i32;
            let crop_w = 260.min(warped.cols() - crop_x);
            let crop_h = 28.min(warped.rows() - crop_y);
            if crop_w > 10 && crop_h > 10 {
                if let Ok(roi) = Mat::roi(warped, Rect::new(crop_x, crop_y, crop_w, crop_h)) {
                    let mut buf = Vector::<u8>::new();
                    let params = Vector::<i32>::new();
                    if opencv::imgcodecs::imencode(".jpg", &roi, &mut buf, &params).is_ok() {
                        let b64 = format!(
                            "data:image/jpeg;base64,{}",
                            base64::Engine::encode(
                                &base64::engine::general_purpose::STANDARD,
                                buf.as_slice()
                            )
                        );
                        row_crops_base64.insert(q, b64);
                    }
                }
            }

            detections.push(RawDetection {
                question_number: q,
                fill_ratios: ratios_map,
                detected_mark: detected_opt,
                status: status.to_string(),
            });
        }
    }

    Ok(ReadSheetResult {
        detections,
        bubbles_debug,
        row_crops_base64,
    })
}
