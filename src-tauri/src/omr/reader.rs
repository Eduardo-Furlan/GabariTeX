use super::layout::{get_column_layout, OPTION_OFFSETS_PX};
use opencv::core::{Mat, Point, Rect, Scalar, Size, Vector};
use opencv::geometry;
use opencv::imgproc;
use opencv::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimingMarkDebugItem {
    #[serde(rename = "rowNumber")]
    pub row_number: usize,
    #[serde(rename = "leftX")]
    pub left_x: f64,
    #[serde(rename = "leftY")]
    pub left_y: f64,
    #[serde(rename = "rightX")]
    pub right_x: f64,
    #[serde(rename = "rightY")]
    pub right_y: f64,
}

#[derive(Debug, Clone)]
pub struct ReadSheetResult {
    pub detections: Vec<RawDetection>,
    pub bubbles_debug: Vec<BubbleDebugItem>,
    pub timing_marks_debug: Vec<TimingMarkDebugItem>,
    pub row_crops_base64: HashMap<usize, String>,
}

#[derive(Debug, Clone, Copy)]
struct Pt {
    x: f64,
    y: f64,
}

#[derive(Debug, Clone, Copy)]
struct CircleCandidate {
    cx: f64,
    cy: f64,
    radius: f64,
}

fn median_f64(vals: &mut [f64]) -> f64 {
    if vals.is_empty() {
        return 0.0;
    }
    vals.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let mid = vals.len() / 2;
    if vals.len() % 2 == 1 {
        vals[mid]
    } else {
        0.5 * (vals[mid - 1] + vals[mid])
    }
}

/// Detects solid square timing marks and bubble circle candidates on the rectified image.
fn extract_marks_and_circles(
    warped: &Mat,
) -> Result<(Mat, Vec<Pt>, Vec<CircleCandidate>), String> {
    let mut bin = Mat::default();
    imgproc::adaptive_threshold(
        warped,
        &mut bin,
        255.0,
        imgproc::ADAPTIVE_THRESH_GAUSSIAN_C,
        imgproc::THRESH_BINARY_INV,
        31,
        7.0,
    )
    .map_err(|e| e.to_string())?;

    let mut contours: Vector<Vector<Point>> = Vector::new();
    imgproc::find_contours(
        &bin,
        &mut contours,
        imgproc::RETR_LIST,
        imgproc::CHAIN_APPROX_SIMPLE,
        Point::new(0, 0),
    )
    .map_err(|e| e.to_string())?;

    let fiducial_corners = [
        (60.0f64, 60.0f64),
        (1140.0f64, 60.0f64),
        (1140.0f64, 1340.0f64),
        (60.0f64, 1340.0f64),
    ];

    let mut marks: Vec<Pt> = Vec::new();
    let mut circles: Vec<CircleCandidate> = Vec::new();

    for i in 0..contours.len() {
        let cnt = contours.get(i).unwrap();
        let rect = geometry::bounding_rect(&cnt).unwrap_or(Rect::default());
        if rect.width < 6 || rect.height < 6 {
            continue;
        }

        let cx = rect.x as f64 + rect.width as f64 * 0.5;
        let cy = rect.y as f64 + rect.height as f64 * 0.5;

        // Ignore border region outside the OMR box or on top of the 4 corner fiducials
        if !(62.0..=1138.0).contains(&cx) || !(95.0..=1315.0).contains(&cy) {
            continue;
        }
        if fiducial_corners
            .iter()
            .any(|&(fx, fy)| ((cx - fx).powi(2) + (cy - fy).powi(2)).sqrt() < 40.0)
        {
            continue;
        }

        let aspect = rect.width as f64 / rect.height as f64;

        // 1. Check if it is a timing mark candidate (small solid black square ~10-24px)
        if (7..=26).contains(&rect.width)
            && (7..=26).contains(&rect.height)
            && (0.60..=1.65).contains(&aspect)
        {
            if let Ok(roi) = Mat::roi(&bin, rect) {
                let fill = opencv::core::count_non_zero(&roi).unwrap_or(0) as f64
                    / (rect.width * rect.height) as f64;

                let inner_rect = Rect::new(
                    rect.x + rect.width / 4,
                    rect.y + rect.height / 4,
                    (rect.width / 2).max(1),
                    (rect.height / 2).max(1),
                );
                let inner_fill = if let Ok(iroi) = Mat::roi(&bin, inner_rect) {
                    opencv::core::count_non_zero(&iroi).unwrap_or(0) as f64
                        / (inner_rect.width * inner_rect.height) as f64
                } else {
                    0.0
                };

                if fill >= 0.55 && inner_fill >= 0.70 {
                    if !marks
                        .iter()
                        .any(|m| ((m.x - cx).powi(2) + (m.y - cy).powi(2)).sqrt() < 8.0)
                    {
                        marks.push(Pt { x: cx, y: cy });
                    }
                    continue;
                }
            }
        }

        // 2. Check if it is a printed bubble circle candidate (~22-50px diameter)
        if (22..=50).contains(&rect.width)
            && (22..=50).contains(&rect.height)
            && (0.78..=1.28).contains(&aspect)
        {
            let peri = geometry::arc_length(&cnt, true).unwrap_or(0.0);
            let area = geometry::contour_area(&cnt, false).unwrap_or(0.0);
            if peri > 0.0 && area > 200.0 {
                let circularity = 4.0 * std::f64::consts::PI * area / (peri * peri);
                if circularity >= 0.55 {
                    let radius = 0.25 * (rect.width as f64 + rect.height as f64);
                    circles.push(CircleCandidate { cx, cy, radius });
                }
            }
        }
    }

    // Deduplicate circle candidates that are concentric (inner and outer ring of the same bubble)
    let mut dedup_circles: Vec<CircleCandidate> = Vec::new();
    circles.sort_by(|a, b| b.radius.partial_cmp(&a.radius).unwrap());
    for c in circles {
        if !dedup_circles
            .iter()
            .any(|e| ((e.cx - c.cx).powi(2) + (e.cy - c.cy).powi(2)).sqrt() < 12.0)
        {
            dedup_circles.push(c);
        }
    }

    Ok((bin, marks, dedup_circles))
}

