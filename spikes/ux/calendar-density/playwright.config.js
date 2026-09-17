const { defineConfig, devices } = require("@playwright/test");

const PORT = 4319;

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "./test-results",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
    deviceScaleFactor: 1
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }
  ],
  webServer: {
    command: `node server.js`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
