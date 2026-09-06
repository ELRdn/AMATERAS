import { writeFile } from "node:fs/promises";
const urls = {
  warningPage: "https://www.jma.go.jp/bosai/warning/",
  radar: "https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json",
  warnings: "https://www.jma.go.jp/bosai/warning/data/warning/map.json",
  area: "https://www.jma.go.jp/bosai/common/const/area.json",
  style: "https://tiles.openfreemap.org/styles/liberty",
};
await Promise.all(
  Object.entries(urls).map(async ([name, url]) => {
    try {
      const r = await fetch(url);
      const body = await r.text();
      await writeFile(`artifacts/source-${name}.txt`, body);
      console.log(
        name,
        r.status,
        body.length,
        name === "warningPage"
          ? [...body.matchAll(/(?:src|href)=["']([^"']+\.js[^"']*)/g)].map(
              (m) => m[1],
            )
          : body.slice(0, 700),
      );
    } catch (e) {
      console.log(name, e.message);
    }
  }),
);