/// Finds the left and right timing mark pairs (L_r, R_r) for a single column within [x_min, x_max].
fn detect_column_rows(
    marks: &[Pt],
    x_min: f64,
    x_max: f64,
    expected_rows_hint: Option<usize>,
) -> Result<Vec<(Pt, Pt)>, String> {
    let col_marks: Vec<Pt> = marks
        .iter()
        .copied()
        .filter(|m| m.x >= x_min && m.x <= x_max)
        .collect();

    if col_marks.len() < 4 {
        return Err(format!(
            "Sincronizadores insuficientes na faixa [{x_min:.0}..{x_max:.0}]: encontrados {}",
            col_marks.len()
        ));
    }

    // Cluster marks by X coordinate (tolerance 14px)
    let mut sorted_x = col_marks.clone();
    sorted_x.sort_by(|a, b| a.x.partial_cmp(&b.x).unwrap());

    let mut clusters: Vec<Vec<Pt>> = Vec::new();
    for pt in sorted_x {
        if let Some(last) = clusters.last_mut() {
            let mean_x = last.iter().map(|p| p.x).sum::<f64>() / last.len() as f64;
            if (pt.x - mean_x).abs() <= 14.0 {
                last.push(pt);
                continue;
            }
        }
        clusters.push(vec![pt]);
    }

    // Deduplicate marks by Y within each cluster (tolerance 14px)
    for cl in &mut clusters {
        let mut xs: Vec<f64> = cl.iter().map(|p| p.x).collect();
        let med_x = median_f64(&mut xs);
        cl.sort_by(|a, b| a.y.partial_cmp(&b.y).unwrap());
        let mut dedup: Vec<Pt> = Vec::new();
        for p in cl.drain(..) {
            if let Some(prev) = dedup.last_mut() {
                if (p.y - prev.y).abs() < 14.0 {
                    if (p.x - med_x).abs() < (prev.x - med_x).abs() {
                        *prev = p;
                    }
                    continue;
                }
            }
            dedup.push(p);
        }
        *cl = dedup;
    }

    // Keep clusters with at least 2 marks
    clusters.retain(|c| c.len() >= 2);
    if clusters.len() < 2 {
        return Err("Não foi possível encontrar os pares de colunas de sincronizadores".to_string());
    }

    // Pick best (left_cluster, right_cluster) pair with span >= 200px
    let mut best_pair: Option<(usize, usize, usize, usize)> = None; // (i, j, matched_rows, total_len)
    for i in 0..clusters.len() {
        let mean_xi = clusters[i].iter().map(|p| p.x).sum::<f64>() / clusters[i].len() as f64;
        for j in (i + 1)..clusters.len() {
            let mean_xj = clusters[j].iter().map(|p| p.x).sum::<f64>() / clusters[j].len() as f64;
            let span = mean_xj - mean_xi;
            if !(200.0..=850.0).contains(&span) {
                continue;
            }
            let mut matched = 0usize;
            for pl in &clusters[i] {
                if clusters[j].iter().any(|pr| (pl.y - pr.y).abs() <= 18.0) {
                    matched += 1;
                }
            }
            if matched < 2 {
                continue;
            }
            let total_len = clusters[i].len() + clusters[j].len();
            let better = match best_pair {
                None => true,
                Some((_, _, best_m, best_tot)) => {
                    matched > best_m || (matched == best_m && total_len > best_tot)
                }
            };
            if better {
                best_pair = Some((i, j, matched, total_len));
            }
        }
    }

    let Some((li, ri, _, _)) = best_pair else {
        return Err("Colunas esquerda/direita de sincronizadores não puderam ser pareadas".to_string());
    };

    let left_cl = &clusters[li];
    let right_cl = &clusters[ri];

    let mut l_xs: Vec<f64> = left_cl.iter().map(|p| p.x).collect();
    let mut r_xs: Vec<f64> = right_cl.iter().map(|p| p.x).collect();
    let med_lx = median_f64(&mut l_xs);
    let med_rx = median_f64(&mut r_xs);

    // Pair left and right marks by Y
    let mut used_r = vec![false; right_cl.len()];
    let mut rows: Vec<(Pt, Pt, bool)> = Vec::new(); // (l, r, both_matched)
    let mut dy_diffs: Vec<f64> = Vec::new();

    for pl in left_cl {
        if let Some((rj, pr)) = right_cl
            .iter()
            .enumerate()
            .filter(|(idx, pr)| !used_r[*idx] && (pl.y - pr.y).abs() <= 18.0)
            .min_by(|(_, a), (_, b)| (pl.y - a.y).abs().partial_cmp(&(pl.y - b.y).abs()).unwrap())
        {
            used_r[rj] = true;
            dy_diffs.push(pr.y - pl.y);
            rows.push((*pl, *pr, true));
        } else {
            rows.push((*pl, Pt { x: med_rx, y: pl.y }, false));
        }
    }

    let med_dy = if dy_diffs.is_empty() {
        0.0
    } else {
        median_f64(&mut dy_diffs)
    };

    for (rj, pr) in right_cl.iter().enumerate() {
        if !used_r[rj] {
            let l_synth = Pt {
                x: med_lx,
                y: pr.y - med_dy,
            };
            if !rows
                .iter()
                .any(|(l, _, _)| (l.y - l_synth.y).abs() < 14.0)
            {
                rows.push((l_synth, *pr, false));
            }
        }
    }

    rows.sort_by(|a, b| {
        let ya = 0.5 * (a.0.y + a.1.y);
        let yb = 0.5 * (b.0.y + b.1.y);
        ya.partial_cmp(&yb).unwrap()
    });

    // Prune leading or trailing unpaired noise marks if their step deviates from the uniform pitch
    if rows.len() >= 3 {
        let mut steps: Vec<f64> = rows
            .windows(2)
            .map(|w| 0.5 * ((w[1].0.y + w[1].1.y) - (w[0].0.y + w[0].1.y)))
            .collect();
        let pitch = median_f64(&mut steps);
        if pitch > 10.0 {
            while rows.len() >= 3 {
                let first_step = 0.5 * ((rows[1].0.y + rows[1].1.y) - (rows[0].0.y + rows[0].1.y));
                if !rows[0].2 && (first_step < pitch * 0.60 || first_step > pitch * 1.40) {
                    rows.remove(0);
                } else {
                    break;
                }
            }
            while rows.len() >= 3 {
                let n = rows.len();
                let last_step =
                    0.5 * ((rows[n - 1].0.y + rows[n - 1].1.y) - (rows[n - 2].0.y + rows[n - 2].1.y));
                if !rows[n - 1].2 && (last_step < pitch * 0.60 || last_step > pitch * 1.40) {
                    rows.pop();
                } else {
                    break;
                }
            }
        }
    }

    let mut clean_rows: Vec<(Pt, Pt)> = rows.into_iter().map(|(l, r, _)| (l, r)).collect();

    // Interpolate any missing middle row where dy is ~2x or ~3x the uniform pitch
    if clean_rows.len() >= 2 {
        let raw_steps: Vec<f64> = clean_rows
            .windows(2)
            .map(|w| 0.5 * ((w[1].0.y + w[1].1.y) - (w[0].0.y + w[0].1.y)))
            .collect();
        let min_step = raw_steps
            .iter()
            .copied()
            .fold(f64::INFINITY, f64::min)
            .max(18.0);
        let mut unit_steps: Vec<f64> = raw_steps
            .iter()
            .map(|&s| {
                let k = (s / min_step).round().max(1.0);
                s / k
            })
            .collect();
        let pitch = median_f64(&mut unit_steps);

        let mut filled: Vec<(Pt, Pt)> = vec![clean_rows[0]];
        for w in clean_rows.windows(2) {
            let prev = w[0];
            let next = w[1];
            let dy = 0.5 * ((next.0.y + next.1.y) - (prev.0.y + prev.1.y));
            let gaps = (dy / pitch).round() as usize;
            if (2..=3).contains(&gaps) {
                for g in 1..gaps {
                    let frac = g as f64 / gaps as f64;
                    filled.push((
                        Pt {
                            x: prev.0.x + frac * (next.0.x - prev.0.x),
                            y: prev.0.y + frac * (next.0.y - prev.0.y),
                        },
                        Pt {
                            x: prev.1.x + frac * (next.1.x - prev.1.x),
                            y: prev.1.y + frac * (next.1.y - prev.1.y),
                        },
                    ));
                }
            }
            filled.push(next);
        }
        if let Some(exp) = expected_rows_hint {
            if filled.len() == exp || clean_rows.len() < exp {
                clean_rows = filled;
            }
        } else {
            clean_rows = filled;
        }
    }

    Ok(clean_rows)
}

