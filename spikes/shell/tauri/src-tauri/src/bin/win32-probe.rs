//! Spike A — CI entry point for the headless Win32 primitive probe.
//!
//! Deliberately a **bin of this same package**, not an integration test: cargo links the
//! tauri-winres resource into every binary of the package (`cargo:rustc-link-arg-bins`), so
//! this executable carries the same embedded `RT_MANIFEST` as the app — comctl32 v6 and
//! PerMonitorV2 — and therefore measures the app's real activation context. A `tests/`
//! target would not get the manifest and would be measuring a different process.
//!
//! No `windows_subsystem = "windows"` here on purpose: the probe is a console program and CI
//! reads its stdout.
//!
//! Usage:
//!   win32-probe                  # print the report, exit 1 if anything FAILed
//!   win32-probe --out report.md  # also write the report to a file
//!
//! Exit codes: `0` = no FAIL (on Linux every check is NOT APPLICABLE, which is not a
//! failure), `1` = at least one primitive genuinely failed, `2` = bad arguments.

use std::process::ExitCode;

use spike_shell_tauri_lib::win32_probe;

fn main() -> ExitCode {
    let mut out_file: Option<String> = None;
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--out" => match args.next() {
                Some(p) => out_file = Some(p),
                None => {
                    eprintln!("win32-probe: --out needs a path");
                    return ExitCode::from(2);
                }
            },
            "-h" | "--help" => {
                println!("usage: win32-probe [--out <file>]");
                return ExitCode::SUCCESS;
            }
            other => {
                eprintln!("win32-probe: unknown argument {other:?}");
                return ExitCode::from(2);
            }
        }
    }

    let report = win32_probe::run();
    let body = report.to_text();

    println!("# Spike A - Tauri/Win32 headless probe");
    println!();
    println!("Measured on this machine, now. Interactive-desktop behaviour (click-through,");
    println!("focus steal, Win+D, monitor hotplug, DPI changes) is NOT part of this probe and");
    println!("stays NOT TESTED in spikes/shell/acceptance.md.");
    println!();
    print!("{body}");

    if let Some(path) = out_file {
        let mut doc = String::new();
        doc.push_str("# Spike A - Tauri/Win32 headless probe\n\n");
        doc.push_str(
            "Interactive-desktop behaviour is out of scope here and stays `NOT TESTED`.\n\n```\n",
        );
        doc.push_str(&body);
        doc.push_str("```\n");
        if let Err(e) = std::fs::write(&path, doc) {
            eprintln!("win32-probe: could not write {path}: {e}");
            return ExitCode::from(1);
        }
    }

    let failures = report.failures();
    if failures > 0 {
        eprintln!("win32-probe: {failures} primitive(s) FAILED");
        return ExitCode::from(1);
    }
    ExitCode::SUCCESS
}
