export type HealthState = "LIVE" | "DELAYED" | "STALE" | "SOURCE ERROR";
export interface SourceHealth {
  id: string;
  label: string;
  state: HealthState;
  fetchedAt: string | null;
  sourceTime: string | null;
  error?: string;
}
export interface Envelope<T> {
  data: T;
  health: SourceHealth;
}
export interface RadarFrame {
  id: string;
  timestamp: string;
  basetime: string;
  validtime: string;
  type: "observation";
  tiles: string;
}
export interface WarningEvent {
  id: string;
  code: string;
  areaCode: string;
  name: string;
  shortName: string;
  category: string;
  level: number;
  status: string;
  reportTime: string;
  controlTime: string;
  source: string;
  sourceUrl: string;
  summary: string;
  dataTypeCode: string;
}
export interface PlaceResult {
  code: string;
  name: string;
  kana: string;
  prefecture: string;
  officeCode: string;
  bounds: [number, number, number, number];
  center: [number, number];
}
export const WARNING_COLORS: Record<number, string> = {
  0: "#94a3b8",
  2: "#f5df28",
  3: "#ef3340",
  4: "#aa48d6",
  5: "#271a35",
};
export const timeJst = (v: string | null, seconds = false) =>
  v
    ? new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        ...(seconds ? { second: "2-digit" as const } : {}),
      }).format(new Date(v))
    : "—";
export const dateJst = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(v))
    : "—";
