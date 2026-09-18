'use strict';
const { defineConfig, devices } = require('@playwright/test');
const PORT = 4326;
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 800 }   // devices 기본값(1280x720)을 반드시 덮어쓴다
  },
  webServer: {
    command: 'node server.js',
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 20000
  }
});
