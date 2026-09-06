import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const local = resolve(
  "artifacts/playwright-browsers/chromium-1243/chrome-win64/chrome.exe",
);
const browser = await chromium.launch({
  headless: true,
  ...(existsSync(local) ? { executablePath: local } : {}),
});
const origin = process.env.AMATERAS_URL ?? "http://127.0.0.1:5186";
const live = process.env.GRAPHICS_LIVE === "1";
await mkdir("artifacts/graphics", { recursive: true });
const results = [],
  errors = [];
for (const [width, height, dpr] of [
  [1920, 1080, 1],
  [1366, 768, 1],
  [768, 1024, 1],
  [390, 844, 1],
  [1366, 768, 2],
]) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + (live ? "/?graphics=review" : "/?scenario=severe"));
  await page.locator(".map-canvas canvas").waitFor();
  await page.getByRole("button", { name: "表示", exact: true }).click();
  await page
    .locator(".graphics-readout b")
    .filter({ hasText: /[0-9]/ })
    .waitFor();
  const suffix = width + "x" + height + "-dpr" + dpr + (live ? "-live" : "");
  await page.screenshot({
    path: "artifacts/graphics/settings-" + suffix + ".png",
  });
  for (const [preset, label] of [
    ["balanced", "バランス"],
    ["performance", "省電力"],
    ["quality", "高画質"],
  ]) {
    await page.getByRole("button", { name: label + "プリセット" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    if (!live)
      await page.waitForFunction(
        () =>
          !!JSON.parse(
            document.querySelector(".map-canvas").dataset.map ?? "{}",
          ).terrain,
      );
    await page.waitForTimeout(800);
    const sample = await page.locator(".map-canvas").evaluate((e) => {
      const c = e.querySelector("canvas"),
        gl = c.getContext("webgl2"),
        ext = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        width: c.width,
        height: c.height,
        canvasCount: e.querySelectorAll("canvas").length,
        mode: e.dataset.mode,
        fx: JSON.parse(e.dataset.fx ?? "{}"),
        map: JSON.parse(e.dataset.map ?? "{}"),
        renderer: ext
          ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
          : "unavailable",
        mock: !!document.querySelector(".mock-banner"),
        notice: document.querySelector(".map-notice")?.textContent ?? null,
      };
    });
    if (sample.mode !== "3d" || sample.canvasCount !== 1)
      throw Error("3D/canvas regression: " + suffix);
    if (sample.mock === live) throw Error("Unexpected mock mode");
    results.push({ viewport: { width, height, dpr }, preset, ...sample });
    if (dpr === 1 && width === 1366)
      await page.screenshot({
        path:
          "artifacts/graphics/map-" + preset + (live ? "-live" : "") + ".png",
      });
    if (dpr === 1 && width === 390 && preset === "performance") {
      await page.locator(".mobile-warning-toggle").click();
      await page.getByRole("tab", { name: "台風", exact: true }).click();
      if (await page.locator(".event-select").count())
        await page.locator(".event-select").first().click();
      await page.waitForTimeout(700);
      await page.screenshot({
        path:
          "artifacts/graphics/mobile-power-sheet" +
          (live ? "-live" : "") +
          ".png",
      });
      await page.getByRole("button", { name: "警報一覧を閉じる" }).click();
    }
    await page.getByRole("button", { name: "表示", exact: true }).click();
  }
  await context.close();
}
for (let i = 0; i < results.length; i += 3) {
  const [a, low, high] = results.slice(i, i + 3);
  const ratio = (low.width * low.height) / (high.width * high.height);
  if (Math.abs(ratio - 0.25) > 0.003)
    throw Error("Unexpected pixel ratio: " + ratio);
}
await browser.close();
const report = {
  at: new Date().toISOString(),
  origin,
  live,
  description:
    "Actual map canvas sizes; pixel counts are not GPU time or FPS. UI screenshots use real basemap/DEM with explicit mock weather in development.",
  results,
  errors,
};
await writeFile(
  "artifacts/graphics/" + (live ? "live" : "comparison") + ".json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    views: results.length,
    renderer: results[0].renderer,
    errors,
    pixels: results
      .filter((x) => x.viewport.width === 1366 && x.viewport.dpr === 1)
      .map((x) => ({
        preset: x.preset,
        width: x.width,
        height: x.height,
        fxLayers: x.fx.layers,
        terrain: x.mode,
      })),
  }),
);
if (errors.length) throw Error(errors.join("; "));
