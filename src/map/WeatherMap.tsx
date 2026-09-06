import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import type { FeatureCollection, Feature } from "geojson";
import type { PlaceResult, RadarFrame, WarningEvent } from "../data/types";
import { WARNING_COLORS } from "../data/types";
import { loadStyle } from "./style";
import { installTerrainProtocol } from "./terrain";
import { RadarPlayer } from "./RadarPlayer";
import { installRadarProtocol } from "./radarTiles";
const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
export type MapAction =
  | { kind: "place"; place: PlaceResult; nonce: number }
  | { kind: "reset" | "zoomIn" | "zoomOut"; nonce: number };
interface Props {
  theme: "dark" | "light";
  terrain: boolean;
  radar: boolean;
  opacity: number;
  frame?: RadarFrame;
  nextFrame?: RadarFrame;
  warnings: WarningEvent[];
  places: PlaceResult[];
  selected: string | null;
  action: MapAction | null;
  onSelect: (id: string) => void;
  onReadyFrame: (f: RadarFrame) => void;
  onError: (s: string) => void;
  onTerrainError: () => void;
  onCamera: (s: string) => void;
}
export function WeatherMap(props: Props) {
  const container = useRef<HTMLDivElement>(null),
    mapRef = useRef<MLMap | null>(null),
    player = useRef<RadarPlayer | null>(null),
    current = useRef(props);
  current.current = props;
  const [revision, setRevision] = useState(0);
  const geometryCache = useRef(new Map<string, Feature[]>());
  const [viewRevision, setViewRevision] = useState(0);
  useEffect(() => {
    let dead = false;
    installTerrainProtocol();
    installRadarProtocol();
    void (async () => {
      if (import.meta.env.DEV) {
        const { installMockRadar } = await import("./mockRadar");
        installMockRadar();
      }
      return loadStyle(current.current.theme);
    })()
      .then((style) => {
        if (dead) return;
        const map = new maplibregl.Map({
          container: container.current!,
          style,
          bounds: [
            [122, 24],
            [147, 46],
          ],
          fitBoundsOptions: {
            padding: { top: 35, bottom: 85, left: 20, right: 20 },
          },
          minZoom: 3,
          maxZoom: 15,
          attributionControl: {
            compact: true,
            customAttribution:
              '<a href="https://www.jma.go.jp/">気象庁</a> · <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
          },
          maxPitch: 65,
          renderWorldCopies: false,
        });
        mapRef.current = map;
        map.on("style.load", () => {
          if (!map.getSource("warnings"))
            map.addSource("warnings", { type: "geojson", data: empty });
          const before = map
            .getStyle()
            .layers.find((l) => l.type === "symbol")?.id;
          map.addLayer(
            {
              id: "warning-fill",
              type: "fill",
              source: "warnings",
              paint: {
                "fill-color": ["get", "color"],
                "fill-opacity": ["case", ["get", "selected"], 0.26, 0.085],
              },
            },
            before,
          );
          map.addLayer(
            {
              id: "warning-line",
              type: "line",
              source: "warnings",
              paint: {
                "line-color": ["get", "color"],
                "line-width": ["case", ["get", "selected"], 2.5, 0.8],
                "line-opacity": 0.85,
              },
            },
            before,
          );
          map.addSource("warning-labels", { type: "geojson", data: empty });
          map.addLayer({
            id: "warning-label",
            type: "symbol",
            source: "warning-labels",
            layout: {
              "text-field": ["get", "label"],
              "text-font": ["Noto Sans Regular"],
              "text-size": 11,
              "text-padding": 12,
              "text-allow-overlap": false,
            },
            paint: {
              "text-color": ["get", "color"],
              "text-halo-color": "#071425",
              "text-halo-width": 3,
            },
          });
          player.current?.destroy();
          player.current = new RadarPlayer(map);
          setRevision((r) => r + 1);
        });
        map.once("load", () => {
          setViewRevision((v) => v + 1);
        });
        map.on("moveend", () => {
          setViewRevision((v) => v + 1);
          const c = map.getCenter();
          current.current.onCamera(
            `${c.lat.toFixed(2)}°N  ${c.lng.toFixed(2)}°E  /  Z${map.getZoom().toFixed(1)}  /  ${map.getPitch().toFixed(0)}°`,
          );
        });
        map.on("click", "warning-fill", (e) => {
          const id = e.features?.[0]?.properties?.eventId;
          if (id) current.current.onSelect(String(id));
        });
        map.on("mouseenter", "warning-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "warning-fill", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("error", (e: any) => {
          if (e.sourceId === "terrain" && current.current.terrain) {
            map.setTerrain(null);
            current.current.onTerrainError();
          } else if (e.sourceId?.startsWith("radar-")) {
            current.current.onError(
              "雨雲画像の一部を取得できません。表示時刻とデータ状態をご確認ください。",
            );
          } else if (
            e.sourceId &&
            !String(e.sourceId).startsWith("radar-") &&
            e.sourceId !== "terrain"
          )
            current.current.onError(
              "地図の一部を取得できません。接続を確認して再読み込みしてください。",
            );
        });
      })
      .catch(() =>
        props.onError(
          "背景地図を読み込めません。ページを再読み込みしてください。",
        ),
      );
    return () => {
      dead = true;
      player.current?.destroy();
      player.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);
  const lastTheme = useRef(props.theme);
  useEffect(() => {
    if (lastTheme.current === props.theme) return;
    lastTheme.current = props.theme;
    let cancelled = false;
    void loadStyle(props.theme)
      .then((s) => {
        if (!cancelled) {
          player.current?.destroy();
          mapRef.current?.setStyle(s);
        }
      })
      .catch(() => props.onError("テーマを読み込めません"));
    return () => {
      cancelled = true;
    };
  }, [props.theme]);
  useEffect(() => {
    const map = mapRef.current;
    if (!revision || !map?.getSource("warnings")) return;
    if (props.terrain) {
      if (!map.getSource("terrain"))
        map.addSource("terrain", {
          type: "raster-dem",
          tiles: ["gsi-dem://{z}/{x}/{y}"],
          tileSize: 256,
          maxzoom: 14,
          encoding: "mapbox",
          bounds: [122, 20, 154, 46],
        });
      if (!map.getLayer("terrain-shading"))
        map.addLayer(
          {
            id: "terrain-shading",
            type: "hillshade",
            source: "terrain",
            paint: {
              "hillshade-shadow-color": "#020c18",
              "hillshade-highlight-color": "#8badba",
              "hillshade-accent-color": "#2c5264",
              "hillshade-exaggeration": 0.45,
            },
          },
          map
            .getStyle()
            .layers.find(
              (l) => l.id.startsWith("radar-") || l.id === "warning-fill",
            )?.id,
        );
      map.setLayoutProperty("terrain-shading", "visibility", "visible");
      map.setTerrain({ source: "terrain", exaggeration: 1.25 });
      map.easeTo({ pitch: 55, duration: 600 });
    } else {
      map.setTerrain(null);
      if (map.getLayer("terrain-shading")) map.removeLayer("terrain-shading");
      if (map.getSource("terrain")) map.removeSource("terrain");
      map.easeTo({ pitch: 0, bearing: 0, duration: 400 });
    }
  }, [props.terrain, revision]);
  useEffect(() => {
    if (!revision || !props.frame) return;
    player.current?.show(
      props.frame,
      props.nextFrame,
      () => current.current.onReadyFrame(props.frame!),
      (s) => current.current.onError(s),
    );
  }, [props.frame?.id, revision]);
  useEffect(() => {
    if (revision) player.current?.settings(props.radar, props.opacity);
  }, [props.radar, props.opacity, revision]);
  useEffect(() => {
    const map = mapRef.current,
      a = props.action;
    if (!map || !a) return;
    if (a.kind === "place")
      map.fitBounds(
        [
          [a.place.bounds[0], a.place.bounds[1]],
          [a.place.bounds[2], a.place.bounds[3]],
        ],
        {
          padding: 80,
          maxZoom: 11,
          duration: 700,
          pitch: props.terrain ? 55 : 0,
        },
      );
    else if (a.kind === "reset")
      map.fitBounds(
        [
          [122, 24],
          [147, 46],
        ],
        {
          padding: { top: 55, bottom: 105, left: 35, right: 35 },
          bearing: 0,
          pitch: props.terrain ? 55 : 0,
          duration: 700,
        },
      );
    else if (a.kind === "zoomIn") map.zoomIn();
    else map.zoomOut();
  }, [props.action]);
  useEffect(() => {
    const map = mapRef.current;
    if (!revision || !map?.getSource("warnings")) return;
    let cancelled = false;
    const places = new Map(props.places.map((p) => [p.code, p]));
    const bounds = map.getBounds();
    const visible = props.warnings.filter((w) => {
      const p = places.get(w.areaCode);
      return (
        p &&
        (map.getZoom() >= 6 || w.level >= 3 || w.id === props.selected) &&
        bounds.intersects([
          [p.bounds[0], p.bounds[1]],
          [p.bounds[2], p.bounds[3]],
        ])
      );
    });
    const byArea = new Map<string, WarningEvent>();
    for (const w of visible) {
      const old = byArea.get(w.areaCode);
      if (
        !old ||
        w.id === props.selected ||
        (old.id !== props.selected && old.level < w.level)
      )
        byArea.set(w.areaCode, w);
    }
    const render = () => {
      if (cancelled || !map.getSource("warnings")) return;
      const features: Feature[] = [],
        labels: Feature[] = [];
      for (const [code, w] of byArea) {
        const raw = geometryCache.current.get(code);
        if (!raw) continue;
        const color = WARNING_COLORS[w.level] ?? WARNING_COLORS[0],
          selected = w.id === props.selected;
        for (const f of raw)
          features.push({
            ...f,
            properties: { eventId: w.id, color, selected },
          });
        const point =
          raw[0]?.properties?.labelPoints?.[0] ?? places.get(code)?.center;
        if (point && (map.getZoom() > 5.2 || w.level >= 3 || selected))
          labels.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: point },
            properties: {
              label: w.shortName,
              color: w.level === 5 ? "#f4dfff" : color,
            },
          });
      }
      (map.getSource("warnings") as GeoJSONSource).setData({
        type: "FeatureCollection",
        features,
      });
      (map.getSource("warning-labels") as GeoJSONSource)?.setData({
        type: "FeatureCollection",
        features: labels,
      });
    };
    render();
    const queue = [...byArea.keys()].filter(
      (c) => !geometryCache.current.has(c),
    );
    async function worker() {
      while (queue.length && !cancelled) {
        const code = queue.shift()!;
        try {
          const r = await fetch("/api/areas/" + code);
          if (!r.ok) throw new Error();
          const data = (await r.json()) as FeatureCollection;
          if (
            data.type !== "FeatureCollection" ||
            !data.features.every((f) => f.properties?.code === code)
          )
            throw new Error();
          geometryCache.current.set(code, data.features);
          render();
        } catch {
          if (!cancelled)
            current.current.onError(
              "一部の警報区域を描画できません。警報一覧をご確認ください。",
            );
        }
      }
    }
    void Promise.all(Array.from({ length: 4 }, worker));
    return () => {
      cancelled = true;
    };
  }, [props.warnings, props.places, props.selected, revision, viewRevision]);
  return (
    <div
      className="map-canvas"
      ref={container}
      aria-label="日本全国の気象地図"
      data-testid="weather-map"
    />
  );
}
