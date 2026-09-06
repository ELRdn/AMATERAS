import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:5186",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5186",
    reuseExistingServer: true,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1366, height: 768 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
});
