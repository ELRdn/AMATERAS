import { writeFile, readFile } from "node:fs/promises";
const page = await readFile("artifacts/source-warningPage.txt", "utf8");
for (const term of [
  "data/r8/",
  "warningCode",
  "warning_type",
  "\u30ec\u30d9\u30eb",
  "class20relm",
  "class20s.json",
]) {
  const positions = [
    ...page.matchAll(new RegExp(term.replaceAll("/", "\\/"), "g")),
  ].slice(0, 8);
  console.log(
    term,
    positions.map((m) => page.slice(m.index - 120, m.index + 200)),
  );
}
const paths = [
  "warning/data/r8/map.json",
  "warning/data/r8/130000.json",
  "common/const/class20relm.json",
  "common/const/geojson/class20s/1310100.json",
  "warning/const/warning.json",
];
await Promise.all(
  paths.map(async (path) => {
    const r = await fetch("https://www.jma.go.jp/bosai/" + path);
    const text = await r.text();
    const name = path.replaceAll("/", "_");
    if (r.ok) await writeFile("artifacts/" + name, text);
    console.log(path, r.status, text.slice(0, 1700));
  }),
);
