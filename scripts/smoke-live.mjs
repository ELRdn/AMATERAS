import { writeFile, mkdir } from "node:fs/promises";
const base = process.env.AMATERAS_URL ?? "http://127.0.0.1:5186";
await mkdir("artifacts", { recursive: true });
const output = base.includes(":8787")
  ? "artifacts/live-smoke-worker.json"
  : "artifacts/live-smoke.json";
const results = [];
async function save(ok) {
  await writeFile(
    output,
    JSON.stringify({ at: new Date().toISOString(), ok, results }, null, 2),
  );
}
const check = async (name, url, validate) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const body = await r.arrayBuffer();
  const ok = r.ok && validate(body, r);
  results.push({ name, url, status: r.status, bytes: body.byteLength, ok });
  if (!ok) {
    await save(false);
    throw new Error(name + " failed");
  }
  return body;
};
const radar = JSON.parse(
  new TextDecoder().decode(
    await check("radar", base + "/api/radar", (b) => {
      const j = JSON.parse(new TextDecoder().decode(b));
      return j.health.state === "LIVE" && j.data.length > 1;
    }),
  ),
);
await check("warnings", base + "/api/warnings", (b) => {
  const j = JSON.parse(new TextDecoder().decode(b));
  return j.health.state === "LIVE" && Array.isArray(j.data);
});
for (const id of ["earthquakes", "typhoons"])
  await check(id, base + "/api/" + id, (b) => {
    const j = JSON.parse(new TextDecoder().decode(b));
    return (
      j.health.state === "LIVE" &&
      Array.isArray(j.data) &&
      j.data.every(
        (e) =>
          e.source?.url.startsWith("https://") &&
          (id === "earthquakes"
            ? !e.position ||
              (Math.abs(e.position[0]) <= 180 && Math.abs(e.position[1]) <= 90)
            : e.current && e.detailState === "LIVE"),
      )
    );
  });
const f = radar.data.at(-1);
await check(
  "radar tile",
  base + f.tiles.replace("{z}", "6").replace("{x}", "56").replace("{y}", "25"),
  (b) => new Uint8Array(b)[0] === 137,
);
await check(
  "area geometry",
  base + "/api/areas/1310100",
  (b) =>
    JSON.parse(new TextDecoder().decode(b)).features[0].properties.code ===
    "1310100",
);
await check(
  "GSI DEM",
  "https://cyberjapandata.gsi.go.jp/xyz/dem_png/10/905/403.png",
  (b) => new Uint8Array(b)[0] === 137,
);
await check("base map tiles", "https://tiles.openfreemap.org/planet", (b) =>
  Array.isArray(JSON.parse(new TextDecoder().decode(b)).tiles),
);
await save(true);
console.log(JSON.stringify(results, null, 2));
