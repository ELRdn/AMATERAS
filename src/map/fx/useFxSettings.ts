import { useEffect, useState } from "react";
import type { FxQuality, EffectiveQuality } from "../../data/types";
import {
  GRAPHICS_KEY,
  GRAPHICS_PRESETS,
  readGraphics,
  type GraphicsSettings,
} from "../graphics";
export function initialTerrain() {
  try {
    return localStorage.getItem("amateras.terrain") !== "false";
  } catch {
    return true;
  }
}
export function storeTerrain(v: boolean) {
  try {
    localStorage.setItem("amateras.terrain", String(v));
  } catch {
    /* optional preference */
  }
}
export function useFxSettings() {
  const [graphics, setGraphics] = useState<GraphicsSettings>(() => {
    try {
      return readGraphics(
        localStorage.getItem(GRAPHICS_KEY),
        localStorage.getItem("amateras.fxQuality"),
      );
    } catch {
      return { ...GRAPHICS_PRESETS.balanced };
    }
  });
  const quality = graphics.fxQuality;
  const setQuality = (q: FxQuality) =>
    setGraphics((g) => ({ ...g, fxQuality: q }));
  const [effective, setEffective] = useState<EffectiveQuality>(() =>
    matchMedia("(max-width:700px)").matches ? "low" : "medium",
  );
  const [osReducedMotion, setOsReducedMotion] = useState(
    () => matchMedia("(prefers-reduced-motion:reduce)").matches,
  );
  useEffect(() => {
    try {
      localStorage.setItem(
        GRAPHICS_KEY,
        JSON.stringify({ version: 1, settings: graphics }),
      );
      localStorage.setItem("amateras.fxQuality", quality);
    } catch {
      /* Storage can be disabled without blocking the map. */
    }
  }, [graphics, quality]);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion:reduce)");
    const f = () => setOsReducedMotion(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return {
    graphics,
    setGraphics,
    quality,
    setQuality,
    effective,
    setEffective,
    osReducedMotion,
    reducedMotion: osReducedMotion || !graphics.animations,
  };
}
