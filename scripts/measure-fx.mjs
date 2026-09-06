import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const local = resolve(
  "artifacts/playwright-browsers/chromium-1243/chrome-win64/chrome.exe",
);
const browser = await chromium.launch({
  headless: true,
  ...(existsSync(local) ? { executablePath: local } : {}),
  args: ["--enable-precise-memory-info"],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  const counts = {},
    seen = new WeakSet(),
    intervals = new Set(),
    states = new WeakMap();
  const registry = new FinalizationRegistry((s) => {
    if (s.active) {
      s.active = false;
      counts[s.type]--;
    }
  });
  window.__fxResources = { counts, intervals };
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
    for (const type of [
      "Buffer",
      "Texture",
      "Framebuffer",
      "Renderbuffer",
      "Program",
      "Shader",
      "VertexArray",
      "Query",
      "Sampler",
      "TransformFeedback",
    ]) {
      const p = C.prototype,
        create = p["create" + type],
        del = p["delete" + type];
      if (typeof create !== "function" || !Object.hasOwn(p, "create" + type))
        continue;
      p["create" + type] = function (...args) {
        const o = create.apply(this, args);
        if (o && !seen.has(o)) {
          seen.add(o);
          counts[type] = (counts[type] || 0) + 1;
          const state = { type, active: true };
          states.set(o, state);
          registry.register(o, state);
        }
        return o;
      };
      p["delete" + type] = function (o) {
        if (o && seen.has(o)) {
          seen.delete(o);
          states.get(o).active = false;
          counts[type]--;
        }
        return del.call(this, o);
      };
    }
  }
  const si = window.setInterval,
    ci = window.clearInterval;
  window.setInterval = function (...args) {
    const id = si(...args);
    intervals.add(id);
    return id;
  };
  window.clearInterval = function (id) {
    intervals.delete(id);
    return ci(id);
  };
});
await page.goto(
  (process.env.AMATERAS_URL ?? "http://127.0.0.1:5186") + "/?scenario=severe",
);
await page.locator(".map-canvas[data-map]").waitFor({ timeout: 60000 });
await page.getByRole("button", { name: "表示", exact: true }).click();
await page.getByLabel("立体表現の品質").selectOption("medium");
await page.getByRole("button", { name: "閉じる", exact: true }).click();
const cdp = await page.context().newCDPSession(page);
const samples = [];
async function sample(stage) {
  await page.waitForTimeout(800);
  await cdp.send("HeapProfiler.collectGarbage");
  await page.waitForTimeout(100);
  const value = await page.evaluate(() => {
    const e = document.querySelector(".map-canvas");
    return {
      map: JSON.parse(e.dataset.map ?? "{}"),
      fx: JSON.parse(e.dataset.fx ?? "{}"),
      gpuObjects: { ...window.__fxResources.counts },
      intervals: window.__fxResources.intervals.size,
      canvases: e.querySelectorAll("canvas").length,
      heap: performance.memory?.usedJSHeapSize,
    };
  });
  samples.push({ stage, ...value });
}
async function frames() {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const d = [];
        let prev = performance.now();
        function tick(t) {
          d.push(t - prev);
          prev = t;
          if (d.length < 180) requestAnimationFrame(tick);
          else {
            const s = d.slice(1).sort((a, b) => a - b);
            resolve({
              median: s[Math.floor(s.length * 0.5)],
              p95: s[Math.floor(s.length * 0.95)],
              max: s.at(-1),
            });
          }
        }
        requestAnimationFrame(tick);
      }),
  );
}
await page.waitForTimeout(2000);
await sample("warm");
const idleRaf = await frames();
const cycleCount = Number(process.env.FX_CYCLES ?? 20);
for (let i = 1; i <= cycleCount; i++) {
  await page.getByRole("button", { name: "テーマを切り替える" }).click();
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector(".map-canvas").dataset.map ?? "{}")
        .terrain === true,
  );
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector(".map-canvas").dataset.mode === "2d",
  );
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector(".map-canvas").dataset.map ?? "{}")
        .terrain === true,
  );
  if (i % 5 === 0) {
    await sample("cycle-" + i);
    console.log("cycles", i);
  }
}
await page.getByRole("button", { name: "再生", exact: true }).click();
const playbackRaf = await frames();
await page.waitForTimeout(12000);
await sample("playing");
await page.getByRole("button", { name: "停止", exact: true }).click();
await page.getByRole("button", { name: "最新", exact: true }).click();
await sample("stopped");
await mkdir("artifacts/fx", { recursive: true });
const result = {
  at: new Date().toISOString(),
  description:
    "Real map/DEM, development MOCK DATA. RAF intervals are scheduling intervals, not GPU render time. JS heap measured after explicit GC. WebGL counts track create/delete and GC of JS resource wrappers, not VRAM bytes.",
  idleRaf,
  playbackRaf,
  samples,
  errors,
};
await writeFile(
  "artifacts/fx/performance.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
await browser.close();
const a = samples.find((s) => s.stage === "cycle-" + (cycleCount - 10)),
  z = samples.find((s) => s.stage === "cycle-" + cycleCount);
const early = samples.filter(
    (s) =>
      s.stage.startsWith("cycle-") &&
      Number(s.stage.slice(6)) <= cycleCount - 10,
  ),
  late = samples.filter(
    (s) =>
      s.stage.startsWith("cycle-") &&
      Number(s.stage.slice(6)) > cycleCount - 10,
  );
assert(
  z.heap - a.heap < 8 * 1024 * 1024,
  "Steady-state heap growth exceeds 8 MiB",
);
// Tile load timing changes individual samples. Compare high-water marks.
for (const key of ["Texture", "Buffer", "VertexArray"])
  assert(
    Math.max(...late.map((s) => s.gpuObjects[key] ?? 0)) -
      Math.max(...early.map((s) => s.gpuObjects[key] ?? 0)) <=
      32,
    key + " resources keep growing",
  );
assert.equal(z.intervals, a.intervals);
assert.equal(z.canvases, 1);
assert.equal(errors.length, 0);
