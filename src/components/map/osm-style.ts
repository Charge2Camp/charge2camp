import type { StyleSpecification } from "maplibre-gl";

/**
 * Freier OpenStreetMap-Rasterkachel-Stil ohne API-Key (§23). Für Produktion
 * mit höherem Traffic sollte auf einen eigenen Tile-Cache oder einen Anbieter
 * mit OSM-Nutzungslizenz umgestellt werden (siehe docs/data-sources.md).
 */
export const osmStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};
