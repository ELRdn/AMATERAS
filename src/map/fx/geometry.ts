import earcut from "earcut";
import type { Feature, Polygon, MultiPolygon, Position } from "geojson";
import type {
  WarningEvent,
  EffectiveQuality,
  TyphoonWindArea,
  GeoEffect,
} from "../../data/types";

export interface WarningArea {
  fetchedAt: string;
  code: string;
  warning: WarningEvent;
  events: WarningEvent[];
  selected: boolean;
  features: Feature<Polygon | MultiPolygon>[];
  label: Position;
}
export function groupWarnings(
  warnings: WarningEvent[],
  selected: string | null,
) {
  const groups = new Map<
    string,
    { warning: WarningEvent; events: WarningEvent[]; selected: boolean }
  >();
  for (const w of warnings) {
    const g = groups.get(w.areaCode);
    if (!g)
      groups.set(w.areaCode, {
        warning: w,
        events: [w],
        selected: w.id === selected,
      });
    else {
      if (!g.events.some((e) => e.id === w.id)) g.events.push(w);
      g.selected ||= w.id === selected;
      if (
        w.level > g.warning.level ||
        (w.level === g.warning.level && w.code < g.warning.code)
      )
        g.warning = w;
    }
  }
  return groups;
}
export function warningMeaning(w: WarningEvent) {
  const official = /^レベル[2-5]/.test(w.name);
  return w.level === 0
    ? "未分類：高さを付けません"
    : official
      ? "高さ＝公式警戒レベルの視覚的な強調"
      : "高さ＝警報・注意報の分類の強調（独自の警戒レベルではありません）";
}
export function warningHeight(
  w: WarningEvent,
  zoom: number,
  quality: EffectiveQuality,
) {
  if (quality === "low" || !w.level) return 0;
  const base: Record<number, number> = { 2: 100, 3: 350, 4: 700, 5: 1100 };
  return (
    (base[w.level] ?? 0) *
    Math.max(0.4, Math.min(1.4, 2 ** ((7 - zoom) * 0.38)))
  );
}
export function warningEffect(area: WarningArea, fetchedAt: string): GeoEffect {
  const w = area.warning;
  return {
    id: area.code,
    kind: "warning",
    mode: w.dataTypeCode === "MOCK" ? "training" : "live",
    source: {
      organization: w.source,
      url: w.sourceUrl,
      issuedAt: w.reportTime,
      observedAt: null,
      fetchedAt,
    },
    dataSemantics: "official-warning",
    heightSemantics: "data-value",
    meaning: warningMeaning(w),
    geometry: area.features[0].geometry,
    visible: true,
  };
}
type XY = [number, number];
type XYZ = [number, number, number];
export interface MeshFace {
  polygon: XYZ[];
  area: string;
  color: [number, number, number, number];
  wall: boolean;
}
export interface FlatMesh {
  triangles: XY[][];
  boundaries: XY[][];
}
const distance = (a: Position, b: Position) =>
  Math.hypot(
    (a[0] - b[0]) * 111320 * Math.cos(((a[1] + b[1]) * Math.PI) / 360),
    (a[1] - b[1]) * 111320,
  );
