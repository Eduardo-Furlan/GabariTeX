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
    let orig_w = gray.cols();
    let orig_h = gray.rows();
    if orig_w < 100 || orig_h < 100 {
        return Err("Dimensões da imagem insuficientes".to_string());
    }

    // Normaliza escala se a imagem for muito alta resolução (ex: câmera de celular 3000px+),
    // pois blockSize=31 em 4000px fica menor que a espessura da barra do fiducial.
    let max_dim = orig_w.max(orig_h) as f64;
    let target_max = 1600.0;
    let scale = if max_dim > target_max {
        target_max / max_dim
    } else {
        1.0
    };

    let work_gray = if scale < 1.0 {
        let mut resized = Mat::default();
        let new_w = ((orig_w as f64 * scale).round() as i32).max(100);
        let new_h = ((orig_h as f64 * scale).round() as i32).max(100);
        imgproc::resize(
            gray,
            &mut resized,
            Size::new(new_w, new_h),
            0.0,
            0.0,
            imgproc::INTER_AREA,
        )
        .map_err(|e| e.to_string())?;
        resized
    } else {
        gray.clone()
    };

    let mut bin = Mat::default();
    imgproc::adaptive_threshold(
        &work_gray,
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

    let img_area = (work_gray.cols() * work_gray.rows()) as f64;
    // (cx, cy, area, has_grandchild)
    let mut raw_candidates: Vec<(f64, f64, f64, bool)> = Vec::new();

    for i in 0..count {
        // Hierarchy element: [Next, Previous, First_Child, Parent]
        let Ok(node) = hierarchy.at_2d::<opencv::core::Vec4i>(0, i as i32) else {
            continue;
        };
        let first_child = node[2];
        if first_child < 0 {
            continue; // Must have an inner child (the white center ring)
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
        if !(0.65..=1.55).contains(&aspect) {
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

        // Check direct children for a concentric white hole (and nested black center dot)
        let mut has_concentric_hole = false;
        let mut has_nested_center = false;
        let mut child_idx = first_child;
        let mut safety = 0;
        while child_idx >= 0 && (child_idx as usize) < count && safety < 32 {
            safety += 1;
            let child_cnt = contours.get(child_idx as usize).unwrap();
            let c_area = geometry::contour_area(&child_cnt, false).unwrap_or(0.0);
            if c_area >= p_area * 0.03 && c_area <= p_area * 0.65 {
                if let Ok(c_m) = geometry::moments(&child_cnt, false) {
                    if c_m.m00 > 0.0 {
                        let ccx = c_m.m10 / c_m.m00;
                        let ccy = c_m.m01 / c_m.m00;
                        let dist = ((cx - ccx).powi(2) + (cy - ccy).powi(2)).sqrt();
                        if dist <= max_side * 0.25 {
                            has_concentric_hole = true;
                            if let Ok(c_node) = hierarchy.at_2d::<opencv::core::Vec4i>(0, child_idx) {
                                let grand_idx = c_node[2];
                                if grand_idx >= 0 && (grand_idx as usize) < count {
                                    has_nested_center = true;
                                    break;
                                }
                            }
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
            raw_candidates.push((cx / scale, cy / scale, p_area / (scale * scale), has_nested_center));
        }
    }

    // Prioriza candidatos que possuem os 3 níveis concêntricos (quadrado preto -> anel branco -> miolo preto)
    // caso existam pelo menos 4 deles; caso contrário usa todos os candidatos com buraco concêntrico.
    let nested_count = raw_candidates.iter().filter(|c| c.3).count();
    let mut filtered_candidates: Vec<(f64, f64, f64)> = if nested_count >= 4 {
        raw_candidates
            .into_iter()
            .filter(|c| c.3)
            .map(|(x, y, a, _)| (x, y, a))
            .collect()
    } else {
        raw_candidates
            .into_iter()
            .map(|(x, y, a, _)| (x, y, a))
            .collect()
    };

    // Deduplicate candidates that are very close to each other
    filtered_candidates.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap());
    let mut unique_candidates: Vec<(f64, f64, f64)> = Vec::new();
    let min_dedup_dist = 16.0 / scale;
    for (cx, cy, area) in filtered_candidates {
        let duplicate = unique_candidates
            .iter()
            .any(|&(ex, ey, _)| ((cx - ex).powi(2) + (cy - ey).powi(2)).sqrt() < min_dedup_dist);
        if !duplicate {
            unique_candidates.push((cx, cy, area));
        }
    }

    if unique_candidates.len() < 4 {
        return Err(format!(
            "Apenas {} candidatos a fiduciais encontrados (esperado: 4)",
            unique_candidates.len()
        ));
    }

    // Limita aos 16 maiores candidatos por área para busca combinatória rápida
    unique_candidates.truncate(16);

    let w = orig_w as f64;
    let h = orig_h as f64;

    // Procura o quarteto de candidatos que forma o maior quadrilátero retangular válido nos 4 cantos
    let n = unique_candidates.len();
    let mut best_quad: Option<(DetectedFiducials, f64)> = None;

    for i in 0..n {
        for j in (i + 1)..n {
            for k in (j + 1)..n {
                for l in (k + 1)..n {
                    let pts = [
                        unique_candidates[i],
                        unique_candidates[j],
                        unique_candidates[k],
                        unique_candidates[l],
                    ];

                    let tl = *pts
                        .iter()
                        .min_by(|a, b| (a.0 + a.1).partial_cmp(&(b.0 + b.1)).unwrap())
                        .unwrap();
                    let br = *pts
                        .iter()
                        .max_by(|a, b| (a.0 + a.1).partial_cmp(&(b.0 + b.1)).unwrap())
                        .unwrap();
                    let tr = *pts
                        .iter()
                        .max_by(|a, b| (a.0 - a.1).partial_cmp(&(b.0 - b.1)).unwrap())
                        .unwrap();
                    let bl = *pts
                        .iter()
                        .min_by(|a, b| (a.0 - a.1).partial_cmp(&(b.0 - b.1)).unwrap())
                        .unwrap();

                    // Garante que os 4 cantos são pontos distintos
                    if (tl.0 == tr.0 && tl.1 == tr.1)
                        || (tl.0 == bl.0 && tl.1 == bl.1)
                        || (br.0 == tr.0 && br.1 == tr.1)
                        || (br.0 == bl.0 && br.1 == bl.1)
                    {
                        continue;
                    }

                    let top_w = ((tr.0 - tl.0).powi(2) + (tr.1 - tl.1).powi(2)).sqrt();
                    let bot_w = ((br.0 - bl.0).powi(2) + (br.1 - bl.1).powi(2)).sqrt();
                    let left_h = ((bl.0 - tl.0).powi(2) + (bl.1 - tl.1).powi(2)).sqrt();
                    let right_h = ((br.0 - tr.0).powi(2) + (br.1 - tr.1).powi(2)).sqrt();

                    if top_w < w * 0.25 || bot_w < w * 0.25 || left_h < h * 0.25 || right_h < h * 0.25 {
                        continue;
                    }

                    let w_ratio = top_w / bot_w.max(1.0);
                    let h_ratio = left_h / right_h.max(1.0);
                    if !(0.55..=1.80).contains(&w_ratio) || !(0.55..=1.80).contains(&h_ratio) {
                        continue;
                    }

                    // Verifica similaridade de tamanho (área) entre os 4 marcadores de canto
                    let min_a = pts.iter().map(|p| p.2).fold(f64::INFINITY, f64::min);
                    let max_a = pts.iter().map(|p| p.2).fold(0.0_f64, f64::max);
                    if max_a > min_a * 6.0 {
                        continue;
                    }

                    // Calcula área aproximada do quadrilátero para escolher o maior quadro válido
                    let quad_area = 0.5
                        * ((tl.0 * tr.1 - tr.0 * tl.1)
                            + (tr.0 * br.1 - br.0 * tr.1)
                            + (br.0 * bl.1 - bl.0 * br.1)
                            + (bl.0 * tl.1 - tl.0 * bl.1))
                            .abs();

                    if best_quad.as_ref().map_or(true, |(_, best_a)| quad_area > *best_a) {
                        best_quad = Some((
                            DetectedFiducials {
                                top_left: FiducialPoint { x: tl.0, y: tl.1 },
                                top_right: FiducialPoint { x: tr.0, y: tr.1 },
                                bottom_right: FiducialPoint { x: br.0, y: br.1 },
                                bottom_left: FiducialPoint { x: bl.0, y: bl.1 },
                            },
                            quad_area,
                        ));
                    }
                }
            }
        }
    }

    if let Some((fid, _)) = best_quad {
        return Ok(fid);
    }

    Err("Área delimitada pelos fiduciais insuficiente".to_string())
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
