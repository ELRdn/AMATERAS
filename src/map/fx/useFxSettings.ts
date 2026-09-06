import { useEffect, useState } from "react";
import type { FxQuality, EffectiveQuality } from "../../data/types";
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
  const [quality, setQuality] = useState<FxQuality>(() => {
    try {
      const q = localStorage.getItem("amateras.fxQuality");
      return ["auto", "low", "medium", "high"].includes(q ?? "")
        ? (q as FxQuality)
        : "auto";
    } catch {
      return "auto";
    }
  });
  const [effective, setEffective] = useState<EffectiveQuality>(() =>
    matchMedia("(max-width:700px)").matches ? "low" : "medium",
  );
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia("(prefers-reduced-motion:reduce)").matches,
  );
  useEffect(() => {
    try {
      localStorage.setItem("amateras.fxQuality", quality);
    } catch {}
  }, [quality]);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion:reduce)");
    const f = () => setReducedMotion(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return { quality, setQuality, effective, setEffective, reducedMotion };
}
