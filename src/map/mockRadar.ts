import maplibregl from "maplibre-gl";
let installed = false;
// Development only: deterministic, visibly labelled scenario precipitation.
export function installMockRadar() {
  if (installed) return;
  installed = true;
  maplibregl.addProtocol("mock-radar", async (params) => {
    const m = params.url.match(/^mock-radar:\/\/(-?\d+)\/(\d+)\/(\d+)\/(\d+)$/);
    if (!m) throw new Error("Invalid fixture tile");
    const [, f, z, x, y] = m.map(Number);
    const canvas = new OffscreenCanvas(256, 256),
      ctx = canvas.getContext("2d")!;
    const data = ctx.createImageData(256, 256);
    const size = 2 ** z;
    const palette = [
      [165, 221, 255],
      [33, 140, 255],
      [0, 65, 255],
      [255, 240, 0],
      [255, 153, 0],
      [255, 40, 0],
      [176, 0, 128],
    ];
    for (let py = 0; py < 256; py++)
      for (let px = 0; px < 256; px++) {
        const lon = ((x + px / 256) / size) * 360 - 180,
          lat =
            (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + py / 256)) / size))) *
              180) /
            Math.PI;
        const center = 133 + f * 0.075;
        const dy = lat - (33 + (lon - center) * 0.52);
        const shape =
          Math.exp(-(((lon - center) / 4.2) ** 2 + (dy / 0.6) ** 2)) *
          (0.7 + 0.3 * Math.sin(lon * 6) * Math.sin(lat * 8));
        if (f < 0 || shape < 0.12) continue;
        const index = Math.min(6, Math.floor(shape * 7));
        const at = (py * 256 + px) * 4;
        data.data.set([...palette[index], 210], at);
      }
    ctx.putImageData(data, 0, 0);
    return {
      data: await (
        await canvas.convertToBlob({ type: "image/png" })
      ).arrayBuffer(),
    };
  });
}
