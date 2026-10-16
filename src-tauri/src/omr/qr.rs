use opencv::core::{Mat, Rect, Size};
use opencv::imgproc;
use opencv::prelude::*;
use rqrr::PreparedImage;

/// Attempts to decode a QR code from a grayscale OpenCV Mat image.
/// Runs multiple crops and binarizations (original, top-right quadrant, top-half, center).
pub fn decode_qr_from_mat(gray: &Mat) -> Option<String> {
    // 1. Try full image
    if let Some(text) = try_rqrr_decode(gray) {
        if text.starts_with("MCORR:") {
            return Some(text);
        }
    }

    let rows = gray.rows();
    let cols = gray.cols();

    // 2. Crop top-right quadrant (where GabariTeX answer sheet places the QR code)
    let tr_x = (cols as f64 * 0.40) as i32;
    let tr_w = cols - tr_x;
    let tr_h = (rows as f64 * 0.40) as i32;
    if tr_w > 50 && tr_h > 50 {
        if let Ok(roi) = Mat::roi(gray, Rect::new(tr_x, 0, tr_w, tr_h)) {
            let roi_mat = roi.try_clone().unwrap_or_default();
            if let Some(text) = try_rqrr_decode(&roi_mat) {
                if text.starts_with("MCORR:") {
                    return Some(text);
                }
            }
        }
    }

    // 3. Crop top half
    let top_h = (rows as f64 * 0.45) as i32;
    if top_h > 50 {
        if let Ok(roi) = Mat::roi(gray, Rect::new(0, 0, cols, top_h)) {
            let roi_mat = roi.try_clone().unwrap_or_default();
            if let Some(text) = try_rqrr_decode(&roi_mat) {
                if text.starts_with("MCORR:") {
                    return Some(text);
                }
            }
        }
    }

    // 4. Crop center (for close-up shots like tests/4qr.png)
    let c_x = (cols as f64 * 0.05) as i32;
    let c_y = (rows as f64 * 0.10) as i32;
    let c_w = (cols as f64 * 0.90) as i32;
    let c_h = (rows as f64 * 0.80) as i32;
    if c_w > 50 && c_h > 50 {
        if let Ok(roi) = Mat::roi(gray, Rect::new(c_x, c_y, c_w, c_h)) {
            let roi_mat = roi.try_clone().unwrap_or_default();
            if let Some(text) = try_rqrr_decode(&roi_mat) {
                if text.starts_with("MCORR:") {
                    return Some(text);
                }
            }
        }
    }

    None
}

fn try_rqrr_decode(mat: &Mat) -> Option<String> {
    let mut resized = Mat::default();
    let max_dim = mat.cols().max(mat.rows());
    let (target_mat, w, h) = if max_dim > 1400 {
        let scale = 1400.0 / max_dim as f64;
        let new_w = (mat.cols() as f64 * scale).round() as i32;
        let new_h = (mat.rows() as f64 * scale).round() as i32;
        if imgproc::resize(
            mat,
            &mut resized,
            Size::new(new_w, new_h),
            0.0,
            0.0,
            imgproc::INTER_AREA,
        )
        .is_ok()
        {
            (&resized, new_w, new_h)
        } else {
            (mat, mat.cols(), mat.rows())
        }
    } else {
        (mat, mat.cols(), mat.rows())
    };

    if w <= 0 || h <= 0 {
        return None;
    }

    // Extract continuous luma buffer
    let mut continuous = Mat::default();
    let src = if target_mat.is_continuous() {
        target_mat
    } else {
        if target_mat.copy_to(&mut continuous).is_err() {
            return None;
        }
        &continuous
    };

    let Ok(data) = src.data_bytes() else {
        return None;
    };

    let mut prep = PreparedImage::prepare_from_greyscale(w as usize, h as usize, |x, y| {
        data[y * w as usize + x]
    });

    let grids = prep.detect_grids();
    for grid in grids {
        let mut buf = Vec::new();
        if grid.decode_to(&mut buf).is_ok() {
            if let Ok(s) = String::from_utf8(buf) {
                return Some(s);
            }
        }
    }

    None
}
