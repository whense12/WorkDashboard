$ErrorActionPreference = "Stop"
Write-Host "[1/3] Checking JavaScript..."
node --check frontend/core.js
node --check frontend/app.js
node --check frontend/helper.js
Write-Host "[2/3] Ensuring Tauri CLI..."
if (-not (Get-Command cargo-tauri -ErrorAction SilentlyContinue)) { cargo install tauri-cli --version "^2" --locked }
Write-Host "[3/3] Building NSIS installer..."
Push-Location src-tauri
cargo tauri build --bundles nsis
Pop-Location
Write-Host "Installer: src-tauri\target\release\bundle\nsis"
