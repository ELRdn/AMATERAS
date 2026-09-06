import { MapLibreOverlay } from "@deck.gl/maplibre";
import { SolidPolygonLayer, PathLayer } from "@deck.gl/layers";
import type { Map as MLMap, MapSourceDataEvent } from "maplibre-gl";
import type {
  EarthquakeEvent,
  EffectiveQuality,
  FxQuality,
} from "../../data/types";
import { WARNING_COLORS } from "../../data/types";
import {
  triangulateTerrain,
  elevateMesh,
  warningHeight,
  warningEffect,
  circle,
  type WarningArea,
  type FlatMesh,
  type MeshFace,
} from "./geometry";
import { QualityController, QUALITY_LIMITS } from "./quality";
export interface FxInput {
  areas: WarningArea[];
  earthquakes: EarthquakeEvent[];
  selected: string | null;
  terrain: boolean;
  quality: FxQuality;
  reducedMotion: boolean;
}
const rgba = (hex: string): [number, number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
  65,
];
export class FxManager {
  private overlay: MapLibreOverlay;
  private input: FxInput = {
    areas: [],
    earthquakes: [],
    selected: null,
    terrain: false,
    quality: "auto",
    reducedMotion: false,
  };
  private cache = new Map<string, FlatMesh>();
  private faces: MeshFace[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private raf = 0;
  private pulseStart = 0;
  private dead = false;
  private controller = new QualityController(
    matchMedia("(max-width:700px)").matches,
  );
  private quality: EffectiveQuality = this.controller.quality;
  private previousRender = 0;
  private lastSelected: string | null = null;
  private meshLayer: SolidPolygonLayer<MeshFace> | null = null;
  private effects: ReturnType<typeof warningEffect>[] = [];
  private builds = 0;
  private failed = false;
  constructor(
    private map: MLMap,
    private onError: (message: string) => void,
    private onQuality: (q: EffectiveQuality) => void,
  ) {
    this.overlay = new MapLibreOverlay({
      interleaved: true,
      layers: [],
      onError: () => this.fail(),
    });
    map.addControl(this.overlay);
    map.on("moveend", this.schedule);
    map.on("sourcedata", this.sourceChanged);
    map.on("render", this.observe);
    document.addEventListener("visibilitychange", this.visibility);
    this.onQuality(this.quality);
  }
  update(input: FxInput) {
    const changedSelection = input.selected !== this.lastSelected;
    const rebuild =
      input.areas !== this.input.areas ||
      input.terrain !== this.input.terrain ||
      input.quality !== this.input.quality;
    this.input = input;
    this.lastSelected = input.selected;
    const q =
      input.quality === "auto" ? this.controller.quality : input.quality;
    if (q !== this.quality) {
      this.quality = q;
      this.onQuality(q);
    }
    if (changedSelection) {
      this.stopPulse();
      this.pulseStart = performance.now();
      if (this.canPulse()) this.raf = requestAnimationFrame(this.animate);
    } else if (!this.canPulse()) this.stopPulse();
    if (rebuild) this.schedule();
    else this.draw();
  }
  private canPulse() {
    return (
      !this.dead &&
      !document.hidden &&
      this.input.terrain &&
      !this.input.reducedMotion &&
      this.quality !== "low" &&
      this.input.earthquakes.some(
        (e) =>
          e.id === this.input.selected && e.position && e.status === "active",
      )
    );
  }
  private observe = () => {
    const t = performance.now(),
      delta = t - this.previousRender;
    this.previousRender = t;
    if (
      this.input.quality !== "auto" ||
      document.hidden ||
      !(this.map.isMoving() || this.raf)
    )
      return;
    const q = this.controller.observe(delta, t);
    if (q !== this.quality) {
      this.quality = q;
      this.onQuality(q);
      if (!this.canPulse()) this.stopPulse();
      this.schedule();
    }
  };
  private sourceChanged = (e: MapSourceDataEvent) => {
    if (e.sourceId === "terrain" && e.sourceDataType === "content")
      this.schedule();
  };
  private visibility = () => {
    if (document.hidden) this.stopPulse();
    else this.schedule();
  };
  private schedule = () => {
    if (this.dead) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.build();
    }, 150);
  };
  private sample = (p: [number, number]) => {
    const h = this.map.queryTerrainElevation(p);
    return typeof h === "number" && Number.isFinite(h) ? h : null;
  };
  private build() {
    if (this.dead || this.failed) return;
    try {
      this.faces = [];
      this.effects = [];
      const limits = QUALITY_LIMITS[this.quality],
        zoom = this.map.getZoom();
      let remaining = limits.triangles;
      if (this.input.terrain && this.map.getTerrain() && remaining) {
        const sorted = [...this.input.areas].sort(
          (a, b) =>
            Number(b.selected) - Number(a.selected) ||
            b.warning.level - a.warning.level,
        );
        for (const area of sorted.slice(0, limits.areas)) {
          this.effects.push(warningEffect(area, area.fetchedAt));
          const height = warningHeight(area.warning, zoom, this.quality);
          if (!height) continue;
          let index = 0;
          for (const feature of area.features) {
            const polys =
              feature.geometry.type === "Polygon"
                ? [feature.geometry.coordinates]
                : feature.geometry.coordinates;
            for (const rings of polys) {
              const key = area.code + ":" + index++ + ":" + this.quality;
              let mesh = this.cache.get(key);
              if (!mesh) {
                mesh = triangulateTerrain(
                  rings,
                  limits.spacing,
                  Math.min(2000, remaining),
                );
                this.cache.set(key, mesh);
              }
              if (mesh.triangles.length > remaining) continue;
              const color = rgba(
                WARNING_COLORS[area.warning.level] ?? WARNING_COLORS[0],
              );
              if (area.selected) color[3] = 105;
              this.faces.push(
                ...elevateMesh(mesh, this.sample, height, area.code, color),
              );
              remaining -= mesh.triangles.length;
            }
          }
        }
      }
      while (this.cache.size > 180)
        this.cache.delete(this.cache.keys().next().value!);
      this.meshLayer = new SolidPolygonLayer<MeshFace>({
        id: "fx-warning-mesh",
        data: this.faces,
        getPolygon: (f) => f.polygon,
        getFillColor: (f) => f.color,
        positionFormat: "XYZ",
        _full3d: true,
        extruded: false,
        pickable: false,
        ...{ beforeId: "warning-label" },
        parameters: { depthWriteEnabled: false, cullMode: "none" },
      });
      this.builds++;
      this.draw();
      this.diagnostics();
    } catch {
      this.fail();
    }
  }
  private pulse() {
    const e = this.input.earthquakes.find(
      (e) => e.id === this.input.selected && e.status === "active",
    );
    if (!e?.position || !this.canPulse()) return [];
    const z = this.sample(e.position);
    if (z === null) return [];
    const elapsed = performance.now() - this.pulseStart;
    if (elapsed > 4000) return [];
    const radius = Math.min(45, Math.max(1, 900 / 2 ** this.map.getZoom()));
    return [0, 1, 2].map((i) => {
      const phase = (elapsed / 1900 + i / 3) % 1;
      return {
        path: circle(e.position!, radius * (0.15 + phase)).map(
          (p) => [p[0], p[1], z + 25] as [number, number, number],
        ),
        alpha: Math.round(160 * (1 - phase)),
      };
    });
  }
  private draw() {
    if (this.dead || this.failed) return;
    const layers: any[] = [];
    if (this.input.terrain && this.meshLayer) layers.push(this.meshLayer);
    const rings = this.pulse();
    if (rings.length)
      layers.push(
        new PathLayer({
          id: "fx-earthquake-pulse",
          data: rings,
          getPath: (d) => d.path,
          getColor: (d) => [255, 176, 32, d.alpha],
          getWidth: 2,
          widthUnits: "pixels",
          ...{ beforeId: "warning-label" },
          pickable: false,
          parameters: { depthWriteEnabled: false },
        }),
      );
    this.overlay.setProps({ layers });
    this.diagnostics();
  }
  private animate = () => {
    this.raf = 0;
    if (!this.canPulse()) return;
    if (performance.now() - this.pulseStart >= 4000) {
      this.draw();
      return;
    }
    this.draw();
    this.raf = requestAnimationFrame(this.animate);
    this.diagnostics();
  };
  private stopPulse() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.pulseStart = -Infinity;
    if (!this.dead) this.draw();
  }
  private fail() {
    if (this.dead || this.failed) return;
    this.failed = true;
    this.faces = [];
    this.meshLayer = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.pulseStart = -Infinity;
    this.overlay.setProps({ layers: [] });
    this.onError(
      "立体エフェクトを表示できません。地図と区域の表示は継続しています。",
    );
  }
  private diagnostics() {
    if (import.meta.env.DEV)
      this.map.getContainer().dataset.fx = JSON.stringify({
        quality: this.quality,
        faces: this.faces.length,
        effects: this.effects.length,
        meshCache: this.cache.size,
        builds: this.builds,
        animationLoops: this.raf ? 1 : 0,
        pendingBuild: this.timer ? 1 : 0,
        layers:
          (this.input.terrain && this.meshLayer ? 1 : 0) +
          (this.pulse().length ? 1 : 0),
      });
  }
  destroy() {
    if (this.dead) return;
    this.dead = true;
    clearTimeout(this.timer);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.map.off("moveend", this.schedule);
    this.map.off("sourcedata", this.sourceChanged);
    this.map.off("render", this.observe);
    document.removeEventListener("visibilitychange", this.visibility);
    this.map.removeControl(this.overlay);
    this.map.getContainer().removeAttribute("data-fx");
    this.cache.clear();
    this.faces = [];
    this.meshLayer = null;
  }
}
