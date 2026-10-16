#[cfg(opencv_v5)]
pub use opencv::geometry;

#[cfg(not(opencv_v5))]
pub use opencv::imgproc as geometry;

use opencv::core::{Mat, Scalar, Size};
use opencv::imgproc;

pub fn cvt_color(src: &Mat, dst: &mut Mat, code: i32) -> Result<(), opencv::Error> {
    #[cfg(opencv_v5)]
    {
        imgproc::cvt_color(
            src,
            dst,
            code,
            0,
            opencv::core::AlgorithmHint::ALGO_HINT_DEFAULT,
        )
    }
    #[cfg(not(opencv_v5))]
    {
        imgproc::cvt_color(src, dst, code, 0)
    }
}

pub fn warp_perspective(
    src: &Mat,
    dst: &mut Mat,
    m: &Mat,
    dsize: Size,
    flags: i32,
    border_mode: i32,
    border_value: Scalar,
) -> Result<(), opencv::Error> {
    #[cfg(opencv_v5)]
    {
        imgproc::warp_perspective(
            src,
            dst,
            m,
            dsize,
            flags,
            border_mode,
            border_value,
            opencv::core::AlgorithmHint::ALGO_HINT_DEFAULT,
        )
    }
    #[cfg(not(opencv_v5))]
    {
        imgproc::warp_perspective(src, dst, m, dsize, flags, border_mode, border_value)
    }
}
