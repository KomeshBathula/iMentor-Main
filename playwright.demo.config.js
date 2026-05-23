// playwright.demo.config.js — Demo run config: always record video
// Extends the main config but forces video ON for all tests (student demo)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report-demo' }], ['list']],
  timeout: 300000,
  expect: { timeout: 30000 },
  use: {
    baseURL: 'http://localhost:3005',
    headless: false,
    video: 'on',                   // Always record — demo videos
    screenshot: 'only-on-failure', // Screenshot on failure (avoids overhead during streaming)
    trace: 'retain-on-failure',    // Trace only on failure (avoids Chrome OOM during SSE streaming)
    actionTimeout: 15000,
  },
  webServer: {
    command: 'cd frontend && npm run dev',
    url: 'http://localhost:3005',
    timeout: 120000,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
