const fs = require('node:fs');
const path = require('node:path');
const { defineConfig } = require('@playwright/test');

const authFile = path.join(process.cwd(), 'playwright', '.auth', 'bodygate.json');
const storageState = fs.existsSync(authFile) ? authFile : undefined;

module.exports = defineConfig({
  testDir: './tests',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    storageState,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'tablet-portrait', use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'tablet-landscape', use: { browserName: 'chromium', viewport: { width: 1024, height: 768 }, hasTouch: true } },
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true } }
  ]
});
