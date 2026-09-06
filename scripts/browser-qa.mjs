import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
const out = "D:/VibeCoding/AMATERAS/artifacts";
export async function capture(tab, name) {
  await mkdir(out, { recursive: true });
  await writeFile(
    `${out}/${name}.png`,
    await tab.screenshot({ fullPage: false }),
  );
}
export async function checkLayout(tab) {
  const result = await tab.playwright.evaluate(() => {
    const r = (s) => {
      const el = document.querySelector(s),
        b = el.getBoundingClientRect();
      return {
        x: b.x,
        y: b.y,
        w: b.width,
        h: b.height,
        visible: getComputedStyle(el).display !== "none",
      };
    };
    return {
      width: innerWidth,
      height: innerHeight,
      scroll: document.documentElement.scrollWidth,
      map: r(".map-stage"),
      top: r(".topbar"),
      tools: r(".bottom-toolbar"),
      ticker: r(".ticker"),
      timeline: r(".radar-timeline"),
      rail: r(".warning-rail"),
    };
  });
  assert.ok(result.scroll <= result.width + 1, "No horizontal page overflow");
  assert.ok(result.map.w > result.width * 0.7, "Map dominates width");
  assert.ok(result.map.h > result.height * 0.6, "Map dominates height");
  assert.ok(
    result.tools.y + result.tools.h <= result.height + 1,
    "Tools stay inside viewport",
  );
  return result;
}
export async function desktopInteractions(tab) {
  const p = tab.playwright;
  await p.getByRole("button", { name: "凡例", exact: true }).click();
  assert.ok(await p.getByRole("heading", { name: "地図の凡例" }).isVisible());
  await p.getByRole("button", { name: "閉じる", exact: true }).click();
  await p
    .getByRole("button", { name: "テーマを切り替える", exact: true })
    .click();
  assert.ok((await p.locator("main").getAttribute("class")).includes("light"));
  await p
    .getByRole("button", { name: "テーマを切り替える", exact: true })
    .click();
  await p.getByRole("combobox").fill("富士宮市");
  await p.getByRole("option", { name: "富士宮市 静岡県" }).click();
  assert.equal(await p.getByRole("combobox").getAttribute("value"), "富士宮市");
  await p.getByRole("button", { name: "設定", exact: true }).click();
  await p.getByLabel("3D地形", { exact: true }).check();
  assert.ok(await p.getByLabel("3D地形", { exact: true }).isEnabled());
  await p.getByRole("button", { name: "閉じる", exact: true }).click();
  return [
    "legend modal",
    "theme roundtrip",
    "municipality search",
    "3D requested",
  ];
}
export async function mobileInteractions(tab) {
  const p = tab.playwright;
  await p.locator(".mobile-warning-toggle").click();
  assert.ok(
    (await p.locator("main").getAttribute("class")).includes("sheet-open"),
  );
  await p
    .getByRole("button", { name: "警報一覧を閉じる", exact: true })
    .click();
  await p
    .getByRole("button", { name: "タイムラインを開く", exact: true })
    .click();
  assert.ok(
    (await p.locator("main").getAttribute("class")).includes("timeline-open"),
  );
  assert.ok(
    !(await p.locator("main").getAttribute("class")).includes("sheet-open"),
  );
  await p
    .getByRole("button", { name: "タイムラインを閉じる", exact: true })
    .click();
  return ["warning sheet", "timeline drawer", "exclusive mobile panels"];
}
