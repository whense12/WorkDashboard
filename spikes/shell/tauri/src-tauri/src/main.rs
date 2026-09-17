// Spike A / Tauri 2 — Windows desktop shell behaviour probe.
// Hides the console window on Windows release builds.
#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

fn main() {
    spike_shell_tauri_lib::run();
}
