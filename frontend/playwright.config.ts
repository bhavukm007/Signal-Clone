import { devices, defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/globalTeardown.ts',
  outputDir: './test-results',
  timeout: 60000,
  workers: 1,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      testIgnore: '**/mobile-panels.spec.ts',
      use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
        browserName: 'chromium',
        launchOptions: { channel: 'chrome' },
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'mobile',
      testMatch: '**/mobile-panels.spec.ts',
      use: {
        ...devices['iPhone 13'],
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
        browserName: 'chromium',
        launchOptions: { channel: 'chrome' },
      },
    },
  ],
});
