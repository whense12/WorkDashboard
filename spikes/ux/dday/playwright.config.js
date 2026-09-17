const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: './test-results',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    screenshot: 'off',
    video: 'off',
    trace: 'off'
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } }
    }
  ],
  webServer: {
    command: 'node server.js',
    url: 'http://127.0.0.1:4173/index.html',
    cwd: __dirname,
    reuseExistingServer: true,
    timeout: 20000
  }
});
