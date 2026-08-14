$ErrorActionPreference = "Stop"

Write-Host "[1/3] 의존성 설치..."
npm ci

Write-Host "[2/3] JavaScript 구문 검사 + 단독 HTML 드리프트 검사..."
npm run check
npm run build:standalone
git diff --exit-code -- web_standalone.html helper_preview.html
if ($LASTEXITCODE -ne 0) { throw "생성물이 frontend/ 와 어긋납니다. npm run build:standalone 후 커밋하세요." }

Write-Host "[3/3] NSIS 설치파일 빌드..."
npx tauri build --bundles nsis

Write-Host "설치파일: src-tauri\target\release\bundle\nsis"
