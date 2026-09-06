import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const local = resolve(
  "artifacts/playwright-browsers/chromium-1243/chrome-win64/chrome.exe",
);
const origin = process.env.AMATERAS_URL ?? "http://127.0.0.1:5186";
const b = await chromium.launch({
  headless: true,
  ...(existsSync(local) ? { executablePath: local } : {}),
});
const report = [];
const regions = [];
let mobileSelection = null;
await mkdir("artifacts/fx", { recursive: true });
const c = await b.newContext();
const page = await c.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
  [768, 1024],
  [390, 844],
]) {
  await page.setViewportSize({ width, height });
  for (const scenario of ["quiet", "rainy", "severe"]) {
    await page.goto(origin + "/?scenario=" + scenario);
    await page.locator(".map-canvas[data-map]").waitFor({ timeout: 45000 });

    await page.waitForFunction(
      () =>
        document
          .querySelector(".timeline-header strong")
          ?.textContent?.includes("12:00"),
      { timeout: 45000 },
    );
    await page.waitForTimeout(1000);
    const name = scenario + "-" + width + "x" + height;
    await page.screenshot({ path: "artifacts/fx/" + name + ".png" });
    const layout = await page.evaluate(() => {
      const r = (s) => {
        const a = document.querySelector(s).getBoundingClientRect();
        return { x: a.x, y: a.y, w: a.width, h: a.height };
      };
      return {
        width: innerWidth,
        height: innerHeight,
        scroll: document.documentElement.scrollWidth,
        map: r(".map-stage"),
        tools: r(".bottom-toolbar"),
        timeline: r(".radar-timeline"),
        rail: r(".warning-rail"),
        fx: document.querySelector(".map-canvas").getAttribute("data-fx"),
        mapState: document
          .querySelector(".map-canvas")
          .getAttribute("data-map"),
      };
    });
    report.push({ name, ...layout });
    if (layout.scroll > width + 1 || !JSON.parse(layout.mapState).terrain)
      throw new Error("Invalid layout or missing 3D: " + name);
    if (width === 390 && scenario === "severe") {
      await page.locator(".mobile-warning-toggle").click();
      await page.getByRole("tab", { name: "台風", exact: true }).click();
      await page.locator(".event-select").first().click();
      await page.waitForTimeout(1500);
      mobileSelection = await page.evaluate(() => {
        const canvas = document.querySelector(".map-canvas");
        const map = canvas.getBoundingClientRect();
        const sheet = document
          .querySelector(".warning-rail")
          .getBoundingClientRect();
        const state = JSON.parse(canvas.dataset.selection);
        return {
          x: map.left + state.point.x,
          y: map.top + state.point.y,
          sheetTop: sheet.top,
          padding: state.padding,
        };
      });
      if (mobileSelection.y >= mobileSelection.sheetTop - 8)
        throw new Error("Selected typhoon hidden by sheet");
      await page.screenshot({ path: "artifacts/fx/mobile-typhoon-sheet.png" });
    }
  }
}
await page.setViewportSize({ width: 1366, height: 768 });
for (const [name, code] of [
  ["mountain-warning", "1320100"],
  ["coastal-warning", "1410011"],
  ["island-warning", "1340100"],
]) {
  await page.goto(origin + "/?scenario=severe&area=" + code);
  await page.locator(".map-canvas[data-map]").waitFor({ timeout: 45000 });
  await page.locator(".warning-row").first().click();
  await page.getByRole("button", { name: "雨雲", exact: true }).click();
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector(".map-canvas").dataset.fx ?? "{}")
        .faces > 0,
  );
  await page.waitForFunction(() => {
    const e = document.querySelector(".map-canvas"),
      m = JSON.parse(e.dataset.map ?? "{}"),
      f = JSON.parse(e.dataset.fx ?? "{}");
    return m.terrain && m.zoom > 7 && f.faces > 0;
  });
  await page.waitForTimeout(1000);
  const state = await page
    .locator(".map-canvas")
    .evaluate((e) => ({
      map: JSON.parse(e.dataset.map),
      fx: JSON.parse(e.dataset.fx),
    }));
  regions.push({ name, code, ...state });
  console.log(name, JSON.stringify(state));
  await page.screenshot({ path: "artifacts/fx/" + name + ".png" });
}
console.log(JSON.stringify({ screenshots: report.length, errors }));
await writeFile(
  "artifacts/fx/layout-report.json",
  JSON.stringify(
    { at: new Date().toISOString(), report, regions, mobileSelection, errors },
    null,
    2,
  ),
);
await b.close();
if (errors.length) throw new Error("Browser errors: " + errors.join("; "));
