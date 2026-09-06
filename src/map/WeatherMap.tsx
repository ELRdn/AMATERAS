import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import type { FeatureCollection, Feature } from "geojson";
import type { PlaceResult, RadarFrame, WarningEvent } from "../data/types";
import { WARNING_COLORS } from "../data/types";
import { loadStyle } from "./style";
import { installTerrainProtocol } from "./terrain";
import type {
  EarthquakeEvent,
  TyphoonEvent,
  FxQuality,
  EffectiveQuality,
} from "../data/types";
import type { FxManager } from "./fx/FxManager";
import { groupWarnings, type WarningArea } from "./fx/geometry";
import { QUALITY_LIMITS } from "./fx/quality";
import { installEventLayers, setEventData } from "./fx/eventLayers";
import { RadarPlayer } from "./RadarPlayer";
import { installRadarProtocol } from "./radarTiles";
const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
export type MapAction =
  | { kind: "place"; place: PlaceResult; nonce: number }
  | { kind: "event"; bounds: [number, number, number, number]; nonce: number }
  | { kind: "reset" | "zoomIn" | "zoomOut"; nonce: number };
function focusPadding(map: MLMap) {
  const box = map.getContainer().getBoundingClientRect();
  const panel = document
    .querySelector(".app.sheet-open .warning-rail")
    ?.getBoundingClientRect();
  const padding = { top: 35, bottom: 65, left: 30, right: 30 };
  if (
    panel &&
    panel.left < box.right &&
    panel.right > box.left &&
    panel.top < box.bottom
  ) {
    if (panel.width > box.width * 0.7)
      padding.bottom = Math.min(box.height - 130, box.bottom - panel.top + 18);
    else padding.right = Math.min(box.width - 130, box.right - panel.left + 18);
  }
  return padding;
}
function fitRegion(
  map: MLMap,
  bounds: [number, number, number, number],
  pitch: number,
  reduced: boolean,
  maxZoom: number,
) {
  const padding = focusPadding(map);
  const sw = maplibregl.MercatorCoordinate.fromLngLat([bounds[0], bounds[1]]);
  const ne = maplibregl.MercatorCoordinate.fromLngLat([bounds[2], bounds[3]]);
  const box = map.getContainer();
  // cameraForBounds adds stored padding to requested padding. Compute the target
  // viewport once so repeated selections cannot exhaust the mobile map height.
  const width = Math.max(1, box.clientWidth - padding.left - padding.right);
  const height = Math.max(1, box.clientHeight - padding.top - padding.bottom);
  const scale = Math.min(
    width / (512 * Math.max(1e-9, Math.abs(ne.x - sw.x))),
    height / (512 * Math.max(1e-9, Math.abs(ne.y - sw.y))),
  );
  const zoom = Math.max(map.getMinZoom(), Math.min(maxZoom, Math.log2(scale)));
  map.easeTo({
    center: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2],
    zoom,
    bearing: 0,
    pitch,
    padding,
    duration: reduced ? 0 : 700,
  });
}
interface Props {
  panelOpen: boolean;
  earthquakes: EarthquakeEvent[];
  typhoons: TyphoonEvent[];
  eventSelected: string | null;
  quality: FxQuality;
  reducedMotion: boolean;
  onQuality: (q: EffectiveQuality) => void;
  onEventSelect: (kind: "earthquakes" | "typhoons", id: string) => void;
  theme: "dark" | "light";
  terrain: boolean;
  radar: boolean;
  opacity: number;
  frame?: RadarFrame;
  nextFrame?: RadarFrame;
  warnings: WarningEvent[];
  warningFetchedAt: string | null;
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
  const fx = useRef<FxManager | null>(null),
    eventCleanup = useRef<(() => void) | null>(null);
  const [warningAreas, setWarningAreas] = useState<WarningArea[]>([]);
  const areasRef = useRef(warningAreas);
  areasRef.current = warningAreas;
  const effectiveRef = useRef<EffectiveQuality>(
    matchMedia("(max-width:700px)").matches ? "low" : "medium",
  );
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
          pitch: current.current.terrain ? 50 : 0,
          renderWorldCopies: false,
        });
        mapRef.current = map;
        map.on("style.load", () => {
          eventCleanup.current?.();
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
                "line-color": ["get", "edgeColor"],
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
              "symbol-sort-key": ["get", "priority"],
              "text-allow-overlap": false,
            },
            paint: {
              "text-color": ["get", "color"],
              "text-halo-color": "#071425",
              "text-halo-width": 3,
            },
          });
          eventCleanup.current = installEventLayers(map, (kind, id) =>
            current.current.onEventSelect(kind, id),
          );
          player.current?.destroy();
          player.current = new RadarPlayer(map);
          setRevision((r) => r + 1);
        });
        map.once("load", () => {
          setViewRevision((v) => v + 1);
        });
        if (import.meta.env.DEV)
          map.on("idle", () => {
            const selected =
              current.current.earthquakes.find(
                (e) => e.id === current.current.eventSelected,
              )?.position ??
              current.current.typhoons.find(
                (e) => e.id === current.current.eventSelected,
              )?.current?.position;
            if (selected) {
              container.current!.dataset.selection = JSON.stringify({
                point: map.project(selected),
                center: map.getCenter(),
                padding: map.getPadding(),
                selected,
              });
            } else container.current!.removeAttribute("data-selection");
            container.current!.dataset.map = JSON.stringify({
              pitch: map.getPitch(),
              zoom: map.getZoom(),
              sources: Object.keys(map.getStyle().sources).length,
              layers: map.getStyle().layers.length,
              radarSources: Object.keys(map.getStyle().sources).filter((s) =>
                s.startsWith("radar-"),
              ).length,
              terrain: !!map.getTerrain(),
            });
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
      eventCleanup.current?.();
      fx.current?.destroy();
      fx.current = null;
      player.current?.destroy();
      player.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (map && Object.values(map.getPadding()).some(Boolean)) {
      map.easeTo({
        padding: focusPadding(map),
        duration: props.reducedMotion ? 0 : 250,
      });
    }
  }, [props.panelOpen]);
  const lastTheme = useRef(props.theme);
  useEffect(() => {
    if (lastTheme.current === props.theme) return;
    lastTheme.current = props.theme;
    container.current?.removeAttribute("data-map");
    let cancelled = false;
    void loadStyle(props.theme)
      .then((s) => {
        if (!cancelled) {
          player.current?.destroy();
          fx.current?.destroy();
          fx.current = null;
          const map = mapRef.current;
          // Dispose terrain against the old style before its source is replaced.
          if (map?.getTerrain()) map.setTerrain(null);
          map?.setStyle(s);
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
    container.current?.removeAttribute("data-map");
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
      map.easeTo({
        pitch: 50,
        duration: current.current.reducedMotion ? 0 : 600,
      });
    } else {
      map.setTerrain(null);
      if (map.getLayer("terrain-shading")) map.removeLayer("terrain-shading");
      if (map.getSource("terrain")) map.removeSource("terrain");
      map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: current.current.reducedMotion ? 0 : 400,
      });
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
      fitRegion(
        map,
        a.place.bounds,
        props.terrain ? 50 : 0,
        current.current.reducedMotion,
        11,
      );
    else if (a.kind === "event")
      fitRegion(
        map,
        a.bounds,
        props.terrain ? 50 : 0,
        current.current.reducedMotion,
        8,
      );
    else if (a.kind === "reset") {
      map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      map.fitBounds(
        [
          [122, 24],
          [147, 46],
        ],
        {
          padding: { top: 55, bottom: 105, left: 35, right: 35 },
          bearing: 0,
          pitch: props.terrain ? 55 : 0,
          duration: current.current.reducedMotion ? 0 : 700,
        },
      );
    } else if (a.kind === "zoomIn") map.zoomIn();
    else map.zoomOut();
  }, [props.action]);
  useEffect(() => {
    const map = mapRef.current;
    if (!revision || !map?.getSource("warnings")) return;
    let cancelled = false;
    const abort = new AbortController();
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
    const byArea = groupWarnings(visible, props.selected);
    const render = () => {
      if (cancelled || !map.getSource("warnings")) return;
      const features: Feature[] = [],
        labels: Feature[] = [],
        areas: WarningArea[] = [];
      const groups = [...byArea.entries()].sort(
        ([, a], [, b]) =>
          Number(b.selected) - Number(a.selected) ||
          b.warning.level - a.warning.level,
      );
      const limit =
        QUALITY_LIMITS[
          props.quality === "auto" ? effectiveRef.current : props.quality
        ].labels;
      for (const [code, g] of groups) {
        const raw = geometryCache.current.get(code);
        if (!raw) continue;
        const w = g.warning,
          color = WARNING_COLORS[w.level] ?? WARNING_COLORS[0],
          selected = g.selected;
        for (const f of raw)
          features.push({
            ...f,
            properties: {
              edgeColor: w.level === 5 ? "#d7c0ef" : color,
              eventId:
                g.events.find((e) => e.id === props.selected)?.id ?? w.id,
              color,
              selected,
            },
          });
        const point =
          raw[0]?.properties?.labelPoints?.[0] ?? places.get(code)?.center;
        if (point) {
          areas.push({
            code,
            fetchedAt: props.warningFetchedAt ?? "",
            warning: w,
            events: g.events,
            selected,
            features: raw as WarningArea["features"],
            label: point,
          });
          if (
            labels.length < limit &&
            (selected ||
              map.getZoom() >= 7 ||
              (map.getZoom() >= 5.5 && w.level >= 3) ||
              w.level >= 4)
          )
            labels.push({
              type: "Feature",
              geometry: { type: "Point", coordinates: point },
              properties: {
                label:
                  w.shortName +
                  (g.events.length > 1 ? " +" + (g.events.length - 1) : ""),
                color: w.level === 5 ? "#f4dfff" : color,
                priority: selected ? 0 : 6 - w.level,
              },
            });
        }
      }
      (map.getSource("warnings") as GeoJSONSource).setData({
        type: "FeatureCollection",
        features,
      });
      (map.getSource("warning-labels") as GeoJSONSource).setData({
        type: "FeatureCollection",
        features: labels,
      });
      if (import.meta.env.DEV)
        container.current!.dataset.areas = JSON.stringify({
          areas: areas.length,
          labels: labels.length,
          cache: geometryCache.current.size,
        });
      setWarningAreas(areas);
    };
    render();
    const queue = [...byArea.keys()].filter(
      (c) => !geometryCache.current.has(c),
    );
    async function worker() {
      while (queue.length && !cancelled) {
        const code = queue.shift()!;
        try {
          const r = await fetch("/api/areas/" + code, { signal: abort.signal });
          if (!r.ok) throw new Error();
          const data = (await r.json()) as FeatureCollection;
          if (
            data.type !== "FeatureCollection" ||
            !data.features.length ||
            !data.features.every(
              (f) =>
                f.properties?.code === code &&
                ["Polygon", "MultiPolygon"].includes(f.geometry.type),
            )
          )
            throw new Error();
          geometryCache.current.set(code, data.features);
          if (geometryCache.current.size > 500)
            geometryCache.current.delete(
              geometryCache.current.keys().next().value!,
            );
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
      abort.abort();
    };
  }, [
    props.warnings,
    props.places,
    props.selected,
    props.quality,
    revision,
    viewRevision,
  ]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !revision) return;
    setEventData(map, props.earthquakes, props.typhoons, props.eventSelected);
  }, [
    props.earthquakes,
    props.typhoons,
    props.eventSelected,
    revision,
    viewRevision,
  ]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !revision || !props.terrain) {
      fx.current?.destroy();
      fx.current = null;
      return;
    }
    let cancelled = false;
    void import("./fx/FxManager")
      .then(({ FxManager }) => {
        if (cancelled || !map.getSource("warnings")) return;
        fx.current = new FxManager(
          map,
          (s) => current.current.onError(s),
          (q) => {
            effectiveRef.current = q;
            current.current.onQuality(q);
          },
        );
        fx.current.update({
          areas: areasRef.current,
          earthquakes: current.current.earthquakes,
          selected: current.current.eventSelected,
          terrain: current.current.terrain,
          quality: current.current.quality,
          reducedMotion: current.current.reducedMotion,
        });
      })
      .catch(() =>
        current.current.onError(
          "立体エフェクトを読み込めません。地図と区域の表示は継続しています。",
        ),
      );
    return () => {
      cancelled = true;
      fx.current?.destroy();
      fx.current = null;
    };
  }, [revision, props.terrain]);
  useEffect(() => {
    fx.current?.update({
      areas: warningAreas,
      earthquakes: props.earthquakes,
      selected: props.eventSelected,
      terrain: props.terrain,
      quality: props.quality,
      reducedMotion: props.reducedMotion,
    });
  }, [
    warningAreas,
    props.earthquakes,
    props.eventSelected,
    props.terrain,
    props.quality,
    props.reducedMotion,
  ]);
  return (
    <div
      className="map-canvas"
      ref={container}
      aria-label="日本全国の気象地図"
      data-testid="weather-map"
      data-mode={props.terrain ? "3d" : "2d"}
    />
  );
}
