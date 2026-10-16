use super::detector::DetectedFiducials;
use super::reader::BubbleDebugItem;
use opencv::core::{Mat, Point, Scalar, Vector};
use opencv::imgproc;
use opencv::prelude::*;

pub fn draw_debug_overlay_base64(
    canvas_bgr: &mut Mat,
    fid: Option<&DetectedFiducials>,
    bubbles: &[BubbleDebugItem],
    banner_msg: &str,
    is_error: bool,
) -> String {
    // 1. Draw fiducials box if available
    if let Some(f) = fid {
        let p_tl = Point::new(f.top_left.x.round() as i32, f.top_left.y.round() as i32);
        let p_tr = Point::new(f.top_right.x.round() as i32, f.top_right.y.round() as i32);
        let p_br = Point::new(f.bottom_right.x.round() as i32, f.bottom_right.y.round() as i32);
        let p_bl = Point::new(f.bottom_left.x.round() as i32, f.bottom_left.y.round() as i32);

        let purple = Scalar::new(180.0, 50.0, 180.0, 0.0);
        let _ = imgproc::line(canvas_bgr, p_tl, p_tr, purple, 3, imgproc::LINE_AA, 0);
        let _ = imgproc::line(canvas_bgr, p_tr, p_br, purple, 3, imgproc::LINE_AA, 0);
        let _ = imgproc::line(canvas_bgr, p_br, p_bl, purple, 3, imgproc::LINE_AA, 0);
        let _ = imgproc::line(canvas_bgr, p_bl, p_tl, purple, 3, imgproc::LINE_AA, 0);
    }

    // 2. Draw bubble circles and fill ratio labels
    for b in bubbles {
        let center = Point::new(b.cx.round() as i32, b.cy.round() as i32);
        let color = if b.is_marked {
            Scalar::new(40.0, 200.0, 40.0, 0.0) // Green
        } else if b.fill_ratio >= 0.20 {
            Scalar::new(0.0, 140.0, 255.0, 0.0) // Orange/doubt
        } else {
            Scalar::new(200.0, 100.0, 40.0, 0.0) // Blue/blank
        };

        let _ = imgproc::circle(
            canvas_bgr,
            center,
            b.radius.round() as i32,
            color,
            2,
            imgproc::LINE_AA,
            0,
        );

        let text = format!("{}:{}", b.option_label, (b.fill_ratio * 100.0).round() as i32);
        let text_pt = Point::new(center.x - 12, center.y - 12);
        let _ = imgproc::put_text(
            canvas_bgr,
            &text,
            text_pt,
            imgproc::FONT_HERSHEY_PLAIN,
            0.75,
            color,
            1,
            imgproc::LINE_AA,
            false,
        );
    }

    // 3. Banner text
    let banner_color = if is_error {
        Scalar::new(0.0, 0.0, 220.0, 0.0) // Red
    } else {
        Scalar::new(10.0, 160.0, 40.0, 0.0) // Green
    };

    let _ = imgproc::rectangle(
        canvas_bgr,
        opencv::core::Rect::new(0, 0, canvas_bgr.cols(), 40),
        banner_color,
        -1,
        imgproc::LINE_8,
        0,
    );

    let _ = imgproc::put_text(
        canvas_bgr,
        banner_msg,
        Point::new(15, 26),
        imgproc::FONT_HERSHEY_SIMPLEX,
        0.65,
        Scalar::new(255.0, 255.0, 255.0, 0.0),
        2,
        imgproc::LINE_AA,
        false,
    );

    // 4. Encode to JPEG DataURL
    let mut buf = Vector::<u8>::new();
    let params = Vector::<i32>::new();
    if opencv::imgcodecs::imencode(".jpg", canvas_bgr, &mut buf, &params).is_ok() {
        format!(
            "data:image/jpeg;base64,{}",
            base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                buf.as_slice()
            )
        )
    } else {
        String::new()
    }
}