const mid = (a: XY, b: XY): XY => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export function triangulateTerrain(
  rings: Position[][],
  spacing: number,
  budget = 2500,
): FlatMesh {
  const coords: number[] = [],
    holes: number[] = [];
  const cleaned = rings
    .map((r) =>
      r.slice(
        0,
        r.length > 1 && r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1]
          ? -1
          : undefined,
      ),
    )
    .filter((r) => r.length >= 3);
  if (!cleaned.length) return { triangles: [], boundaries: [] };
  for (let i = 0; i < cleaned.length; i++) {
    if (i) holes.push(coords.length / 2);
    for (const p of cleaned[i]) coords.push(p[0], p[1]);
  }
  const indices = earcut(coords, holes, 2);
  let triangles: XY[][] = [];
  for (let i = 0; i < indices.length; i += 3)
    triangles.push(
      indices
        .slice(i, i + 3)
        .map((n) => [coords[n * 2], coords[n * 2 + 1]] as XY),
    );
  if (triangles.length > budget) return { triangles: [], boundaries: [] }; // flat official surface remains
  let longest = triangles.reduce(
    (v, t) => Math.max(v, ...t.map((p, i) => distance(p, t[(i + 1) % 3]))),
    0,
  );
  let depth = 0;
  // Uniform subdivisions preserve shared edges. Earcut retains holes and multi-polygon separation.
  while (longest > spacing && triangles.length * 4 <= budget && depth < 5) {
    triangles = triangles.flatMap(([a, b, c]) => {
      const ab = mid(a, b),
        bc = mid(b, c),
        ca = mid(c, a);
      return [
        [a, ab, ca],
        [ab, b, bc],
        [ca, bc, c],
        [ab, bc, ca],
      ];
    });
    longest /= 2;
    depth++;
  }
  const boundaries = cleaned.map((r) =>
    r.flatMap((p, i) => {
      const q = r[(i + 1) % r.length];
      return Array.from(
        { length: 2 ** depth },
        (_, j) =>
          [
            p[0] + ((q[0] - p[0]) * j) / 2 ** depth,
            p[1] + ((q[1] - p[1]) * j) / 2 ** depth,
          ] as XY,
      );
    }),
  );
  return { triangles, boundaries };
}
export function elevateMesh(
  mesh: FlatMesh,
  sample: (p: XY) => number | null,
  height: number,
  area: string,
  color: [number, number, number, number],
): MeshFace[] {
  if (!height) return [];
  const cache = new Map<string, number | null>();
  const z = (p: XY) => {
    const k = p.join(",");
    if (!cache.has(k)) cache.set(k, sample(p));
    return cache.get(k)!;
  };
  // Never invent elevation when a tile is not yet loaded. The next terrain update retries this area.
  const all = [...mesh.triangles.flat(), ...mesh.boundaries.flat()];
  if (all.some((p) => z(p) === null)) return [];
  const pos = (p: XY, h: number): XYZ => [p[0], p[1], z(p)! + h + 3];
  const result: MeshFace[] = mesh.triangles.map((t) => ({
    polygon: t.map((p) => pos(p, height)),
    area,
    color,
    wall: false,
  }));
  for (const ring of mesh.boundaries)
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      result.push({
        polygon: [pos(a, 0), pos(b, 0), pos(b, height), pos(a, height)],
        area,
        color: [color[0], color[1], color[2], Math.min(110, color[3] + 25)],
        wall: true,
      });
    }
  return result;
}
export function destination(p: Position, km: number, bearing: number): XY {
  const d = km / 6371,
    a = (p[1] * Math.PI) / 180,
    b = (p[0] * Math.PI) / 180,
    t = (bearing * Math.PI) / 180;
  const lat = Math.asin(
    Math.sin(a) * Math.cos(d) + Math.cos(a) * Math.sin(d) * Math.cos(t),
  );
  const lon =
    b +
    Math.atan2(
      Math.sin(t) * Math.sin(d) * Math.cos(a),
      Math.cos(d) - Math.sin(a) * Math.sin(lat),
    );
  return [(((lon * 180) / Math.PI + 540) % 360) - 180, (lat * 180) / Math.PI];
}
export function circle(
  center: Position,
  radiusKm: number,
  segments = 72,
): XY[] {
  const a = Array.from({ length: segments }, (_, i) =>
    destination(center, radiusKm, (i * 360) / segments),
  );
  return [...a, a[0]];
}
export const DIRECTIONS: Record<string, number> = {
  北: 0,
  北東: 45,
  東: 90,
  南東: 135,
  南: 180,
  南西: 225,
  西: 270,
  北西: 315,
};
export function windRing(w: TyphoonWindArea) {
  if (w.direction !== "全域" && !(w.direction in DIRECTIONS)) return null;
  const shift = (w.radiusKm - w.oppositeRadiusKm) / 2;
  const center =
    w.direction === "全域"
      ? w.center
      : destination(w.center, shift, DIRECTIONS[w.direction]);
  return circle(center, (w.radiusKm + w.oppositeRadiusKm) / 2);
}
