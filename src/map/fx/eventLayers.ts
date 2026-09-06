import type { GeoEffect, EventSource } from "../../data/types";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import type { EarthquakeEvent, TyphoonEvent } from "../../data/types";
import { circle, windRing } from "./geometry";
const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
export function installEventLayers(
  map: MLMap,
  onSelect: (kind: "earthquakes" | "typhoons", id: string) => void,
) {
  map.addSource("events", { type: "geojson", data: empty });
  const layer = (
    id: string,
    type: "fill" | "line" | "circle" | "symbol",
    filter: any,
    extra: any,
  ) =>
    map.addLayer(
      { id, type, source: "events", filter, ...extra } as any,
      "warning-label",
    );
  layer("event-areas", "fill", ["==", ["get", "shape"], "area"], {
    paint: { "fill-color": ["get", "color"], "fill-opacity": 0.045 },
  });
  layer(
    "event-lines",
    "line",
    ["in", ["get", "shape"], ["literal", ["track", "area"]]],
    {
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1.3,
        "line-opacity": 0.85,
      },
    },
  );
  layer("event-forecast", "line", ["==", ["get", "shape"], "forecast"], {
    paint: {
      "line-color": "#8aaab8",
      "line-width": 1.5,
      "line-dasharray": [3, 3],
      "line-opacity": 0.8,
    },
  });
  layer("event-points", "circle", ["==", ["get", "shape"], "point"], {
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": ["case", ["get", "selected"], 7, 4],
      "circle-stroke-color": "#061425",
      "circle-stroke-width": 2,
      "circle-pitch-alignment": "map",
    },
  });
  layer("event-labels", "symbol", ["==", ["get", "shape"], "point"], {
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
      "text-offset": [0, 1.6],
      "text-padding": 10,
      "text-optional": true,
      "symbol-sort-key": ["case", ["get", "selected"], 0, 1],
    },
    paint: {
      "text-color": ["get", "color"],
      "text-halo-color": "#071425",
      "text-halo-width": 2,
    },
  });
  const click = (e: any) => {
    const p = e.features?.[0]?.properties;
    if (p?.id) onSelect(p.kind, p.id);
  };
  map.on("click", "event-points", click);
  return () => map.off("click", "event-points", click);
}
export function setEventData(
  map: MLMap,
  quakes: EarthquakeEvent[],
  typhoons: TyphoonEvent[],
  selected: string | null,
) {
  const features: Feature[] = [];
  let source: EventSource;
  const add = (geometry: Geometry, properties: Record<string, unknown>) => {
    const quake = properties.kind === "earthquakes";
    const forecast = properties.shape === "forecast";
    const effect: GeoEffect = {
      id: String(properties.id),
      kind: quake
        ? "epicenter"
        : properties.shape === "area"
          ? "typhoon-area"
          : "typhoon-track",
      mode: source.organization.includes("開発用") ? "training" : "live",
      source,
      geometry,
      visible: true,
      dataSemantics: forecast ? "official-forecast" : "official-observation",
      heightSemantics: "terrain",
      meaning: quake
        ? "公式の震央。パルスは発生情報の強調であり、地震波の到達範囲ではありません。"
        : forecast
          ? "公式の予報中心・予報円。台風の大きさではありません。"
          : "公式の実況位置・風域",
    };
    features.push({
      type: "Feature",
      geometry,
      properties: { ...properties, effect },
    });
  };
  for (const e of quakes)
    if (e.position && e.status === "active") {
      source = e.source;
      const chosen = e.id === selected;
      add(
        { type: "Point", coordinates: e.position },
        {
          id: e.id,
          kind: "earthquakes",
          shape: "point",
          selected: chosen,
          color: "#ffb020",
          label:
            chosen || map.getZoom() >= 6
              ? "震度" + (e.maxIntensity ?? "不明") + " / " + e.title
              : "",
        },
      );
    }
  for (const e of typhoons)
    if (e.status === "active" && e.current) {
      source = e.source;
      const chosen = e.id === selected;
      add(
        { type: "Point", coordinates: e.current.position },
        {
          id: e.id,
          kind: "typhoons",
          shape: "point",
          selected: chosen,
          color: "#00d9ff",
          label: "台風" + e.number.slice(-2) + "号",
        },
      );
      if (e.track.length > 1)
        add(
          { type: "LineString", coordinates: e.track.map((p) => p.position) },
          { id: e.id, shape: "track", color: "#00d9ff" },
        );
      if (e.forecast.length)
        add(
          {
            type: "LineString",
            coordinates: [
              e.current.position,
              ...e.forecast.map((p) => p.position),
            ],
          },
          { id: e.id, shape: "forecast" },
        );
      for (const w of e.windAreas) {
        const ring = windRing(w);
        if (ring)
          add(
            { type: "Polygon", coordinates: [ring] },
            {
              id: e.id,
              shape: "area",
              color: w.kind === "storm" ? "#ef3340" : "#f5df28",
            },
          );
      }
      // Only the selected storm expands all forecast circles; the latest forecast is visible at overview.
      for (const p of chosen ? e.forecast : e.forecast.slice(-1))
        if (p.forecastRadiusKm !== null && p.forecastRadiusKm > 0)
          add(
            {
              type: "Polygon",
              coordinates: [circle(p.position, p.forecastRadiusKm)],
            },
            { id: e.id, shape: "forecast" },
          );
    }
  (map.getSource("events") as GeoJSONSource)?.setData({
    type: "FeatureCollection",
    features,
  });
}
