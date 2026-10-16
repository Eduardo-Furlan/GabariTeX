fn main() {
    tauri_build::build();

    println!("cargo::rustc-check-cfg=cfg(opencv_v5)");

    let is_opencv_v5 = if pkg_config::probe_library("opencv5").is_ok() {
        true
    } else if let Ok(lib) = pkg_config::probe_library("opencv4") {
        lib.version.starts_with("5.")
    } else if let Ok(lib) = pkg_config::probe_library("opencv") {
        lib.version.starts_with("5.")
    } else {
        false
    };

    if is_opencv_v5 {
        println!("cargo::rustc-cfg=opencv_v5");
    }
}
