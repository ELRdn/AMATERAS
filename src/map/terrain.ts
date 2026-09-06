import maplibregl from "maplibre-gl";
export function decodeGsi(r: number, g: number, b: number): number | null {
  const x = r * 65536 + g * 256 + b;
  return x === 8388608 ? null : (x > 8388608 ? x - 16777216 : x) * 0.01;
}
export function encodeTerrain(height: number | null): [number, number, number] {
  const n = Math.round(((height ?? 0) + 10000) * 10);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function demCrop(z: number, x: number, y: number, sourceZoom: number) {
  const scale = 2 ** (z - sourceZoom);
  return {
    z: sourceZoom,
    x: Math.floor(x / scale),
    y: Math.floor(y / scale),
    crop: [
      ((x % scale) * 256) / scale,
      ((y % scale) * 256) / scale,
      256 / scale,
    ] as [number, number, number],
  };
}
export async function fetchDemTile(
  z: number,
  x: number,
  y: number,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  let sourceZoom = z;
  while (sourceZoom >= 0) {
    const tile = demCrop(z, x, y, sourceZoom);
    const kind = sourceZoom <= 8 ? "demgm_png" : "dem_png";
    const response = await fetcher(
      `https://cyberjapandata.gsi.go.jp/xyz/${kind}/${tile.z}/${tile.x}/${tile.y}.png`,
      { signal },
    );
    if (response.ok) return { blob: await response.blob(), crop: tile.crop };
    if (response.status !== 404) throw new Error("標高データを取得できません");
    // Missing coastal/ocean high-resolution tiles can use a real coarser GSI tile.
    sourceZoom = sourceZoom > 8 ? 8 : sourceZoom - 1;
  }
  throw new Error("標高データの提供範囲を取得できません");
}

let installed = false;
export function installTerrainProtocol() {
  if (installed) return;
  installed = true;
  maplibregl.addProtocol("gsi-dem", async (params, abort) => {
    const m = params.url.match(/^gsi-dem:\/\/(\d+)\/(\d+)\/(\d+)$/);
    if (!m) throw new Error("Invalid DEM path");
    const [, z, x, y] = m;
    const tile = await fetchDemTile(+z, +x, +y, abort.signal);
    const bitmap = await createImageBitmap(tile.blob);
    const canvas = new OffscreenCanvas(256, 256);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false; // Never interpolate encoded RGB elevation bytes.
    const [sx, sy, size] = tile.crop;
    ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, 256, 256);
    bitmap.close();
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const rgb = encodeTerrain(
        img.data[i + 3] === 0
          ? null
          : decodeGsi(img.data[i], img.data[i + 1], img.data[i + 2]),
      );
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return {
      data: await (
        await canvas.convertToBlob({ type: "image/png" })
      ).arrayBuffer(),
    };
  });
}
