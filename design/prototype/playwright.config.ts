import { defineConfig } from "@playwright/test";

/* 사전 설치 Chromium을 그대로 쓴다(PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1).
   창 동작(always-on-bottom·click-through)은 브라우저에서 검증할 수 없으므로 여기 없다. */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "tests/e2e/report" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1366, height: 768 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    screenshot: "only-on-failure",
    launchOptions: { executablePath: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell" },
  },
  webServer: {
    command: "pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
