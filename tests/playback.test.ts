import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { RadarPlayer } from "../src/map/RadarPlayer";
import type { RadarFrame } from "../src/data/types";
class FakeMap {
  sources: Record<string, unknown> = {};
  layers: Record<string, unknown> = {};
  loaded = new Set<string>();
  paint: Record<string, number> = {};
  listeners = new Map<string, Set<Function>>();
  on(type: string, fn: Function) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  off(type: string, fn: Function) {
    this.listeners.get(type)?.delete(fn);
  }
  emit(type: string, event: unknown) {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn(event);
  }
  addSource(id: string, s: unknown) {
    this.sources[id] = s;
  }
  getSource(id: string) {
    return this.sources[id];
  }
  removeSource(id: string) {
    delete this.sources[id];
    this.loaded.delete(id);
  }
  addLayer(layer: any) {
    this.layers[layer.id] = layer;
    this.paint[layer.id] = 0;
  }
  getLayer(id: string) {
    return this.layers[id];
  }
  removeLayer(id: string) {
    delete this.layers[id];
    delete this.paint[id];
  }
  getStyle() {
    return { sources: this.sources, layers: Object.values(this.layers) };
  }
  setPaintProperty(id: string, _key: string, v: number) {
    this.paint[id] = v;
  }
  isSourceLoaded(id: string) {
    return this.loaded.has(id);
  }
  ready(id: string) {
    this.loaded.add("radar-" + id);
    this.emit("sourcedata", { sourceId: "radar-" + id, isSourceLoaded: true });
  }
}
const frame = (id: string): RadarFrame => ({
  id,
  timestamp: "2026-09-06T01:00:00Z",
  basetime: id,
  validtime: id,
  type: "observation",
  tiles: "/api/radar/" + id + "/{z}/{x}/{y}.png",
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("location", { origin: "https://amateras.test" });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("switches displayed time only after the requested frame is loaded", () => {
  const m = new FakeMap(),
    p = new RadarPlayer(m as any),
    done = vi.fn();
  p.show(frame("1"), undefined, done, vi.fn());
  expect(done).not.toHaveBeenCalled();
  m.ready("1");
  expect(done).toHaveBeenCalledTimes(1);
  expect(m.paint["radar-1"]).toBe(0.72);
  p.destroy();
});
it("holds the visible frame when the next tile fails", () => {
  const m = new FakeMap(),
    p = new RadarPlayer(m as any),
    failed = vi.fn();
  p.show(frame("1"), undefined, vi.fn(), failed);
  m.ready("1");
  p.show(frame("2"), undefined, vi.fn(), failed);
  m.emit("error", { sourceId: "radar-2" });
  expect(failed).toHaveBeenCalled();
  expect(m.paint["radar-1"]).toBe(0.72);
  expect(m.paint["radar-2"]).toBe(0);
  p.destroy();
});
it("ignores a late response after the user scrubbed elsewhere", () => {
  const m = new FakeMap(),
    p = new RadarPlayer(m as any),
    old = vi.fn(),
    newer = vi.fn();
  p.show(frame("1"), undefined, old, vi.fn());
  p.show(frame("2"), undefined, newer, vi.fn());
  m.ready("1");
  expect(old).not.toHaveBeenCalled();
  m.ready("2");
  expect(newer).toHaveBeenCalled();
  p.destroy();
});
it("keeps a bounded number of layers after many playback loops", () => {
  const m = new FakeMap(),
    p = new RadarPlayer(m as any);
  for (let i = 0; i < 100; i++) {
    p.show(frame(String(i)), frame(String(i + 1)), vi.fn(), vi.fn());
    m.ready(String(i));
    expect(Object.keys(m.sources).length).toBeLessThanOrEqual(3);
  }
  p.destroy();
  expect([...m.listeners.values()].reduce((n, x) => n + x.size, 0)).toBe(0);
});
it("reports stalled frames and cleans up the timeout", () => {
  const m = new FakeMap(),
    p = new RadarPlayer(m as any),
    failed = vi.fn();
  p.show(frame("1"), undefined, vi.fn(), failed);
  vi.advanceTimersByTime(20001);
  expect(failed).toHaveBeenCalledOnce();
  p.destroy();
  expect(vi.getTimerCount()).toBe(0);
});
it("does not accept an errored preload as a loaded frame", () => {
  const m = new FakeMap(),
    p = new RadarPlayer(m as any),
    done = vi.fn();
  p.show(frame("1"), frame("2"), vi.fn(), vi.fn());
  m.ready("1");
  m.loaded.add("radar-2");
  m.emit("error", { sourceId: "radar-2" });
  p.show(frame("2"), undefined, done, vi.fn());
  expect(done).not.toHaveBeenCalled();
  m.ready("2");
  expect(done).toHaveBeenCalledOnce();
  p.destroy();
});
it("preserves radar visibility settings while advancing", () => {
  const m = new FakeMap(),
    p = new RadarPlayer(m as any);
  p.settings(false, 0.4);
  p.show(frame("1"), undefined, vi.fn(), vi.fn());
  m.ready("1");
  expect(m.paint["radar-1"]).toBe(0);
  p.settings(true, 0.4);
  expect(m.paint["radar-1"]).toBe(0.4);
  p.destroy();
});
