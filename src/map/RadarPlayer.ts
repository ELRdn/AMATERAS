import type { Map as MapLibreMap, MapSourceDataEvent } from "maplibre-gl";
import type { RadarFrame } from "../data/types";
// At most the displayed frame and two adjacent/requested frames stay attached.
export class RadarPlayer {
  private current = "";
  private requested = "";
  private visible = true;
  private opacity = 0.72;
  private cancel: (() => void) | undefined;
  private failed = new Set<string>();
  private handleError = (event: { sourceId?: string }) => {
    if (event.sourceId?.startsWith("radar-")) this.failed.add(event.sourceId);
  };
  constructor(private map: MapLibreMap) {
    map.on("error", this.handleError);
  }
  private id(frame: RadarFrame) {
    return "radar-" + frame.id;
  }
  private add(frame: RadarFrame) {
    const id = this.id(frame);
    if (this.failed.has(id) && this.current !== id) {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
      if (this.map.getSource(id)) this.map.removeSource(id);
      this.failed.delete(id);
    }
    if (this.map.getSource(id)) return id;
    this.map.addSource(id, {
      type: "raster",
      tiles: [
        new URL(
          frame.tiles.startsWith("/api/")
            ? `jma-radar://${frame.basetime}/${frame.validtime}/{z}/{x}/{y}`
            : frame.tiles,
          location.origin,
        ).href
          .replaceAll("%7B", "{")
          .replaceAll("%7D", "}"),
      ],
      tileSize: 256,
      minzoom: 4,
      maxzoom: 10,
      bounds: [118, 20, 154, 48],
    });
    const before = this.map
      .getStyle()
      .layers.find((l) => l.id === "warning-fill" || l.type === "symbol")?.id;
    this.map.addLayer(
      {
        id,
        type: "raster",
        source: id,
        paint: { "raster-opacity": 0, "raster-fade-duration": 0 },
      },
      before,
    );
    return id;
  }
  show(
    frame: RadarFrame,
    next: RadarFrame | undefined,
    done: () => void,
    fail: (s: string) => void,
  ) {
    this.cancel?.();
    const id = this.add(frame);
    this.requested = id;
    let settled = false;
    const cleanup = () => {
      this.map.off("sourcedata", onData);
      this.map.off("error", onError);
      clearTimeout(timer);
    };
    const finish = () => {
      if (settled || this.requested !== id) return;
      settled = true;
      cleanup();
      this.current = id;
      this.trim(new Set([id, next ? this.id(next) : id]));
      this.update();
      done();
      if (next) this.add(next);
    };
    const onData = (e: MapSourceDataEvent) => {
      if (e.sourceId === id && e.isSourceLoaded) finish();
    };
    const onError = (e: any) => {
      if (e.sourceId === id) {
        settled = true;
        cleanup();
        fail("雨雲画像の一部を取得できません。最終表示を保持しています。");
      }
    };
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        fail("雨雲画像の読み込みに時間がかかっています。");
      }
    }, 20_000);
    this.map.on("sourcedata", onData);
    this.map.on("error", onError);
    this.cancel = () => {
      settled = true;
      cleanup();
    };
    this.trim(new Set([this.current, id, next ? this.id(next) : id]));
    if (this.map.isSourceLoaded(id)) finish();
  }
  private trim(keep: Set<string>) {
    for (const id of Object.keys(this.map.getStyle().sources)) {
      if (id.startsWith("radar-") && !keep.has(id)) {
        if (this.map.getLayer(id)) this.map.removeLayer(id);
        this.map.removeSource(id);
        this.failed.delete(id);
      }
    }
  }
  private update() {
    for (const id of Object.keys(this.map.getStyle().sources))
      if (id.startsWith("radar-") && this.map.getLayer(id))
        this.map.setPaintProperty(
          id,
          "raster-opacity",
          this.visible && id === this.current ? this.opacity : 0,
        );
  }
  settings(visible: boolean, opacity: number) {
    this.visible = visible;
    this.opacity = opacity;
    this.update();
  }
  destroy() {
    this.cancel?.();
    this.map.off("error", this.handleError);
  }
}