/// Checks if a row has printed bubble rings at options A and E.
/// On a "Questão dissertativa" row, options A and E are blank white paper (no printed rings).
fn row_has_printed_bubbles(
    bin: &Mat,
    l: Pt,
    r: Pt,
    col_t: &[f64; 5],
    col_radius: f64,
) -> bool {
    let dx = r.x - l.x;
    let dy = r.y - l.y;
    let span = (dx * dx + dy * dy).sqrt().max(1.0);
    let ux = dx / span;
    let uy = dy / span;

    let mut ring_a_and_e = 0usize;
    let r_box = (col_radius * 1.15).round() as i32;

    for &opt_idx in &[0usize, 4usize] {
        let cx = (l.x + ux * (col_t[opt_idx] * span)).round() as i32;
        let cy = (l.y + uy * (col_t[opt_idx] * span)).round() as i32;
        let rx = (cx - r_box).max(0);
        let ry = (cy - r_box).max(0);
        let rw = (r_box * 2).min(bin.cols() - rx);
        let rh = (r_box * 2).min(bin.rows() - ry);
        if rw > 4 && rh > 4 {
            if let Ok(roi) = Mat::roi(bin, Rect::new(rx, ry, rw, rh)) {
                let nz = opencv::core::count_non_zero(&roi).unwrap_or(0) as f64;
                let ratio = nz / (rw * rh) as f64;
                if ratio >= 0.08 {
                    ring_a_and_e += 1;
                }
            }
        }
    }

    ring_a_and_e >= 1
}

