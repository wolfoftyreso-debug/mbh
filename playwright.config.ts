import { defineConfig } from "@playwright/test";

/**
 * Browser end-to-end tests against the real UI (dev server, development login).
 * Run with: pnpm test:e2e   (requires DATABASE_URL and seeded demo users)
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 420_000,
  expect: { timeout: 30_000 },
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  // Keep traces and screenshots out of the watched project tree so the dev server does not recompile on every write.
  outputDir: process.env.E2E_OUTPUT_DIR ?? "/tmp/humanauth-e2e-results",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    locale: "en-GB",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM === "" ? {} : { executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" },
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "NEXT_DIST_DIR=.next-e2e APP_URL=http://127.0.0.1:3100 BETTER_AUTH_URL=http://127.0.0.1:3100 AUTH_DEV_LOGIN=true pnpm exec next dev -p 3100",
        url: "http://127.0.0.1:3100/api/health",
        timeout: 180_000,
        reuseExistingServer: true,
      },
});
