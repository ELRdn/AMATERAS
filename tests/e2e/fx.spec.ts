import { test, expect } from "@playwright/test";
import { fixtureMap, openSheet } from "./fixtures";
test.beforeEach(async ({ page }) => fixtureMap(page));
test("starts in 3D on every device and remembers a manual 2D choice", async ({
  page,
}) => {
  await page.goto("/?scenario=quiet");
  await expect(page.locator(".map-canvas")).toHaveAttribute("data-mode", "3d");
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-map",
    /"terrain":true/,
  );
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator(".map-canvas")).toHaveAttribute("data-mode", "2d");
  await page.reload();
  await expect(page.locator(".map-canvas")).toHaveAttribute("data-mode", "2d");
});
test("event tabs, map selection and historical radar semantics", async ({
  page,
}) => {
  await page.goto("/?scenario=severe");
  await openSheet(page);
  await page.getByRole("tab", { name: "地震", exact: true }).click();
  await page.locator(".event-select").first().click();
  await expect(page.locator(".event-detail")).toContainText("地震波の到達範囲");
  await expect(page.locator(".map-coordinate")).toContainText("°N");
  await page.getByRole("tab", { name: "台風", exact: true }).click();
  await page.locator(".event-select").first().click();
  await expect(page.locator(".event-detail")).toContainText(
    "実況経路の取得範囲",
  );
  await expect(page.locator(".forecast-list li")).toHaveCount(2);
  // The projected centre must remain above the open sheet on a pitched mobile map.
  if (page.viewportSize()!.width <= 700) {
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const canvas = document.querySelector<HTMLElement>(".map-canvas")!;
          const state = JSON.parse(canvas.dataset.selection ?? "{}");
          if (!state.point || state.selected?.[0] !== 135) return false;
          const map = canvas.getBoundingClientRect();
          const sheet = document
            .querySelector(".warning-rail")!
            .getBoundingClientRect();
          const x = map.left + state.point.x;
          const y = map.top + state.point.y;
          return (
            x > 15 &&
            x < innerWidth - 15 &&
            y > map.top + 15 &&
            y < sheet.top - 8
          );
        }),
      )
      .toBe(true);
  }
  await expect(page.locator(".fx-status")).toContainText("最新取得");
  await page.getByRole("tab", { name: "気象警報", exact: true }).click();
  await expect(page.locator(".rail-summary")).toContainText("5");
});
test("partial earthquake source failure does not turn into a zero count", async ({
  page,
}) => {
  await page.goto("/?scenario=quiet&fault=earthquakes");
  await openSheet(page);
  await page.getByRole("tab", { name: "地震", exact: true }).click();
  await expect(page.locator(".event-panel")).toContainText(
    "情報を取得できません",
  );
  await expect(page.locator(".event-panel")).not.toContainText(
    "直近24時間の地震情報はありません",
  );
});
test("quality, reduced motion and selected meshes survive theme changes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?scenario=severe");
  await page.getByRole("button", { name: "表示", exact: true }).click();
  await page.getByLabel("立体表現の品質").selectOption("high");
  await expect(
    page.getByText("動きを減らす設定：有効（演出は静止表示）"),
  ).toBeVisible();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await openSheet(page);
  await page.locator(".warning-row").first().click();
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await page.locator(".map-canvas").getAttribute("data-fx")) || "{}",
        ).faces ?? 0,
    )
    .toBeGreaterThan(0);
  if (await page.getByRole("button", { name: "警報一覧を閉じる" }).isVisible())
    await page.getByRole("button", { name: "警報一覧を閉じる" }).click();
  await page.getByRole("button", { name: "テーマを切り替える" }).click();
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await page.locator(".map-canvas").getAttribute("data-fx")) || "{}",
        ).faces ?? 0,
    )
    .toBeGreaterThan(0);
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-fx",
    /"animationLoops":0/,
  );
});
test("20 style and terrain cycles keep one map and bounded radar/FX layers", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Lifecycle stress runs once on desktop.",
  );
  test.setTimeout(180000);
  await page.addInitScript(() => {
    const registry = new WeakMap<
      EventTarget,
      Map<string, Set<EventListenerOrEventListenerObject>>
    >();
    (window as any).__canvasListeners = registry;
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (
      type,
      listener,
      options,
    ) {
      if (this instanceof HTMLCanvasElement && listener) {
        let byType = registry.get(this);
        if (!byType) registry.set(this, (byType = new Map()));
        const key =
          type +
          ":" +
          (typeof options === "boolean" ? options : !!options?.capture);
        if (!byType.has(key)) byType.set(key, new Set());
        byType.get(key)!.add(listener);
      }
      return add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (
      type,
      listener,
      options,
    ) {
      const key =
        type +
        ":" +
        (typeof options === "boolean" ? options : !!options?.capture);
      if (listener) registry.get(this)?.get(key)?.delete(listener);
      return remove.call(this, type, listener, options);
    };
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?scenario=severe");
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-map",
    /"terrain":true/,
  );
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-fx",
    /"layers":1/,
  );
  const listenerCount = () =>
    page.evaluate(() =>
      [
        ...((window as any).__canvasListeners
          .get(document.querySelector(".map-canvas canvas"))
          ?.values() ?? []),
      ].reduce((sum: number, group: any) => sum + group.size, 0),
    );
  const initialListeners = await listenerCount();
  const counts: number[] = [];
  for (let i = 0; i < 20; i++) {
    await page.getByRole("button", { name: "テーマを切り替える" }).click();
    await expect(page.locator(".map-canvas")).toHaveAttribute(
      "data-map",
      /"terrain":true/,
    );
    await page.getByRole("button", { name: "3D", exact: true }).click();
    await expect(page.locator(".map-canvas")).toHaveAttribute(
      "data-mode",
      "2d",
    );
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await expect(page.locator(".map-canvas")).toHaveAttribute(
      "data-map",
      /"terrain":true/,
    );
    const d = JSON.parse(
      (await page.locator(".map-canvas").getAttribute("data-map"))!,
    );
    counts.push(d.layers);
    expect(d.radarSources).toBeLessThanOrEqual(3);
    expect(await page.locator(".map-canvas canvas").count()).toBe(1);
  }
  expect(await listenerCount()).toBe(initialListeners);
  expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(3);
});

test("1000 warning entries stay aggregated into bounded FX and labels", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Density test runs once.");
  await page.goto("/?scenario=severe&density=1000");
  await expect(page.locator(".rail-summary strong")).toContainText("1000");
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await page.locator(".map-canvas").getAttribute("data-fx")) || "{}",
        ).faces ?? 0,
    )
    .toBeGreaterThan(0);
  const a = JSON.parse(
    (await page.locator(".map-canvas").getAttribute("data-areas"))!,
  );
  const f = JSON.parse(
    (await page.locator(".map-canvas").getAttribute("data-fx"))!,
  );
  expect(a.labels).toBeLessThanOrEqual(18);
  expect(f.effects).toBeLessThanOrEqual(48);
  expect(a.areas).toBeLessThanOrEqual(200);
  expect(await page.locator(".warning-row").count()).toBe(80);
});
