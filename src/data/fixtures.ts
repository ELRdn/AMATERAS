import type { WarningEvent, RadarFrame } from "./types";
export function makeRadarFixture(scenario = "rainy"): RadarFrame[] {
  return Array.from({ length: 37 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 6, 0, i * 5)),
      id = d
        .toISOString()
        .replace(/[-:TZ.]/g, "")
        .slice(0, 14);
    return {
      id,
      timestamp: d.toISOString(),
      basetime: id,
      validtime: id,
      type: "observation",
      tiles: `mock-radar://${scenario === "quiet" ? -1 : i}/{z}/{x}/{y}`,
    };
  });
}
export function makeFixture(scenario: string): WarningEvent[] {
  if (scenario === "quiet") return [];
  const rows =
    scenario === "rainy"
      ? [
          ["1310100", "10", "rain", 2, "レベル2 大雨注意報"],
          ["1410011", "14", "thunder", 2, "雷注意報"],
        ]
      : [
          ["1310100", "43", "rain", 4, "レベル4 大雨危険警報"],
          ["1320100", "49", "landslide", 4, "レベル4 土砂災害危険警報"],
          ["1410011", "03", "rain", 3, "レベル3 大雨警報"],
          ["1220400", "14", "thunder", 2, "雷注意報"],
          ["1120100", "10", "rain", 2, "レベル2 大雨注意報"],
        ];
  return rows.map(([areaCode, code, category, level, name]) => ({
    id: `${areaCode}:${code}`,
    areaCode: String(areaCode),
    code: String(code),
    category: String(category),
    level: Number(level),
    name: String(name),
    shortName:
      category === "rain"
        ? "大雨"
        : category === "landslide"
          ? "土砂災害"
          : "雷",
    status: "発表",
    reportTime: new Date().toISOString(),
    controlTime: new Date().toISOString(),
    source: "開発用シナリオ",
    sourceUrl: "https://www.jma.go.jp/bosai/warning/",
    summary: "画面検証用の模擬情報です。実際の警報ではありません。",
    dataTypeCode: "MOCK",
  }));
}
