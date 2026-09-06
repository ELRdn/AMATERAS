import { test, expect } from "@playwright/test";
test("labelled quiet state, search and modal", async ({ page }) => {
  await page.goto("/?scenario=quiet");
  await expect(page.locator(".mock-banner")).toContainText("MOCK DATA");
  await expect(
    page.getByText("現在、発表中の情報はありません", { exact: true }),
  ).toBeAttached();
  await page.getByRole("combobox").fill("富士宮市");
  await page.getByRole("option", { name: "富士宮市 静岡県" }).click();
  await expect(page.getByRole("combobox")).toHaveValue("富士宮市");
  await page.getByRole("button", { name: "表示", exact: true }).click();
  await expect(page.getByRole("heading", { name: "表示設定" })).toBeVisible();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
});
test("severe scenario and mobile panels", async ({
  page,
  isMobile,
}, testInfo) => {
  await page.goto("/?scenario=severe");
  await expect(page.locator(".rail-summary")).toContainText("5");
  if (testInfo.project.name === "mobile") {
    await page.locator(".mobile-warning-toggle").click();
    await expect(page.locator("main")).toHaveClass(/sheet-open/);
    await page.getByRole("button", { name: "警報一覧を閉じる" }).click();
    await page.getByRole("button", { name: "タイムラインを開く" }).click();
    await expect(page.locator("main")).toHaveClass(/timeline-open/);
    await expect(page.locator("main")).not.toHaveClass(/sheet-open/);
  } else {
    await page.getByRole("button", { name: "テーマを切り替える" }).click();
    await expect(page.locator("main")).toHaveClass(/light/);
  }
});
test("failed source is not all clear", async ({ page }) => {
  await page.goto("/?scenario=quiet&fault=warnings");
  await expect(
    page.getByText("警報情報を取得できません", { exact: true }),
  ).toBeAttached();
  await expect(
    page.getByText("現在、発表中の情報はありません", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".ticker")).toContainText("SOURCE ERROR");
});
test("terrain failure returns to 2D and remains recoverable", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("https://cyberjapandata.gsi.go.jp/**", (route) => {
    attempts++;
    return route.abort();
  });
  await page.goto("/?scenario=quiet");
  await expect(page.locator(".timeline-header strong")).toContainText("12:00");
  for (let i = 0; i < 2; i++) {
    const before = attempts;
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await expect.poll(() => attempts).toBeGreaterThan(before);
    await expect(
      page.getByRole("button", { name: "2D", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("地形データを取得できないため、2D表示に戻しました。", {
        exact: true,
      }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "全国表示に戻す", exact: true })
    .click();
  await expect(page.locator(".map-coordinate")).toContainText("/ 0°");
});
