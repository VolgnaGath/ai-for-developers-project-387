import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './smoke',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5199',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run start',
      cwd: '../backend',
      url: 'http://127.0.0.1:4020/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        HOST: '127.0.0.1',
        PORT: '4020',
        FRONTEND_ORIGIN: 'http://127.0.0.1:5199',
      },
    },
    {
      command: 'npm run dev:e2e',
      url: 'http://127.0.0.1:5199',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_API_BASE_URL: 'http://127.0.0.1:4020',
      },
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
