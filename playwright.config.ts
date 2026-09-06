import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
const browserRoot = resolve("artifacts/playwright-browsers");
const browserDir = existsSync(browserRoot)
  ? readdirSync(browserRoot).find((n) => /^chromium-\d+$/.test(n))
  : undefined;
const localBrowser = browserDir
  ? resolve(browserRoot, browserDir, "chrome-win64/chrome.exe")
  : undefined;
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15000 },
  workers: 2,
  use: {
    launchOptions: {
      executablePath:
        localBrowser && existsSync(localBrowser) ? localBrowser : undefined,
    },
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
    { name: "wide", use: { viewport: { width: 1920, height: 1080 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { viewport: { width: 1366, height: 768 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
});
