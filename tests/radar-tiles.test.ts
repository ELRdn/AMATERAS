import { expect, it } from "vitest";
import { radarTileRegion } from "../src/map/radarTiles";
it("retains native even zoom tiles", () => {
  expect(radarTileRegion(6, 56, 25)).toEqual({
    z: 6,
    x: 56,
    y: 25,
    sx: 0,
    sy: 0,
    size: 256,
  });
});
it("uses the correct geographic quadrant at each odd zoom", () => {
  for (const z of [5, 7, 9])
    for (const dx of [0, 1])
      for (const dy of [0, 1]) {
        expect(radarTileRegion(z, 14 * 2 + dx, 6 * 2 + dy)).toEqual({
          z: z - 1,
          x: 14,
          y: 6,
          sx: dx * 128,
          sy: dy * 128,
          size: 128,
        });
      }
});
it("rejects unsupported display zooms and invalid coordinates", () => {
  for (const [z, x, y] of [
    [3, 7, 3],
    [11, 0, 0],
    [4, -1, 0],
    [4, 16, 0],
  ])
    expect(() => radarTileRegion(z, x, y)).toThrow();
});
