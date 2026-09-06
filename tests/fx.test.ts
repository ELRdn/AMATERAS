import { describe, it, expect } from "vitest";
import {
  groupWarnings,
  warningHeight,
  warningMeaning,
  triangulateTerrain,
  elevateMesh,
  circle,
  windRing,
} from "../src/map/fx/geometry";
import { QualityController } from "../src/map/fx/quality";
import { makeFixture } from "../src/data/fixtures";
const polygon = [
  [
    [138, 35],
    [138.1, 35],
    [138.1, 35.1],
    [138, 35.1],
    [138, 35],
  ],
];
describe("warning surfaces", () => {
  it("keeps strongest classification when a lower warning is selected", () => {
    const w = makeFixture("severe")[0],
      low = { ...w, id: w.areaCode + ":low", level: 2, code: "10" };
    const g = groupWarnings([w, low, low], low.id).get(w.areaCode)!;
    expect(g.warning.level).toBe(4);
    expect(g.selected).toBe(true);
    expect(g.events).toHaveLength(2);
  });
  it("aggregates 1000 warnings by area without one object per warning", () => {
    const w = makeFixture("severe")[0];
    const list = Array.from({ length: 1200 }, (_, i) => ({
      ...w,
      areaCode: String(i % 120),
      id: String(i),
    }));
    expect(groupWarnings(list, null).size).toBe(120);
  });
  it("does not infer risk levels for unknown codes or category warnings", () => {
    const w = makeFixture("severe")[0];
    expect(warningHeight({ ...w, level: 0 }, 7, "high")).toBe(0);
    expect(warningHeight(w, 7, "low")).toBe(0);
    expect(warningMeaning({ ...w, name: "暴風警報" })).toContain(
      "独自の警戒レベルではありません",
    );
  });
  it("triangulates holes without filling the excluded area", () => {
    const mesh = triangulateTerrain(
      [
        [
          [0, 0],
          [3, 0],
          [3, 3],
          [0, 3],
        ],
        [
          [1, 1],
          [1, 2],
          [2, 2],
          [2, 1],
        ],
      ],
      1e9,
    );
    const area = mesh.triangles.reduce(
      (sum, [a, b, c]) =>
        sum +
        Math.abs(
          (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
        ) /
          2,
      0,
    );
    expect(area).toBeCloseTo(8);
  });
  it("samples terrain separately at vertices including negative altitude", () => {
    const m = triangulateTerrain(polygon, 2500, 400);
    const result = elevateMesh(
      m,
      (p) => (p[0] - 138) * 2000 - 50,
      100,
      "test",
      [200, 50, 20, 70],
    );
    const roof = result.filter((f) => !f.wall);
    expect(roof.length).toBeGreaterThan(2);
    const zs = roof.flatMap((f) => f.polygon.map((p) => p[2]));
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(200);
    expect(Math.min(...zs)).toBeCloseTo(53);
    expect(result.some((f) => f.wall)).toBe(true);
  });
  it("keeps the flat surface when elevation is missing", () => {
    expect(
      elevateMesh(
        triangulateTerrain(polygon, 2000),
        () => null,
        300,
        "test",
        [1, 2, 3, 4],
      ),
    ).toEqual([]);
  });
  it("bounds tessellation and preserves a reusable flat topology", () => {
    const m = triangulateTerrain(polygon, 1, 128);
    expect(m.triangles.length).toBeLessThanOrEqual(128);
    expect(m.boundaries[0][0]).toEqual([138, 35]);
    expect(m.triangles.length).toBeGreaterThan(2);
  });
});
describe("geographic event geometry", () => {
  it("closes circles and preserves approximate geodesic radius", () => {
    const a = circle([135, 30], 100);
    expect(a[0]).toEqual(a.at(-1));
    expect(a).toHaveLength(73);
    expect(a[0][1] - 30).toBeCloseTo(100 / 111.195, 2);
  });
  it("uses asymmetric official radii and rejects an unsupported direction", () => {
    const w = {
      kind: "gale" as const,
      center: [135, 30] as [number, number],
      direction: "北",
      radiusKm: 300,
      oppositeRadiusKm: 100,
    };
    const p = windRing(w)!;
    expect(Math.max(...p.map((x) => x[1])) - 30).toBeCloseTo(300 / 111.195, 2);
    expect(30 - Math.min(...p.map((x) => x[1]))).toBeCloseTo(100 / 111.195, 2);
    expect(windRing({ ...w, direction: "不明" })).toBeNull();
  });
});
it("Auto lowers quality only after sustained slow frames and never oscillates", () => {
  const q = new QualityController(false);
  for (let i = 0; i < 20; i++) q.observe(50, 20000 + i);
  expect(q.quality).toBe("medium");
  for (let i = 0; i < 50; i++) q.observe(50, 21000 + i);
  expect(q.quality).toBe("low");
  for (let i = 0; i < 100; i++) q.observe(16, 40000 + i);
  expect(q.quality).toBe("low");
  expect(new QualityController(true).quality).toBe("low");
});
