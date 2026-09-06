import { describe, it, expect } from "vitest";
import {
  readGraphics,
  GRAPHICS_PRESETS,
  graphicsPreset,
  graphicsPixelRatio,
} from "../src/map/graphics";
describe("saved graphics settings", () => {
  it("starts balanced and migrates a previous manual FX preference", () => {
    expect(readGraphics(null)).toEqual(GRAPHICS_PRESETS.balanced);
    expect(readGraphics(null, "low").fxQuality).toBe("low");
    expect(graphicsPreset(readGraphics(null, "low"))).toBe("custom");
  });
  it("restores custom settings without dropping individual controls", () => {
    const settings = { ...GRAPHICS_PRESETS.performance, hillshade: true };
    expect(readGraphics(JSON.stringify({ version: 1, settings }))).toEqual(
      settings,
    );
    expect(graphicsPreset(settings)).toBe("custom");
  });
  it("rejects broken storage and unsupported future schemas", () => {
    for (const raw of ["not-json", "null", "[]", '{"version":2,"settings":{}}'])
      expect(readGraphics(raw)).toEqual(GRAPHICS_PRESETS.balanced);
  });
  it("bounds corrupted resolution and enums without losing a valid option", () => {
    const settings = readGraphics(
      JSON.stringify({
        version: 1,
        settings: {
          renderScale: 100,
          terrainDetail: "ultra",
          fxQuality: "unknown",
          hillshade: "false",
          animations: false,
          mapDetails: null,
        },
      }),
    );
    expect(settings).toEqual({
      ...GRAPHICS_PRESETS.balanced,
      animations: false,
    });
  });
});
describe("render workload", () => {
  it("renders one quarter as many map pixels at 50 percent on standard and high DPI displays", () => {
    for (const dpr of [0.5, 0.75, 1, 1.25, 2, 3]) {
      const full = graphicsPixelRatio(1, dpr),
        low = graphicsPixelRatio(0.5, dpr);
      expect(low ** 2 / full ** 2).toBeCloseTo(0.25);
    }
  });
  it("caps very high DPI and safely handles unavailable device ratios", () => {
    expect(graphicsPixelRatio(1, 4)).toBe(2);
    expect(graphicsPixelRatio(0.75, NaN)).toBe(0.75);
    expect(graphicsPixelRatio(0.5, 0)).toBe(0.5);
  });
});
