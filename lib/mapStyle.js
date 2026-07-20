// Base map style. Uses CARTO's free vector basemaps (no API key, no
// account, no request cap) rather than Mapbox GL - keeps this on a truly
// free tier indefinitely instead of a 50k-loads/month ceiling.
// Style docs: https://github.com/CartoDB/basemap-styles
export const BASE_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// CARTO's stock dark-matter style is tuned for data-viz backgrounds, which
// means it's darker and more label-sparse than what was asked for here
// ("dark but not too dark," borders/cities/roads visible). This function
// loads the style JSON and adjusts specific layers after MapLibre parses
// it, rather than hand-maintaining a full custom style file.
export function tuneStyle(style) {
  const layers = style.layers.map((layer) => {
    const next = { ...layer, paint: { ...layer.paint } };

    // Lighten the base land/water fills so it reads as "dark," not "black."
    if (layer.id === "background") {
      next.paint["background-color"] = "#0A0B0F";
    }
    if (layer.type === "fill" && /water/.test(layer.id)) {
      next.paint["fill-color"] = "#12141B";
    }
    if (layer.type === "fill" && /(land|landuse|landcover)/.test(layer.id)) {
      next.paint["fill-color"] = "#1A1C24";
    }

    // Boost border visibility (state/country outlines) per the brief.
    if (layer.type === "line" && /boundar/.test(layer.id)) {
      next.paint["line-color"] = "#3D404E";
      next.paint["line-opacity"] = 0.9;
    }

    // Boost road line visibility slightly - stock style renders them
    // very faint at this dark a background.
    if (layer.type === "line" && /road|highway|transportation/.test(layer.id)) {
      next.paint["line-color"] = next.paint["line-color"] ?? "#2E3140";
      next.paint["line-opacity"] = 0.8;
    }

    // Label text: cool off-white, legible against the dark basemap.
    if (layer.type === "symbol" && layer.layout?.["text-field"]) {
      next.paint["text-color"] = /road|highway/.test(layer.id)
        ? "#9DA0B5"
        : "#E9EAF2";
      next.paint["text-halo-color"] = "#0A0B0F";
      next.paint["text-halo-width"] = 1.2;
    }

    return next;
  });

  return { ...style, layers };
}
