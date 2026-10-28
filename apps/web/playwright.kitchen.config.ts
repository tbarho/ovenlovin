import { chromium, defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_KITCHEN_PORT || "3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e/kitchen",
  globalSetup: "./e2e/kitchen/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `pnpm exec next dev --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          ...process.env,
          E2E_AUTH_BYPASS: "1",
          OVENLOVIN_BOOKS: "1",
          // The PDF worker prints with the same Chromium the tests drive.
          CHROMIUM_PATH: chromium.executablePath(),
          PORT: port,
        },
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
