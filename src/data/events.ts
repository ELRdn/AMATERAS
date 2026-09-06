import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import type {
  EarthquakeEvent,
  TyphoonEvent,
  TyphoonPoint,
  TyphoonWindArea,
} from "./types";
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  removeNSPrefix: true,
  processEntities: false,
  trimValues: true,
});
const list = (v: any): any[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const text = (v: any): string =>
  typeof v === "string"
    ? v
    : typeof v === "number"
      ? String(v)
      : typeof v?.["#text"] === "string"
        ? v["#text"]
        : "";
const attr = (v: any, k: string): string =>
  typeof v?.["@_" + k] === "string" ? v["@_" + k] : "";
export function jmaTime(s: string): string | null {
  if (typeof s !== "string") return null;
  let input = s;
  if (/^\d{14}$/.test(s))
    input =
      s.slice(0, 4) +
      "-" +
      s.slice(4, 6) +
      "-" +
      s.slice(6, 8) +
      "T" +
      s.slice(8, 10) +
      ":" +
      s.slice(10, 12) +
      ":" +
      s.slice(12, 14) +
      "+09:00";
  else if (/^\d{4}\/\d{2}\/\d{2} /.test(s))
    input = s.replaceAll("/", "-").replace(" ", "T") + "+09:00";
  if (!/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(input)) return null;
  const t = Date.parse(input);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
const quakeRecord = z.object({
  eid: z.string().min(1),
  rdt: z.string().min(1),
  ctt: z.string().optional(),
  ttl: z.string(),
  ift: z.string(),
  ser: z
    .union([z.number(), z.string().regex(/^\d*$/)])
    .optional()
    .transform((v) => Number(v || 0)),
  at: z.string().optional(),
  anm: z.string().optional(),
  cod: z.string().optional(),
  mag: z.union([z.string(), z.number()]).optional(),
  maxi: z.union([z.string(), z.number()]).optional(),
  json: z.string().optional(),
});
function coordinates(
  value: string,
  minutes = false,
): [number, number, number | null] | null {
  const m =
    /^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)?\/$/.exec(
      value,
    );
  if (!m) return null;
  const degree = (s: string) => {
    const n = Number(s);
    return minutes
      ? Math.sign(n) *
          (Math.floor(Math.abs(n) / 100) + (Math.abs(n) % 100) / 60)
      : n;
  };
  const lat = degree(m[1]),
    lon = degree(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lon, lat, m[3] ? Number(m[3]) : null];
}
function finite(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
export function normalizeEarthquakes(
  raw: unknown,
  now: number,
  fetchedAt: string,
): EarthquakeEvent[] {
  const checked = z.array(quakeRecord).safeParse(raw);
  if (!checked.success) throw new Error("地震情報のデータ形式が変わりました");
  const groups = new Map<string, z.infer<typeof quakeRecord>[]>();
  for (const r of checked.data) {
    if (/緊急地震速報|訓練|試験/.test(r.ttl + " " + r.ift)) continue;
    if (!/震源|震度|遠地地震|地震情報/.test(r.ttl)) continue;
    if (!jmaTime(r.rdt)) throw new Error("地震情報の発表時刻が不正です");
    groups.set(r.eid, [...(groups.get(r.eid) ?? []), r]);
  }
  const result: EarthquakeEvent[] = [];
  for (const [id, reports] of groups) {
    reports.sort(
      (a, b) =>
        Date.parse(jmaTime(b.rdt)!) - Date.parse(jmaTime(a.rdt)!) ||
        b.ser - a.ser ||
        (b.ctt ?? "").localeCompare(a.ctt ?? ""),
    );
    const r = reports[0];
    const occurredAt = reports.map((v) => jmaTime(v.at ?? "")).find(Boolean);
    if (!occurredAt) throw new Error("地震の発生時刻を解釈できません");
    const time = Date.parse(occurredAt);
    if (time > now || now - time > 86400000) continue;
    const c = coordinates(r.cod ?? "");
    const maxi = String(r.maxi ?? "");
    result.push({
      id,
      title: r.anm || r.ttl,
      occurredAt,
      position: c ? [c[0], c[1]] : null,
      depthKm: c?.[2] != null ? -c[2] / 1000 : null,
      magnitude: finite(r.mag),
      maxIntensity: /^(?:[0-7]|[56][+-])$/.test(maxi) ? maxi : null,
      status: r.ift === "取消" ? "cancelled" : "active",
      serial: r.ser,
      source: {
        organization: "気象庁",
        url:
          r.json && /^[\w.-]+\.json$/.test(r.json)
            ? "https://www.jma.go.jp/bosai/quake/data/" + r.json
            : "https://www.jma.go.jp/bosai/quake/",
        issuedAt: jmaTime(r.rdt)!,
        observedAt: occurredAt,
        fetchedAt,
      },
    });
  }
  return result.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
function quantity(nodes: any, unit: string, type?: string): number | null {
  const v = list(nodes).find(
    (n) => attr(n, "unit") === unit && (!type || attr(n, "type") === type),
  );
  if (!v || /なし|不明|不詳/.test(attr(v, "condition"))) return null;
  return finite(text(v));
}
function radius(axis: any): number | null {
  const r =
    quantity(axis?.Radius, "km") ??
    ((v: number | null) => (v === null ? null : v * 1.852))(
      quantity(axis?.Radius, "海里"),
    );
  return r !== null && r >= 0 ? r : null;
}
function position(nodes: any): [number, number] | null {
  const candidates = list(nodes).sort(
    (a, b) =>
      Number(attr(a, "type").includes("度分")) -
      Number(attr(b, "type").includes("度分")),
  );
  for (const n of candidates) {
    const c = coordinates(text(n), attr(n, "type").includes("度分"));
    if (c) return [c[0], c[1]];
  }
  return null;
}
const compass = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
function windAreas(
  prop: any,
  center: [number, number],
): { areas: TyphoonWindArea[]; incomplete: boolean } {
  const areas: TyphoonWindArea[] = [];
  let incomplete = false;
  for (const part of list(
    prop.WarningAreaPart ?? prop.WindPart?.WarningAreaPart,
  )) {
    const kind =
      attr(part, "type") === "強風域"
        ? "gale"
        : attr(part, "type") === "暴風域"
          ? "storm"
          : null;
    if (!kind) continue;
    const axes = list(part.Circle?.Axes?.Axis);
    if (
      axes.every((a) =>
        list(a.Radius).some((n) => attr(n, "condition") === "なし"),
      )
    )
      continue;
    if (!axes.length) {
      incomplete = true;
      continue;
    }
    const direction =
        text(axes[0].Direction) || attr(axes[0].Direction, "condition"),
      r = radius(axes[0]);
    if (r === null) {
      incomplete = true;
      continue;
    }
    if (direction === "全域") {
      areas.push({ kind, center, direction, radiusKm: r, oppositeRadiusKm: r });
      continue;
    }
    const opposite = axes[1],
      r2 = radius(opposite);
    if (
      !compass.includes(direction) ||
      r2 === null ||
      text(opposite?.Direction) !==
        compass[(compass.indexOf(direction) + 4) % 8]
    ) {
      incomplete = true;
      continue;
    }
    areas.push({ kind, center, direction, radiusKm: r, oppositeRadiusKm: r2 });
  }
  return { areas, incomplete };
}
export function parseTyphoonXml(
  xml: string,
  url: string,
  fetchedAt: string,
): TyphoonEvent | null {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error("XML entity/DOCTYPE rejected");
  if (XMLValidator.validate(xml) !== true) throw new Error("台風XML形式不正");
  const report = xmlParser.parse(xml)?.Report,
    head = report?.Head,
    control = report?.Control;
  if (!head || !control?.Status) throw new Error("台風XML形式不正");
  if (text(control.Status) !== "通常") return null;
  const info = text(head.InfoType);
  if (/訓練|試験/.test(info)) return null;
  if (!["発表", "訂正", "取消"].includes(info))
    throw new Error("台風情報の発表区分が不明です");
  const id = text(head.EventID),
    issuedAt = jmaTime(text(head.ReportDateTime)),
    serial = finite(text(head.Serial));
  if (!/^TC\d+$/.test(id) || !issuedAt || serial === null)
    throw new Error("台風XML形式不正");
  const source = {
    organization: text(control.PublishingOffice) || "気象庁",
    url,
    issuedAt,
    observedAt: jmaTime(text(head.TargetDateTime)),
    fetchedAt,
  };
  if (info === "取消")
    return {
      id,
      number: "",
      name: "",
      category: "",
      status: "cancelled",
      serial,
      source,
      current: null,
      track: [],
      forecast: [],
      windAreas: [],
      detailState: "LIVE",
    };
  let name = "",
    number = "",
    category = "",
    incomplete = false;
  const track: TyphoonPoint[] = [],
    forecast: TyphoonPoint[] = [];
  let areas: TyphoonWindArea[] = [];
  for (const group of list(report.Body?.MeteorologicalInfos))
    for (const info of list(group.MeteorologicalInfo)) {
      const type = attr(info.DateTime, "type"),
        time = jmaTime(text(info.DateTime));
      if (!time || !(type === "実況" || type.startsWith("予報"))) continue;
      const props = list(info.Item).flatMap((item) =>
        list(item.Kind).flatMap((k) => list(k.Property)),
      );
      const prop = (name: string) => props.find((p) => text(p.Type) === name);
      const cp = prop("中心")?.CenterPart,
        wp = prop("風");
      const pos = position(cp?.Coordinate ?? cp?.ProbabilityCircle?.BasePoint);
      if (!pos) {
        incomplete = true;
        continue;
      }
      const np = prop("呼称")?.TyphoonNamePart;
      if (type === "実況") {
        name = text(np?.NameKana) || text(np?.Name) || name;
        number = text(np?.Number) || number;
        category = text(prop("階級")?.ClassPart?.TyphoonClass) || category;
      }
      const forecastAxis = list(cp?.ProbabilityCircle?.Axes?.Axis)[0];
      const point: TyphoonPoint = {
        time,
        position: pos,
        kind: type === "実況" ? "observed" : "forecast",
        pressure: quantity(cp?.Pressure, "hPa", "中心気圧"),
        wind:
          quantity(wp?.WindPart?.WindSpeed, "m/s", "最大風速") ??
          ((v: number | null) => (v === null ? null : v * 0.514444))(
            quantity(wp?.WindPart?.WindSpeed, "ノット", "最大風速"),
          ),
        forecastRadiusKm: radius(forecastAxis),
      };
      if (type === "実況") {
        track.push(point);
        if (wp) {
          const w = windAreas(wp, pos);
          areas = w.areas;
          incomplete ||= w.incomplete;
        }
      } else {
        forecast.push(point);
        if (point.forecastRadiusKm === null) incomplete = true;
      }
    }
  if (!track.length) throw new Error("台風XMLに実況位置がありません");
  track.sort((a, b) => a.time.localeCompare(b.time));
  forecast.sort((a, b) => a.time.localeCompare(b.time));
  return {
    id,
    number,
    name,
    category,
    status: "active",
    serial,
    source,
    current: track.at(-1)!,
    track,
    forecast,
    windAreas: areas,
    detailState: incomplete ? "PARTIAL" : "LIVE",
    ...(incomplete ? { detailError: "一部の予報・風域を解釈できません" } : {}),
  };
}
