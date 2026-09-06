import { describe, it, expect } from "vitest";
import {
  normalizeRadar,
  normalizeWarnings,
  freshness,
} from "../src/data/normalize";
import { decodeGsi, encodeTerrain } from "../src/map/terrain";
const record = (
  code = "10",
  status = "発表",
  time = "2026-09-06T01:00:00Z",
  type = "VPWW55",
) => ({
  controlDatetime: time,
  reportDatetime: time,
  infoType: "発表",
  publishingOffice: "気象庁",
  headlineText: "公式概要",
  dataTypeCode: type,
  warning: {
    class20Items: [{ areaCode: "1310100", kinds: [{ code, status }] }],
  },
});
describe("current JMA warning snapshots", () => {
  it("uses the 2026 codes and names", () => {
    const w = normalizeWarnings([record("49")]);
    expect(w[0]).toMatchObject({
      level: 4,
      category: "landslide",
      name: "レベル4 土砂災害危険警報",
    });
  });
  it("deduplicates area × code", () =>
    expect(normalizeWarnings([record(), record()])).toHaveLength(1));
  it("applies cancellations even when records arrive out of order", () =>
    expect(
      normalizeWarnings([
        record("10", "解除", "2026-09-06T02:00:00Z"),
        record(),
      ]),
    ).toEqual([]));
  it("replaces a warning with the downgraded advisory", () =>
    expect(
      normalizeWarnings([
        record("03"),
        record("10", "警報から注意報", "2026-09-06T02:00:00Z"),
      ]).map((w) => w.code),
    ).toEqual(["10"]));
  it("clears only the relevant data type", () =>
    expect(
      normalizeWarnings([
        record("10", "解除"),
        record("14", "継続", undefined, "VPWW59"),
      ]).map((w) => w.code),
    ).toEqual(["14"]));
  it("keeps unmapped area codes and unknown warning codes visible", () => {
    const raw = record("99");
    raw.warning.class20Items[0].areaCode = "9999999";
    expect(normalizeWarnings([raw])[0]).toMatchObject({
      areaCode: "9999999",
      category: "unknown",
      level: 0,
    });
  });
  it("does not expire active warnings solely by report age", () =>
    expect(
      normalizeWarnings([record("10", "継続", "2020-01-01T00:00:00Z")]),
    ).toHaveLength(1));
  it("rejects malformed or empty upstream payloads instead of saying zero", () => {
    expect(() => normalizeWarnings([])).toThrow();
    expect(() => normalizeWarnings([{ warning: {} }])).toThrow();
  });
  it("a valid all-clear is empty", () =>
    expect(normalizeWarnings([record("10", "発表警報・注意報はなし")])).toEqual(
      [],
    ));
  it("does not show training data", () => {
    const raw = { ...record(), infoType: "訓練" };
    expect(normalizeWarnings([raw])).toEqual([]);
  });
  it("revokes a cancelled bulletin", () => {
    const raw = { ...record(), infoType: "取消" };
    expect(normalizeWarnings([raw])).toEqual([]);
  });
});
describe("radar and health", () => {
  const frame = (v: string, base = v) => ({
    basetime: base,
    validtime: v,
    elements: ["hrpns"],
  });
  it("sorts, deduplicates and excludes forecasts", () =>
    expect(
      normalizeRadar([
        frame("20260906010000"),
        frame("20260906000000"),
        frame("20260906010000"),
        frame("20260906020000", "20260906010000"),
      ]).map((x) => x.id),
    ).toEqual(["20260906000000", "20260906010000"]));
  it("restricts the history to three hours and preserves gaps", () =>
    expect(
      normalizeRadar([
        frame("20260906010000"),
        frame("20260906010500"),
        frame("20260906050000"),
      ]),
    ).toHaveLength(1));
  it("rejects unusable frames", () =>
    expect(() => normalizeRadar([{ basetime: "bad" }])).toThrow());
  it("never calls old radar live", () => {
    const now = Date.parse("2026-09-06T01:00:00Z");
    expect(
      freshness("radar", "2026-09-06T00:00:00Z", "2026-09-06T01:00:00Z", now),
    ).toBe("STALE");
  });
  it("ages the fetch for warnings, not the report", () => {
    expect(
      freshness(
        "warnings",
        "2020-01-01T00:00:00Z",
        "2026-09-06T01:00:00Z",
        Date.parse("2026-09-06T01:01:00Z"),
      ),
    ).toBe("LIVE");
    expect(
      freshness(
        "warnings",
        null,
        "2026-09-06T01:00:00Z",
        Date.parse("2026-09-06T01:20:00Z"),
      ),
    ).toBe("STALE");
  });
  it("distinguishes delayed data and total unavailability", () => {
    expect(freshness("radar", null, null)).toBe("SOURCE ERROR");
    expect(
      freshness(
        "warnings",
        null,
        "2026-09-06T01:00:00Z",
        Date.parse("2026-09-06T01:05:00Z"),
      ),
    ).toBe("DELAYED");
  });
});
describe("GSI signed DEM conversion", () => {
  it("decodes positive and negative heights and nodata", () => {
    expect(decodeGsi(0, 3, 232)).toBe(10);
    expect(decodeGsi(255, 252, 24)).toBe(-10);
    expect(decodeGsi(128, 0, 0)).toBeNull();
  });
  it("encodes mapbox elevation within 0.05m", () => {
    for (const h of [-430.5, 0, 10.3, 3776.1]) {
      const [r, g, b] = encodeTerrain(h);
      expect((r * 65536 + g * 256 + b) * 0.1 - 10000).toBeCloseTo(h, 1);
    }
  });
  it("uses sea level for missing data rather than a spike", () =>
    expect(encodeTerrain(null)).toEqual(encodeTerrain(0)));
});
