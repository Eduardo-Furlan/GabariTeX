use super::cv_compat::{self, geometry};
use opencv::core::{Mat, MatTraitConst, Point, Point2f, Rect, Scalar, Size, Vector};
use opencv::imgproc;

#[derive(Debug, Clone, Copy)]
pub struct FiducialPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone)]
pub struct DetectedFiducials {
    pub top_left: FiducialPoint,
    pub top_right: FiducialPoint,
    pub bottom_right: FiducialPoint,
    pub bottom_left: FiducialPoint,
}

pub const WARP_WIDTH: i32 = 1200;
pub const WARP_HEIGHT: i32 = 1400;
pub const CANONICAL_MARGIN_X: f64 = 60.0;
pub const CANONICAL_MARGIN_Y: f64 = 60.0;

pub fn canonical_fiducials() -> DetectedFiducials {
    DetectedFiducials {
        top_left: FiducialPoint {
            x: CANONICAL_MARGIN_X,
            y: CANONICAL_MARGIN_Y,
        },
        top_right: FiducialPoint {
            x: WARP_WIDTH as f64 - CANONICAL_MARGIN_X,
            y: CANONICAL_MARGIN_Y,
        },
        bottom_right: FiducialPoint {
            x: WARP_WIDTH as f64 - CANONICAL_MARGIN_X,
            y: WARP_HEIGHT as f64 - CANONICAL_MARGIN_Y,
        },
        bottom_left: FiducialPoint {
            x: CANONICAL_MARGIN_X,
            y: WARP_HEIGHT as f64 - CANONICAL_MARGIN_Y,
        },
    }
}

/// Topological search for the 4 concentric square fiducials using RETR_TREE hierarchy.
pub fn find_fiducials(gray: &Mat) -> Result<DetectedFiducials, String> {
    let mut bin = Mat::default();
    imgproc::adaptive_threshold(
        gray,
        &mut bin,
        255.0,
        imgproc::ADAPTIVE_THRESH_GAUSSIAN_C,
        imgproc::THRESH_BINARY_INV,
        31,
        7.0,
    )
    .map_err(|e| e.to_string())?;

    let mut contours: Vector<Vector<Point>> = Vector::new();
    let mut hierarchy: Mat = Mat::default();

    imgproc::find_contours_with_hierarchy(
        &bin,
        &mut contours,
        &mut hierarchy,
        imgproc::RETR_TREE,
        imgproc::CHAIN_APPROX_SIMPLE,
        Point::new(0, 0),
    )
    .map_err(|e| e.to_string())?;

    let count = contours.len();
    if count < 4 {
        return Err("Menos de 4 contornos na imagem".to_string());
    }

    let img_area = (gray.cols() * gray.rows()) as f64;
    let mut raw_candidates: Vec<(f64, f64, f64)> = Vec::new(); // (cx, cy, area)

    for i in 0..count {
        // Hierarchy element: [Next, Previous, First_Child, Parent]
        let Ok(node) = hierarchy.at_2d::<opencv::core::Vec4i>(0, i as i32) else {
            continue;
        };
        let first_child = node[2];
        if first_child < 0 {
            continue; // Must have an inner child (the white center square)
        }

        let parent_cnt = contours.get(i).unwrap();
        let p_area = geometry::contour_area(&parent_cnt, false).unwrap_or(0.0);
        if p_area < img_area * 0.00008 || p_area > img_area * 0.05 {
            continue;
        }

        let peri = geometry::arc_length(&parent_cnt, true).unwrap_or(0.0);
        let mut approx = Vector::<Point>::new();
        geometry::approx_poly_dp(&parent_cnt, &mut approx, 0.04 * peri, true).unwrap_or(());
        if approx.len() != 4 || !geometry::is_contour_convex(&approx).unwrap_or(false) {
            continue;
        }

        let rect = geometry::bounding_rect(&approx).unwrap_or(Rect::default());
        let aspect = rect.width as f64 / rect.height.max(1) as f64;
        if aspect < 0.65 || aspect > 1.55 {
            continue;
        }

        let Ok(p_m) = geometry::moments(&parent_cnt, false) else {
            continue;
        };
        if p_m.m00 <= 0.0 {
            continue;
        }
        let cx = p_m.m10 / p_m.m00;
        let cy = p_m.m01 / p_m.m00;
        let max_side = rect.width.max(rect.height) as f64;

        // Check direct children for a concentric white hole
        let mut has_concentric_hole = false;
        let mut child_idx = first_child;
        let mut safety = 0;
        while child_idx >= 0 && (child_idx as usize) < count && safety < 32 {
            safety += 1;
            let child_cnt = contours.get(child_idx as usize).unwrap();
            let c_area = geometry::contour_area(&child_cnt, false).unwrap_or(0.0);
            if c_area >= p_area * 0.03 && c_area <= p_area * 0.50 {
                if let Ok(c_m) = geometry::moments(&child_cnt, false) {
                    if c_m.m00 > 0.0 {
                        let ccx = c_m.m10 / c_m.m00;
                        let ccy = c_m.m01 / c_m.m00;
                        let dist = ((cx - ccx).powi(2) + (cy - ccy).powi(2)).sqrt();
                        if dist <= max_side * 0.25 {
                            has_concentric_hole = true;
                            break;
                        }
                    }
                }
            }
            if let Ok(c_node) = hierarchy.at_2d::<opencv::core::Vec4i>(0, child_idx) {
                child_idx = c_node[0];
            } else {
                break;
            }
        }

        if has_concentric_hole {
            raw_candidates.push((cx, cy, p_area));
        }
    }

    // Deduplicate candidates that are very close to each other
    raw_candidates.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap());
    let mut candidate_centers: Vec<(f64, f64)> = Vec::new();
    for (cx, cy, _) in raw_candidates {
        let duplicate = candidate_centers
            .iter()
            .any(|&(ex, ey)| ((cx - ex).powi(2) + (cy - ey).powi(2)).sqrt() < 16.0);
        if !duplicate {
            candidate_centers.push((cx, cy));
        }
    }

    if candidate_centers.len() < 4 {
        return Err(format!(
            "Apenas {} candidatos a fiduciais encontrados (esperado: 4)",
            candidate_centers.len()
        ));
    }

    // Pick corners using extremum of (x + y) and (x - y)
    let tl = *candidate_centers
        .iter()
        .min_by(|a, b| (a.0 + a.1).partial_cmp(&(b.0 + b.1)).unwrap())
        .unwrap();
    let br = *candidate_centers
        .iter()
        .max_by(|a, b| (a.0 + a.1).partial_cmp(&(b.0 + b.1)).unwrap())
        .unwrap();
    let tr = *candidate_centers
        .iter()
        .max_by(|a, b| (a.0 - a.1).partial_cmp(&(b.0 - b.1)).unwrap())
        .unwrap();
    let bl = *candidate_centers
        .iter()
        .min_by(|a, b| (a.0 - a.1).partial_cmp(&(b.0 - b.1)).unwrap())
        .unwrap();

    let top_w = ((tr.0 - tl.0).powi(2) + (tr.1 - tl.1).powi(2)).sqrt();
    let bot_w = ((br.0 - bl.0).powi(2) + (br.1 - bl.1).powi(2)).sqrt();
    let left_h = ((bl.0 - tl.0).powi(2) + (bl.1 - tl.1).powi(2)).sqrt();
    let right_h = ((br.0 - tr.0).powi(2) + (br.1 - tr.1).powi(2)).sqrt();

    let w = gray.cols() as f64;
    let h = gray.rows() as f64;
    if top_w < w * 0.25 || bot_w < w * 0.25 || left_h < h * 0.25 || right_h < h * 0.25 {
        return Err("Área delimitada pelos fiduciais insuficiente".to_string());
    }

    let w_ratio = top_w / bot_w.max(1.0);
    let h_ratio = left_h / right_h.max(1.0);
    if !(0.55..=1.80).contains(&w_ratio) || !(0.55..=1.80).contains(&h_ratio) {
        return Err("Geometria dos fiduciais inválida (quadrilátero distorcido)".to_string());
    }

    Ok(DetectedFiducials {
        top_left: FiducialPoint { x: tl.0, y: tl.1 },
        top_right: FiducialPoint { x: tr.0, y: tr.1 },
        bottom_right: FiducialPoint { x: br.0, y: br.1 },
        bottom_left: FiducialPoint { x: bl.0, y: bl.1 },
    })
}

