use opencv::core::{
    AlgorithmHint, Mat, MatTraitConst, Point, Point2f, Rect, Scalar, Size, Vector,
};
use opencv::geometry;
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
    let mut candidate_centers: Vec<(f64, f64)> = Vec::new();

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
        if p_area < img_area * 0.0001 || p_area > img_area * 0.08 {
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

        let child_cnt = contours.get(first_child as usize).unwrap();
        let c_area = geometry::contour_area(&child_cnt, false).unwrap_or(0.0);
        if c_area < p_area * 0.03 || c_area > p_area * 0.60 {
            continue;
        }

        if let Ok(p_m) = geometry::moments(&parent_cnt, false) {
            if p_m.m00 > 0.0 {
                let cx = p_m.m10 / p_m.m00;
                let cy = p_m.m01 / p_m.m00;
                candidate_centers.push((cx, cy));
            }
        }
    }

    if candidate_centers.len() < 4 {
        return Err(format!(
            "Apenas {} candidatos a fiduciais encontrados (esperado: 4)",
            candidate_centers.len()
        ));
    }

    // Sort into 4 corners (top-left, top-right, bottom-right, bottom-left)
    candidate_centers.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
    let mut top_two = vec![candidate_centers[0], candidate_centers[1]];
    top_two.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());

    let mut bottom_two = vec![
        candidate_centers[candidate_centers.len() - 2],
        candidate_centers[candidate_centers.len() - 1],
    ];
    bottom_two.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());

    let tl = top_two[0];
    let tr = top_two[1];
    let bl = bottom_two[0];
    let br = bottom_two[1];

    let span_x = (tr.0 - tl.0).abs();
    let span_y = (bl.1 - tl.1).abs();
    if span_x < gray.cols() as f64 * 0.25 || span_y < gray.rows() as f64 * 0.25 {
        return Err("Área delimitada pelos fiduciais insuficiente".to_string());
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
    imgproc::warp_perspective(
        gray,
        &mut warped,
        &m,
        Size::new(WARP_WIDTH, WARP_HEIGHT),
        imgproc::INTER_LINEAR,
        opencv::core::BORDER_CONSTANT,
        Scalar::all(255.0),
        AlgorithmHint::ALGO_HINT_DEFAULT,
    )
    .map_err(|e| e.to_string())?;

    Ok(warped)
}
