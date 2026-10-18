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

    ensure_windows_test_manifest();
}

const MINIMAL_V6_MANIFEST: &str = "\
<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n\
<assembly xmlns=\"urn:schemas-microsoft-com:asm.v1\" manifestVersion=\"1.0\">\n\
  <dependency>\n\
    <dependentAssembly>\n\
      <assemblyIdentity\n\
        type=\"win32\"\n\
        name=\"Microsoft.Windows.Common-Controls\"\n\
        version=\"6.0.0.0\"\n\
        processorArchitecture=\"*\"\n\
        publicKeyToken=\"6595b64144ccf1df\"\n\
        language=\"*\"\n\
      />\n\
    </dependentAssembly>\n\
  </dependency>\n\
</assembly>\n";

fn ensure_windows_test_manifest() {
    if std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default() != "windows"
        || std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default() != "msvc"
    {
        return;
    }
    let out_dir = std::path::PathBuf::from(
        std::env::var("OUT_DIR").expect("OUT_DIR is required in build script"),
    );
    let manifest_path = out_dir.join("test_manifest.xml");
    std::fs::write(&manifest_path, MINIMAL_V6_MANIFEST)
        .expect("failed to write test manifest");
    println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    println!(
        "cargo:rustc-link-arg=/MANIFESTINPUT:{}",
        manifest_path.display()
    );
}
