import type { EffectiveQuality } from "../../data/types";
export const QUALITY_LIMITS = {
  low: { spacing: 6000, triangles: 0, areas: 0, labels: 8 },
  medium: { spacing: 2500, triangles: 12000, areas: 48, labels: 18 },
  high: { spacing: 900, triangles: 24000, areas: 80, labels: 28 },
};
export class QualityController {
  quality: EffectiveQuality;
  private slow = 0;
  private lastChange = 0;
  constructor(mobile = false) {
    this.quality = mobile ? "low" : "medium";
  }
  observe(ms: number, now: number): EffectiveQuality {
    if (ms > 40 && ms < 1000) this.slow++;
    else this.slow = Math.max(0, this.slow - 1);
    if (this.slow >= 45 && now - this.lastChange > 15000) {
      this.quality = this.quality === "high" ? "medium" : "low";
      this.slow = 0;
      this.lastChange = now;
    }
    return this.quality;
  }
}
