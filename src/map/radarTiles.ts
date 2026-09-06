import maplibregl from "maplibre-gl";

// JMA hrpns advertises zoomUse="even", native zooms 4,6,8,10.
// Odd display zooms use the geographically corresponding quadrant of the parent.
export function radarTileRegion(z: number, x: number, y: number) {
  if (
    !Number.isInteger(z) ||
    z < 4 ||
    z > 10 ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= 2 ** z ||
    y >= 2 ** z
  )
    throw new Error("Invalid radar tile");
  const scale = z % 2 ? 2 : 1;
  return {
    z: z - (z % 2),
    x: Math.floor(x / scale),
    y: Math.floor(y / scale),
    sx: ((x % scale) * 256) / scale,
    sy: ((y % scale) * 256) / scale,
    size: 256 / scale,
  };
}
let installed = false;
export function installRadarProtocol() {
  if (installed) return;
  installed = true;
  maplibregl.addProtocol("jma-radar", async (params, abort) => {
    const m = params.url.match(
      /^jma-radar:\/\/(\d{14})\/(\d{14})\/(\d+)\/(\d+)\/(\d+)$/,
    );
    if (!m) throw new Error("Invalid radar path");
    const [, base, valid, z, x, y] = m;
    const t = radarTileRegion(+z, +x, +y);
    const response = await fetch(
      `/api/radar/tiles/${base}/${valid}/${t.z}/${t.x}/${t.y}.png`,
      { signal: abort.signal },
    );
    if (!response.ok) throw new Error(`雨雲画像取得失敗 (${response.status})`);
    if (t.size === 256) return { data: await response.arrayBuffer() };
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = new OffscreenCanvas(256, 256),
      ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, t.sx, t.sy, t.size, t.size, 0, 0, 256, 256);
    bitmap.close();
    return {
      data: await (
        await canvas.convertToBlob({ type: "image/png" })
      ).arrayBuffer(),
    };
  });
}
