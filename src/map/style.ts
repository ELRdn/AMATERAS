import type { StyleSpecification } from "maplibre-gl";
export async function loadStyle(
  theme: "dark" | "light",
): Promise<StyleSpecification> {
  const r = await fetch(
    `/data/style-${theme === "dark" ? "dark" : "liberty"}.json`,
  );
  if (!r.ok) throw new Error("背景地図の設定を読み込めません");
  const style = (await r.json()) as StyleSpecification;
  for (const layer of style.layers) {
    if (layer.type === "background" && theme === "dark")
      layer.paint = { "background-color": "#142a3b" };
    if (layer.type === "fill") {
      if (layer.paint) delete layer.paint["fill-pattern"];
      if (layer.id === "water" && theme === "dark")
        layer.paint = {
          ...layer.paint,
          "fill-color": "#071425",
          "fill-antialias": true,
          "fill-outline-color": "#31566e",
        };
    }
    if (
      layer.type === "line" &&
      layer.id.includes("boundary") &&
      theme === "dark"
    )
      layer.paint = { ...layer.paint, "line-color": "#37627c" };
    if (layer.type === "symbol" && layer.layout?.["text-field"]) {
      layer.layout["text-field"] = [
        "coalesce",
        ["get", "name:ja"],
        ["get", "name"],
        ["get", "name:latin"],
      ];
      delete layer.layout["icon-image"];
      if (theme === "dark")
        layer.paint = {
          ...layer.paint,
          "text-color": "#9bb4c9",
          "text-halo-color": "#0a1a2f",
          "text-halo-width": 1,
        };
    }
  }
  style.layers = style.layers.filter(
    (l) => l.type !== "fill-extrusion" && !l.id.includes("poi"),
  );
  return style;
}
