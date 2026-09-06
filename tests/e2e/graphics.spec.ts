import { test, expect } from "@playwright/test";
import { fixtureMap } from "./fixtures";
test.beforeEach(async ({ page }) => fixtureMap(page));
const state = async (page: import("@playwright/test").Page) =>
  JSON.parse(
    (await page.locator(".map-canvas").getAttribute("data-map")) || "{}",
  );
test("balanced default and power saver change actual resolution and survive reload", async ({
  page,
}) => {
  await page.goto("/?scenario=severe");
  await expect.poll(async () => (await state(page)).pixelRatio).toBe(0.75);
  await page.getByRole("button", { name: "表示", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "バランスプリセット" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "高画質プリセット" }).click();
  await expect.poll(async () => (await state(page)).pixelRatio).toBe(1);
  const pixels = () =>
    page
      .locator(".map-canvas canvas")
      .evaluate((c: HTMLCanvasElement) => c.width * c.height);
  const full = await pixels();
  await page.getByRole("button", { name: "省電力プリセット" }).click();
  await expect.poll(async () => (await state(page)).pixelRatio).toBe(0.5);
  expect((await pixels()) / full).toBeCloseTo(0.25, 2);
  await expect.poll(async () => (await state(page)).terrainMaxZoom).toBe(10);
  await expect.poll(async () => (await state(page)).hillshade).toBe(false);
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-fx",
    /"layers":0/,
  );
  await expect(page.locator("main")).toHaveAttribute("data-animations", "off");
  await expect(page.locator(".map-canvas")).toHaveAttribute("data-mode", "3d");
  await expect(page.locator(".rail-summary")).toContainText("5");
  await page.reload();
  await expect.poll(async () => (await state(page)).pixelRatio).toBe(0.5);
  await page.getByRole("button", { name: "表示", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "省電力プリセット" }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("individual graphics controls keep selection and reduced motion after a theme change", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?scenario=severe");
  await page.getByRole("button", { name: "表示", exact: true }).click();
  await page.getByLabel("描画解像度", { exact: true }).selectOption("1");
  await page.getByLabel("地形の細かさ", { exact: true }).selectOption("high");
  await page.getByLabel("地形の陰影", { exact: true }).uncheck();
  await expect(page.locator(".graphics-current")).toHaveText("カスタム");
  await expect(
    page.getByLabel("アニメーション", { exact: true }),
  ).toBeDisabled();
  await expect(page.locator("main")).toHaveAttribute("data-animations", "off");
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.getByRole("button", { name: "テーマを切り替える" }).click();
  await expect.poll(async () => (await state(page)).terrainMaxZoom).toBe(14);
  await expect.poll(async () => (await state(page)).hillshade).toBe(false);
  await expect.poll(async () => (await state(page)).pixelRatio).toBe(1);
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page.getByRole("button", { name: "表示", exact: true }).click();
  await page.getByRole("button", { name: "バランスプリセット" }).click();
  await expect(page.locator(".map-canvas")).toHaveAttribute("data-mode", "2d");
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  expect(await page.locator(".map-canvas canvas").count()).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
test("repeated presets restore a fixed number of layers", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Preset lifecycle stress runs once on desktop.",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?scenario=severe");
  await page.getByRole("button", { name: "表示", exact: true }).click();
  const counts: number[] = [];
  for (let i = 0; i < 6; i++) {
    await page.getByRole("button", { name: "省電力プリセット" }).click();
    await expect.poll(async () => (await state(page)).terrainMaxZoom).toBe(10);
    await page.getByRole("button", { name: "高画質プリセット" }).click();
    await expect.poll(async () => (await state(page)).terrainMaxZoom).toBe(14);
    await expect(page.locator(".map-canvas")).toHaveAttribute(
      "data-fx",
      /"layers":1/,
    );
    counts.push((await state(page)).layers);
    expect(await page.locator(".map-canvas canvas").count()).toBe(1);
  }
  expect(new Set(counts).size).toBe(1);
});