/// Computes the 5 relative horizontal offsets t_j in [0, 1] along (R - L) and the bubble radius
/// for a column, refining the CSS layout formula with the actual detected bubble circles.
fn compute_column_bubble_geometry(
    rows: &[(Pt, Pt)],
    col_start_q: usize,
    subjective_set: &HashSet<usize>,
    circles: &[CircleCandidate],
) -> ([f64; 5], f64) {
    let mut spans: Vec<f64> = rows
        .iter()
        .map(|(l, r)| ((r.x - l.x).powi(2) + (r.y - l.y).powi(2)).sqrt())
        .collect();
    let med_span = median_f64(&mut spans).max(200.0);

    let s_css = if med_span <= 410.0 {
        med_span / 246.0
    } else {
        1080.0 / 726.0
    };

    let mut base_t = [0.0f64; 5];
    if med_span <= 410.0 {
        for j in 0..5 {
            base_t[j] = OPTION_OFFSETS_PX[j] / 246.0;
        }
    } else {
        let x_start = 59.0 * s_css;
        let x_end = med_span - 11.0 * s_css;
        let opt_w = (x_end - x_start).max(100.0);
        for j in 0..5 {
            let offset = x_start + (0.1 + 0.2 * j as f64) * opt_w;
            base_t[j] = offset / med_span;
        }
    }
    let mut base_radius = (12.5 * s_css).clamp(12.0, 22.0);

    // Refine using detected circle contours along rows in this column
    let mut bucket_t: [Vec<f64>; 5] = Default::default();
    let mut matched_radii: Vec<f64> = Vec::new();

    for (row_idx, (l, r)) in rows.iter().enumerate() {
        let q = col_start_q + row_idx;
        if subjective_set.contains(&q) {
            continue;
        }
        let dx = r.x - l.x;
        let dy = r.y - l.y;
        let span = (dx * dx + dy * dy).sqrt().max(1.0);
        let ux = dx / span;
        let uy = dy / span;

        for c in circles {
            let rel_x = c.cx - l.x;
            let rel_y = c.cy - l.y;
            let along = rel_x * ux + rel_y * uy;
            let perp = (rel_x * (-uy) + rel_y * ux).abs();
            if perp > 12.0 {
                continue;
            }
            let t = along / span;
            if !(0.12..=0.96).contains(&t) {
                continue;
            }
            for j in 0..5 {
                if (t - base_t[j]).abs() <= 0.045 {
                    bucket_t[j].push(t);
                    matched_radii.push(c.radius);
                    break;
                }
            }
        }
    }

    let valid_buckets: Vec<(usize, f64)> = (0..5)
        .filter_map(|j| {
            if !bucket_t[j].is_empty() {
                let mut vals = bucket_t[j].clone();
                Some((j, median_f64(&mut vals)))
            } else {
                None
            }
        })
        .collect();

    if valid_buckets.len() >= 3 {
        let mut dt_estimates: Vec<f64> = Vec::new();
        for a in 0..valid_buckets.len() {
            for b in (a + 1)..valid_buckets.len() {
                let dj = (valid_buckets[b].0 - valid_buckets[a].0) as f64;
                dt_estimates.push((valid_buckets[b].1 - valid_buckets[a].1) / dj);
            }
        }
        let dt = median_f64(&mut dt_estimates);
        let mut t0_estimates: Vec<f64> = valid_buckets
            .iter()
            .map(|&(j, tj)| tj - (j as f64) * dt)
            .collect();
        let t0 = median_f64(&mut t0_estimates);
        for j in 0..5 {
            base_t[j] = t0 + (j as f64) * dt;
        }
    }

    if matched_radii.len() >= 3 {
        base_radius = median_f64(&mut matched_radii).clamp(12.0, 22.0);
    }

    (base_t, base_radius)
}