/// Warps the perspective so that the 4 fiducials map exactly to canonical coordinates.
pub fn warp_perspective_to_canonical(
    gray: &Mat,
    fid: &DetectedFiducials,
) -> Result<Mat, String> {
    let mut src = Vector::<Point2f>::new();
    src.push(Point2f::new(fid.top_left.x as f32, fid.top_left.y as f32));
    src.push(Point2f::new(fid.top_right.x as f32, fid.top_right.y as f32));
    src.push(Point2f::new(
        fid.bottom_right.x as f32,
        fid.bottom_right.y as f32,
    ));
    src.push(Point2f::new(
        fid.bottom_left.x as f32,
        fid.bottom_left.y as f32,
    ));

    let mut dst = Vector::<Point2f>::new();
    dst.push(Point2f::new(
        CANONICAL_MARGIN_X as f32,
        CANONICAL_MARGIN_Y as f32,
    ));
    dst.push(Point2f::new(
        (WARP_WIDTH as f64 - CANONICAL_MARGIN_X) as f32,
        CANONICAL_MARGIN_Y as f32,
    ));
    dst.push(Point2f::new(
        (WARP_WIDTH as f64 - CANONICAL_MARGIN_X) as f32,
        (WARP_HEIGHT as f64 - CANONICAL_MARGIN_Y) as f32,
    ));
    dst.push(Point2f::new(
        CANONICAL_MARGIN_X as f32,
        (WARP_HEIGHT as f64 - CANONICAL_MARGIN_Y) as f32,
    ));

    let m = geometry::get_perspective_transform_def(&src, &dst).map_err(|e| e.to_string())?;

    let mut warped = Mat::default();
    cv_compat::warp_perspective(
        gray,
        &mut warped,
        &m,
        Size::new(WARP_WIDTH, WARP_HEIGHT),
        imgproc::INTER_LINEAR,
        opencv::core::BORDER_CONSTANT,
        Scalar::all(255.0),
    )
    .map_err(|e| e.to_string())?;

    Ok(warped)
}
