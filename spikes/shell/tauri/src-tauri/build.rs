//! Spike A / Tauri 2 build script.
//!
//! The only thing this adds over `tauri_build::build()` is an EXPLICIT Windows application
//! manifest. tauri-build's default manifest declares the comctl32 v6 dependency and nothing
//! else — in particular no DPI awareness — so the produced `.exe` had an unverified
//! activation context. `windows-app-manifest.xml` declares comctl32 v6, PerMonitorV2 /
//! `true/pm` DPI, the supported OS and `asInvoker`, and this file wires it into the resource
//! tauri-winres compiles, so `rc.exe` embeds it as `RT_MANIFEST` (resource id 1).
//!
//! Cross-compiling from Linux there is no resource compiler, so `cargo check
//! --target x86_64-pc-windows-msvc` type-checks but embeds nothing. That is exactly why the
//! embedding is proved by inspecting the real `.exe` resource on windows-latest in CI
//! (`spikes/shell/scripts/inspect-exe-manifest.ps1`), not by asserting this file exists.

fn main() {
    // The manifest is `include_str!`-ed below, which already makes cargo track it, but being
    // explicit keeps the dependency obvious to anyone reading the build.
    println!("cargo:rerun-if-changed=windows-app-manifest.xml");

    // `WindowsAttributes` is not cfg-gated and tauri-build only consults it when the *target*
    // is Windows, so this is set unconditionally — a `#[cfg(windows)]` here would test the
    // build host and silently drop the manifest on a Linux -> MSVC cross build.
    let windows = tauri_build::WindowsAttributes::new()
        .app_manifest(include_str!("windows-app-manifest.xml"));

    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        .expect("tauri-build failed while embedding windows-app-manifest.xml");
}
