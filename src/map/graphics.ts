import type { FxQuality } from "../data/types";
export type GraphicsPreset = "performance" | "balanced" | "quality" | "custom";
export type TerrainDetail = "low" | "medium" | "high";
export interface GraphicsSettings {
  renderScale: 0.5 | 0.75 | 1;
  terrainDetail: TerrainDetail;
  hillshade: boolean;
  fxQuality: FxQuality;
  animations: boolean;
  mapDetails: boolean;
}
export interface RenderStats {
  width: number;
  height: number;
  pixelRatio: number;
}
export const GRAPHICS_KEY = "amateras.graphics.v1";
export const GRAPHICS_PRESETS: Record<
  Exclude<GraphicsPreset, "custom">,
  GraphicsSettings
> = {
  performance: {
    renderScale: 0.5,
    terrainDetail: "low",
    hillshade: false,
    fxQuality: "low",
    animations: false,
    mapDetails: false,
  },
  balanced: {
    renderScale: 0.75,
    terrainDetail: "medium",
    hillshade: true,
    fxQuality: "auto",
    animations: true,
    mapDetails: true,
  },
  quality: {
    renderScale: 1,
    terrainDetail: "high",
    hillshade: true,
    fxQuality: "high",
    animations: true,
    mapDetails: true,
  },
};
export const TERRAIN_MAX_ZOOM: Record<TerrainDetail, number> = {
  low: 10,
  medium: 12,
  high: 14,
};
const qualities = ["auto", "low", "medium", "high"];
export function readGraphics(
  raw: string | null,
  legacyQuality: string | null = null,
): GraphicsSettings {
  const fallback = { ...GRAPHICS_PRESETS.balanced };
  if (qualities.includes(legacyQuality ?? ""))
    fallback.fxQuality = legacyQuality as FxQuality;
  if (!raw) return fallback;
  try {
    const p = JSON.parse(raw);
    if (!p || p.version !== 1) return fallback;
    const v = p.settings;
    if (!v || typeof v !== "object") return fallback;
    return {
      renderScale: [0.5, 0.75, 1].includes(v.renderScale)
        ? v.renderScale
        : fallback.renderScale,
      terrainDetail: ["low", "medium", "high"].includes(v.terrainDetail)
        ? v.terrainDetail
        : fallback.terrainDetail,
      fxQuality: qualities.includes(v.fxQuality)
        ? v.fxQuality
        : fallback.fxQuality,
      hillshade:
        typeof v.hillshade === "boolean" ? v.hillshade : fallback.hillshade,
      animations:
        typeof v.animations === "boolean" ? v.animations : fallback.animations,
      mapDetails:
        typeof v.mapDetails === "boolean" ? v.mapDetails : fallback.mapDetails,
    };
  } catch {
    return fallback;
  }
}
export function graphicsPreset(settings: GraphicsSettings): GraphicsPreset {
  for (const [name, preset] of Object.entries(GRAPHICS_PRESETS)) {
    if (
      (Object.keys(preset) as (keyof GraphicsSettings)[]).every(
        (k) => settings[k] === preset[k],
      )
    )
      return name as GraphicsPreset;
  }
  return "custom";
}
export function graphicsPixelRatio(scale: number, deviceRatio: number) {
  const ratio =
    Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  return Math.max(0.25, Math.min(2, ratio)) * scale;
}