/// Reads bubbles with morphological opening and circular inner mask on the canonical warped image.
pub fn read_bubbles_on_warped(
    warped: &Mat,
    total_questions: usize,
    subjective_set: &HashSet<usize>,
) -> Result<ReadSheetResult, String> {
    let (hint_columns, hint_per_column) = get_column_layout(total_questions);

    // 1. Extract timing marks and printed bubble circles
    let (bin_marks, marks, circles) = extract_marks_and_circles(warped)?;

    // Determine the physical columns present on the sheet:
    // First try two-column detection if hint_columns == 2, with fallback to 1-column (or vice versa)
    // so that even if the user uploaded a 1-column sheet while a 2-column version was locked (or vice versa),
    // the physical timing marks on the paper are respected.
    let col0_hint = if hint_columns == 2 {
        Some(hint_per_column)
    } else {
        None
    };
    let col1_hint = if hint_columns == 2 {
        Some(total_questions.saturating_sub(hint_per_column))
    } else {
        None
    };
    let single_hint = if hint_columns == 1 {
        Some(total_questions)
    } else {
        None
    };

    let two_col_attempt = match (
        detect_column_rows(&marks, 60.0, 605.0, col0_hint),
        detect_column_rows(&marks, 595.0, 1140.0, col1_hint),
    ) {
        (Ok(r0), Ok(r1)) if !r0.is_empty() && !r1.is_empty() => Some(vec![r0, r1]),
        _ => None,
    };

    let detected_columns: Vec<Vec<(Pt, Pt)>> = if let Some(cols2) = two_col_attempt {
        cols2
    } else {
        let r_single = detect_column_rows(&marks, 65.0, 1135.0, single_hint)?;
        vec![r_single]
    };

    // 2. Prepare morphological maps for bubble interior evaluation:
    let mut bin_large = Mat::default();
    imgproc::adaptive_threshold(
        warped,
        &mut bin_large,
        255.0,
        imgproc::ADAPTIVE_THRESH_GAUSSIAN_C,
        imgproc::THRESH_BINARY_INV,
        71,
        9.0,
    )
    .map_err(|e| e.to_string())?;

    let kernel_3x3 = imgproc::get_structuring_element(
        imgproc::MORPH_ELLIPSE,
        Size::new(3, 3),
        Point::new(-1, -1),
    )
    .map_err(|e| e.to_string())?;

    let mut opened = Mat::default();
    imgproc::morphology_ex(
        &bin_large,
        &mut opened,
        imgproc::MORPH_OPEN,
        &kernel_3x3,
        Point::new(-1, -1),
        1,
        opencv::core::BORDER_CONSTANT,
        Scalar::all(0.0),
    )
    .map_err(|e| e.to_string())?;

    let mut gray_closed = Mat::default();
    imgproc::morphology_ex(
        warped,
        &mut gray_closed,
        imgproc::MORPH_CLOSE,
        &kernel_3x3,
        Point::new(-1, -1),
        1,
        opencv::core::BORDER_REPLICATE,
        Scalar::all(0.0),
    )
    .map_err(|e| e.to_string())?;

    let labels = ["A", "B", "C", "D", "E"];
    let mut detections = Vec::new();
    let mut bubbles_debug = Vec::new();
    let mut timing_marks_debug = Vec::new();
    let mut row_crops_base64 = HashMap::new();

    let mut current_q_offset = 0usize;

    for rows in &detected_columns {
        let col_start_q = current_q_offset + 1;
        current_q_offset += rows.len();

        let (col_t, col_radius) =
            compute_column_bubble_geometry(rows, col_start_q, subjective_set, &circles);

        for (row_idx, &(l, r)) in rows.iter().enumerate() {
            let q = col_start_q + row_idx;

            timing_marks_debug.push(TimingMarkDebugItem {
                row_number: q,
                left_x: l.x,
                left_y: l.y,
                right_x: r.x,
                right_y: r.y,
            });

            // Skip if question is marked subjective in payload OR if physical row has no printed bubbles ("Questão dissertativa")
            if subjective_set.contains(&q)
                || !row_has_printed_bubbles(&bin_marks, l, r, &col_t, col_radius)
            {
                continue;
            }

            let dx = r.x - l.x;
            let dy = r.y - l.y;
            let span = (dx * dx + dy * dy).sqrt().max(1.0);
            let ux = dx / span;
            let uy = dy / span;

            let mut raw_bin_fills = [0.0f64; 5];
            let mut inner_means = [255.0f64; 5];
            let mut centers = [(0.0f64, 0.0f64); 5];

            let r_inner = (col_radius * 0.65).max(6.0);
            let r_int = r_inner.ceil() as i32;
            let r_sq = r_inner * r_inner;

            for opt_idx in 0..5 {
                let mut cx = l.x + ux * (col_t[opt_idx] * span);
                let mut cy = l.y + uy * (col_t[opt_idx] * span);

                // Snap to individual detected circle contour if within 7px
                if let Some(best_c) = circles
                    .iter()
                    .filter(|c| ((c.cx - cx).powi(2) + (c.cy - cy).powi(2)).sqrt() <= 7.0)
                    .min_by(|a, b| {
                        let da = (a.cx - cx).powi(2) + (a.cy - cy).powi(2);
                        let db = (b.cx - cx).powi(2) + (b.cy - cy).powi(2);
                        da.partial_cmp(&db).unwrap()
                    })
                {
                    cx = best_c.cx;
                    cy = best_c.cy;
                }
                centers[opt_idx] = (cx, cy);

                let icx = cx.round() as i32;
                let icy = cy.round() as i32;

                let mut bin_hits = 0usize;
                let mut gray_sum = 0.0f64;
                let mut px_count = 0usize;

                for py in (icy - r_int)..=(icy + r_int) {
                    if py < 0 || py >= opened.rows() {
                        continue;
                    }
                    for px in (icx - r_int)..=(icx + r_int) {
                        if px < 0 || px >= opened.cols() {
                            continue;
                        }
                        let dist_sq = ((px as f64 - cx).powi(2)) + ((py as f64 - cy).powi(2));
                        if dist_sq <= r_sq {
                            px_count += 1;
                            if let Ok(&bval) = opened.at_2d::<u8>(py, px) {
                                if bval > 0 {
                                    bin_hits += 1;
                                }
                            }
                            if let Ok(&gval) = gray_closed.at_2d::<u8>(py, px) {
                                gray_sum += gval as f64;
                            }
                        }
                    }
                }

                if px_count > 0 {
                    raw_bin_fills[opt_idx] = bin_hits as f64 / px_count as f64;
                    inner_means[opt_idx] = gray_sum / px_count as f64;
                }
            }

            let mut sorted_means = inner_means;
            sorted_means.sort_by(|a, b| b.partial_cmp(a).unwrap());
            let paper_ref = sorted_means[1].max(120.0);

            let mut sorted_bin = raw_bin_fills;
            sorted_bin.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let baseline_bin = sorted_bin[1].min(0.18);

            let mut ratios_map: HashMap<String, f64> = HashMap::new();
            let mut detected_opt: Option<String> = None;
            let mut marked_count = 0;

            for (opt_idx, &label) in labels.iter().enumerate() {
                let net_bin = (raw_bin_fills[opt_idx] - baseline_bin).max(0.0);
                let rel_darkness = ((paper_ref - inner_means[opt_idx]) / paper_ref).max(0.0);
                let dark_score = (rel_darkness * 2.4).clamp(0.0, 1.0);
                let fill_ratio = net_bin.max(dark_score).min(1.0);

                ratios_map.insert(label.to_string(), fill_ratio);
                let is_marked = fill_ratio >= 0.38;
                if is_marked {
                    marked_count += 1;
                    detected_opt = Some(label.to_string());
                }

                bubbles_debug.push(BubbleDebugItem {
                    question_number: q,
                    option_label: label.to_string(),
                    cx: centers[opt_idx].0,
                    cy: centers[opt_idx].1,
                    radius: col_radius,
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
            let crop_x = (l.x - 12.0).max(0.0).round() as i32;
            let row_min_y = l.y.min(r.y);
            let row_max_y = l.y.max(r.y);
            let crop_y = (row_min_y - col_radius - 6.0).max(0.0).round() as i32;
            let crop_w = ((r.x - l.x + 24.0).round() as i32).min(warped.cols() - crop_x);
            let crop_h = (((row_max_y - row_min_y) + col_radius * 2.0 + 12.0).round() as i32)
                .min(warped.rows() - crop_y);

            if crop_w > 20 && crop_h > 12 {
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
        timing_marks_debug,
        row_crops_base64,
    })
}
