import { z } from "zod";
import codes from "./warning-codes.json";
import type { RadarFrame, WarningEvent, HealthState } from "./types";
const stamp = z.string().regex(/^\d{14}$/);
export function jmaTime(s: string) {
  const value = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
  if (!Number.isFinite(Date.parse(value)))
    throw new Error("Invalid radar timestamp");
  return value;
}
export function normalizeRadar(raw: unknown): RadarFrame[] {
  const values = z
    .array(
      z.object({
        basetime: stamp,
        validtime: stamp,
        elements: z.array(z.string()),
      }),
    )
    .min(1)
    .parse(raw);
  const frames = new Map<string, RadarFrame>();
  for (const v of values) {
    if (v.basetime !== v.validtime || !v.elements.includes("hrpns")) continue;
    frames.set(v.validtime, {
      id: v.validtime,
      timestamp: jmaTime(v.validtime),
      basetime: v.basetime,
      validtime: v.validtime,
      type: "observation",
      tiles: `/api/radar/tiles/${v.basetime}/${v.validtime}/{z}/{x}/{y}.png`,
    });
  }
  const sorted = [...frames.values()].sort((a, b) => a.id.localeCompare(b.id));
  if (!sorted.length) throw new Error("No observation frames");
  const end = Date.parse(sorted.at(-1)!.timestamp);
  return sorted.filter(
    (f) => end - Date.parse(f.timestamp) <= 3 * 60 * 60 * 1000,
  );
}
const record = z.object({
  controlDatetime: z.iso.datetime({ offset: true }),
  reportDatetime: z.iso.datetime({ offset: true }),
  infoType: z.string(),
  publishingOffice: z.string(),
  headlineText: z.string().optional(),
  dataTypeCode: z.string(),
  warning: z.object({
    class20Items: z.array(
      z.object({
        areaCode: z.string().regex(/^\d{7}$/),
        kinds: z.array(
          z.object({ code: z.string().optional(), status: z.string() }),
        ),
      }),
    ),
  }),
});
const dictionary = codes as Record<
  string,
  { category: string; level: number; name: string; shortName: string }
>;
export function normalizeWarnings(raw: unknown): WarningEvent[] {
  const records = z.array(record).min(1).parse(raw);
  // Each data type is a separate full snapshot for an area. "No warnings" only clears that type.
  const groups = new Map<string, { time: string; events: WarningEvent[] }>();
  for (const r of records) {
    if (r.infoType === "試験" || r.infoType === "訓練") continue;
    for (const area of r.warning.class20Items) {
      const groupKey = `${area.areaCode}:${r.dataTypeCode}`;
      const old = groups.get(groupKey);
      if (old && Date.parse(old.time) > Date.parse(r.controlDatetime)) continue;
      const events: WarningEvent[] = [];
      if (r.infoType !== "取消")
        for (const k of area.kinds) {
          if (!k.code || ["解除", "発表警報・注意報はなし"].includes(k.status))
            continue;
          const def = dictionary[k.code] ?? {
            name: `未分類の気象情報 (${k.code})`,
            shortName: "未分類",
            category: "unknown",
            level: 0,
          };
          events.push({
            id: `${area.areaCode}:${k.code}`,
            code: k.code,
            areaCode: area.areaCode,
            ...def,
            status: k.status,
            reportTime: r.reportDatetime,
            controlTime: r.controlDatetime,
            source: r.publishingOffice,
            sourceUrl: "https://www.jma.go.jp/bosai/warning/",
            summary: r.headlineText ?? "",
            dataTypeCode: r.dataTypeCode,
          });
        }
      groups.set(groupKey, { time: r.controlDatetime, events });
    }
  }
  const events = new Map<string, WarningEvent>();
  for (const g of groups.values())
    for (const e of g.events) {
      const old = events.get(e.id);
      if (!old || Date.parse(old.controlTime) <= Date.parse(e.controlTime))
        events.set(e.id, e);
    }
  return [...events.values()].sort(
    (a, b) =>
      b.level - a.level ||
      b.reportTime.localeCompare(a.reportTime) ||
      a.areaCode.localeCompare(b.areaCode),
  );
}
export function freshness(
  id: string,
  sourceTime: string | null,
  fetchedAt: string | null,
  now = Date.now(),
): HealthState {
  if (!fetchedAt) return "SOURCE ERROR";
  const fetchAge = now - Date.parse(fetchedAt);
  if (fetchAge > 15 * 60e3) return "STALE";
  if (fetchAge > 3 * 60e3) return "DELAYED";
  if (id === "radar" && sourceTime) {
    const age = now - Date.parse(sourceTime);
    if (age > 30 * 60e3 || age < -5 * 60e3) return "STALE";
    if (age > 15 * 60e3) return "DELAYED";
  }
  return "LIVE";
}
