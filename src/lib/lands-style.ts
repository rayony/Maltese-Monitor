import type { StyleSpecification } from "maplibre-gl";

const BASE = "https://mapapi.geodata.gov.hk/gs/api/v1.0.0/vt";

type RawLayer = { id?: string; type?: string; source?: string };

export async function loadLandsStyle(): Promise<StyleSpecification> {
  const [baseRes, labelRes] = await Promise.all([
    fetch(`${BASE}/basemap/WGS84/resources/styles/root.json`),
    fetch(`${BASE}/label/hk/tc/WGS84/resources/styles/root.json`),
  ]);
  if (!baseRes.ok || !labelRes.ok) throw new Error("地圖樣式載入唔到");
  const base = (await baseRes.json()) as { layers?: RawLayer[] };
  const labels = (await labelRes.json()) as { layers?: RawLayer[] };
  const labelLayers = (labels.layers ?? [])
    .filter((layer) => layer.type === "symbol" || layer.type === "circle")
    .map((layer) => ({ ...layer, id: `lbl-${String(layer.id)}`, source: "labels" }));
  return {
    version: 8,
    sprite: `${BASE}/basemap/WGS84/resources/sprites/sprite`,
    glyphs: `${BASE}/label/hk/tc/WGS84/resources/fonts/{fontstack}/{range}.pbf`,
    sources: {
      esri: {
        type: "vector",
        tiles: [`${BASE}/basemap/WGS84/tile/{z}/{y}/{x}.pbf`],
        minzoom: 0,
        maxzoom: 15,
        attribution: "地圖由地政總署提供 / Map from Lands Department",
      },
      labels: {
        type: "vector",
        tiles: [`${BASE}/label/hk/tc/WGS84/tile/{z}/{y}/{x}.pbf`],
        minzoom: 0,
        maxzoom: 15,
      },
    },
    layers: [...(base.layers ?? []), ...labelLayers],
  } as StyleSpecification;
}
