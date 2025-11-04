// mapConfig.ts
export type BasemapMode = "local" | "hybrid";
export const BASEMAP_MODE: BasemapMode = "local"; // change to "hybrid" later

// Your hosted style URL (when you set it up)
export const ONLINE_STYLE_URL =
  "https://cdn.yourdomain.com/maps/style.json"; // TODO

// Path to your bundled offline style & data (in /assets)
export const OFFLINE_STYLE = require("../assets/offline-style.json"); // JSON file
export const OFFLINE_WORLD = require("../assets/world.geojson");      // if your style references inline, you may embed the data