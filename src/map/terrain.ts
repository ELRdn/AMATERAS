import maplibregl from "maplibre-gl";
export function decodeGsi(r: number, g: number, b: number): number | null {
  const x = r * 65536 + g * 256 + b;
  return x === 8388608 ? null : (x > 8388608 ? x - 16777216 : x) * 0.01;
}
export function encodeTerrain(height: number | null): [number, number, number] {
  const n = Math.round(((height ?? 0) + 10000) * 10);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
let installed = false;
export function installTerrainProtocol() {
  if (installed) return;
  installed = true;
  maplibregl.addProtocol("gsi-dem", async (params, abort) => {
    const m = params.url.match(/^gsi-dem:\/\/(\d+)\/(\d+)\/(\d+)$/);
    if (!m) throw new Error("Invalid DEM path");
    const [, z, x, y] = m;
    const r = await fetch(
      `https://cyberjapandata.gsi.go.jp/xyz/${+z <= 8 ? "demgm_png" : "dem_png"}/${z}/${x}/${y}.png`,
      { signal: abort.signal },
    );
    if (!r.ok) throw new Error("標高データを取得できません");
    const bitmap = await createImageBitmap(await r.blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
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
