$ErrorActionPreference = "Stop"

Write-Host "[1/4] 의존성 설치..."
npm ci

Write-Host "[2/4] JavaScript 구문 검사 + 단독 HTML 드리프트 검사..."
npm run check
npm run build:standalone
git diff --exit-code -- web_standalone.html helper_preview.html
if ($LASTEXITCODE -ne 0) { throw "생성물이 frontend/ 와 어긋납니다. npm run build:standalone 후 커밋하세요." }

Write-Host "[3/4] Tauri CLI 확인..."
# cargo install tauri-cli 는 소스 컴파일이라 10분 넘게 걸린다. npm 배포판은 미리 빌드된 바이너리다.
npm install --no-save "@tauri-apps/cli@^2"

Write-Host "[4/4] NSIS 설치파일 빌드..."
npx tauri build --bundles nsis

Write-Host "설치파일: src-tauri\target\release\bundle\nsis"
