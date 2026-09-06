import type { EarthquakeEvent, TyphoonEvent } from "./types";
const at = new Date().toISOString();
const source = {
  organization: "開発用シナリオ",
  url: "https://www.jma.go.jp/bosai/",
  issuedAt: at,
  observedAt: at,
  fetchedAt: at,
};
export function makeEventFixture(scenario: string): {
  earthquakes: EarthquakeEvent[];
  typhoons: TyphoonEvent[];
} {
  if (scenario === "quiet") return { earthquakes: [], typhoons: [] };
  const earthquakes: EarthquakeEvent[] = [
    {
      id: "MOCK-EQ-1",
      title: "駿河湾（検証用）",
      occurredAt: at,
      position: [138.6, 34.9],
      depthKm: 20,
      magnitude: 4.8,
      maxIntensity: "3",
      status: "active",
      serial: 1,
      source,
    },
  ];
  const current = {
    time: at,
    position: [135, 29] as [number, number],
    kind: "observed" as const,
    pressure: 975,
    wind: 35,
    forecastRadiusKm: null,
  };
  const typhoons: TyphoonEvent[] =
    scenario === "severe"
      ? [
          {
            id: "MOCK-TC-1",
            number: "9901",
            name: "検証用台風",
            category: "台風",
            status: "active",
            serial: 1,
            source,
            current,
            track: [
              {
                ...current,
                time: new Date(Date.now() - 21600000).toISOString(),
                position: [134, 27],
              },
              current,
            ],
            forecast: [
              {
                ...current,
                time: new Date(Date.now() + 43200000).toISOString(),
                position: [136, 31],
                kind: "forecast",
                forecastRadiusKm: 90,
              },
              {
                ...current,
                time: new Date(Date.now() + 86400000).toISOString(),
                position: [138, 34],
                kind: "forecast",
                forecastRadiusKm: 150,
              },
            ],
            windAreas: [
              {
                kind: "gale",
                center: current.position,
                direction: "北東",
                radiusKm: 330,
                oppositeRadiusKm: 220,
              },
              {
                kind: "storm",
                center: current.position,
                direction: "全域",
                radiusKm: 80,
                oppositeRadiusKm: 80,
              },
            ],
            detailState: "LIVE",
          },
        ]
      : [];
  return { earthquakes, typhoons };
}
