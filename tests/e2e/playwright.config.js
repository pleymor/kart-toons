import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        // Enable software WebGL so the Three.js renderer initialises in headless
        // CI (otherwise init() throws on context creation and no UI renders).
        launchOptions: {
          args: [
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
          ],
        },
      },
    },
    { name: 'Desktop Firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'iPhone 14', use: { ...devices['iPhone 14'] } },
    { name: 'Galaxy S21', use: { ...devices['Galaxy S21'] } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    cwd: '../../',
  },
});
