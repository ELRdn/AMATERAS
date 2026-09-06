import type { Page } from "@playwright/test";
import { deflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
const places = JSON.parse(readFileSync("public/data/places.json", "utf8")) as {
  code: string;
  center: [number, number];
}[];
function crc(b: Buffer) {
  let n = 0xffffffff;
  for (const c of b) {
    n ^= c;
    for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
  }
  return (n ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const name = Buffer.from(type),
    length = Buffer.alloc(4),
    sum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, sum]);
}
export function demPng() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(256);
  header.writeUInt32BE(256, 4);
  header[8] = 8;
  header[9] = 6;
  const data = Buffer.alloc(256 * (1 + 256 * 4));
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const i = y * 1025 + 1 + x * 4,
        n = (100 + x) * 100;
      data[i] = n >>> 16;
      data[i + 1] = (n >>> 8) & 255;
      data[i + 2] = n & 255;
      data[i + 3] = 255;
    }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(data)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
export async function fixtureMap(page: Page) {
  await page.route("**/data/style-*.json", (r) =>
    r.fulfill({
      json: {
        version: 8,
        glyphs: "https://fixture.invalid/{fontstack}/{range}.pbf",
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#142a3b" },
          },
        ],
      },
    }),
  );
  await page.route("https://fixture.invalid/**", (r) =>
    r.fulfill({ body: Buffer.alloc(0) }),
  );
  const png = demPng();
  await page.route("https://cyberjapandata.gsi.go.jp/**", (r) =>
    r.fulfill({ body: png, contentType: "image/png" }),
  );
  await page.route("**/api/areas/*", (r) => {
    const code = new URL(r.request().url()).pathname.split("/").at(-1)!;
    const p = places.find((p) => p.code === code)?.center ?? [139.7, 35.7],
      x = p[0],
      y = p[1];
    return r.fulfill({
      json: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { code, labelPoints: [p] },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [x - 0.04, y - 0.04],
                  [x + 0.04, y - 0.04],
                  [x + 0.04, y + 0.04],
                  [x - 0.04, y + 0.04],
                  [x - 0.04, y - 0.04],
                ],
              ],
            },
          },
        ],
      },
    });
  });
}
export async function openSheet(page: Page) {
  if (await page.locator(".mobile-warning-toggle").isVisible())
    await page.locator(".mobile-warning-toggle").click();
}
