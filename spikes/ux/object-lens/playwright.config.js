// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = 5183;

module.exports = defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:' + PORT,
    headless: true,
    viewport: { width: 1360, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'off'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: {
    command: 'node server.js',
    port: PORT,
    reuseExistingServer: true,
    timeout: 20000
  }
});
