import { mkdir, writeFile } from "node:fs/promises";
await mkdir("public/data", { recursive: true });
async function json(path) {
  const r = await fetch("https://www.jma.go.jp/bosai/" + path);
  if (!r.ok) throw new Error(path + ": " + r.status);
  return r.json();
}
const [areas, bounds] = await Promise.all([
  json("common/const/area.json"),
  json("common/const/class20relm.json"),
]);
const places = [];
for (const [code, b] of Object.entries(bounds)) {
  const area = areas.class20s[code];
  if (!area) continue;
  const c15 = areas.class15s[area.parent];
  const c10 = areas.class10s[c15?.parent];
  const office = areas.offices[c10?.parent];
  places.push({
    code,
    name: area.name,
    kana: area.kana ?? "",
    prefecture: office?.name ?? "",
    officeCode: c10?.parent ?? "",
    bounds: [b.sw[1], b.sw[0], b.ne[1], b.ne[0]],
    center: [(b.sw[1] + b.ne[1]) / 2, (b.sw[0] + b.ne[0]) / 2],
  });
}
for (const [code, office] of Object.entries(areas.offices)) {
  const list = places.filter((p) => p.officeCode === code);
  if (!list.length) continue;
  const b = [
    Math.min(...list.map((p) => p.bounds[0])),
    Math.min(...list.map((p) => p.bounds[1])),
    Math.max(...list.map((p) => p.bounds[2])),
    Math.max(...list.map((p) => p.bounds[3])),
  ];
  places.push({
    code,
    name: office.name,
    kana: "",
    prefecture: "地方予報区",
    officeCode: code,
    bounds: b,
    center: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2],
  });
}
await writeFile("public/data/places.json", JSON.stringify(places));
const page = await (await fetch("https://www.jma.go.jp/bosai/warning/")).text();
const section = page.slice(page.indexOf("h={33:{"));
const matches = [
  ...section.matchAll(
    /(?:"(\d{2})"|(\d{2})):\{shortNameParts:s\.([a-z_]+)\[(\d)\],nameParts:e\.[a-z_]+\[\d\],elem:"[a-z_]+",level:\d+\}/g,
  ),
];
const codes = {};
const names = {
  rain: "大雨",
  landslide: "土砂災害",
  tide: "高潮",
  wind: "強風",
  wind_snow: "風雪",
  snow: "大雪",
  wave: "波浪",
  thunder: "雷",
  snow_melting: "融雪",
  fog: "濃霧",
  dry: "乾燥",
  avalanche: "なだれ",
  cold: "低温",
  frost: "霜",
  ice_accretion: "着氷",
  snow_accretion: "着雪",
};
for (const m of matches) {
  const code = m[1] ?? m[2];
  if (codes[code]) continue;
  const category = m[3],
    level = Number(m[4]);
  if (!names[category]) continue;
  const levelLabel = { 2: "注意報", 3: "警報", 4: "危険警報", 5: "特別警報" }[
    level
  ];
  const prefix = ["rain", "landslide", "tide"].includes(category)
    ? `レベル${level} `
    : "";
  const noun =
    level > 2 && category === "wind"
      ? "暴風"
      : level > 2 && category === "wind_snow"
        ? "暴風雪"
        : names[category];
  codes[code] = {
    category,
    level,
    name: prefix + noun + levelLabel,
    shortName: names[category],
  };
}
if (!codes["49"] || !codes["10"] || !codes["14"])
  throw new Error("Official warning code table changed");
await writeFile("src/data/warning-codes.json", JSON.stringify(codes, null, 2));
for (const name of ["dark", "liberty"]) {
  const r = await fetch("https://tiles.openfreemap.org/styles/" + name);
  if (!r.ok) throw new Error("Style unavailable");
  await writeFile(
    "public/data/style-" + name + ".json",
    JSON.stringify(await r.json()),
  );
}
await writeFile(
  "public/data/provenance.json",
  JSON.stringify(
    {
      retrievedAt: new Date().toISOString(),
      places: places.length,
      warningCodes: Object.keys(codes).length,
      sources: [
        "https://www.jma.go.jp/bosai/common/const/area.json",
        "https://www.jma.go.jp/bosai/common/const/class20relm.json",
        "https://www.jma.go.jp/bosai/warning/",
        "https://openfreemap.org/quick_start/",
      ],
    },
    null,
    2,
  ),
);
console.log(
  "Saved",
  places.length,
  "places;",
  Object.keys(codes).length,
  "official warning codes",
);
