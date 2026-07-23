// Color ramps used across the map, stats panel, and legends.
// Tornado ramp follows the standard damage-scale convention (green -> purple
// as EF rating climbs) so it reads correctly to anyone used to NWS products.
// Hurricane ramp uses a separate blue/violet family so the two event types
// stay visually distinct on the same map.

export const EF_COLORS = {
  "-1": "#5B6472", // unrated / EFU
  0: "#4ADE80",
  1: "#FBBF24",
  2: "#FB923C",
  3: "#F87171",
  4: "#DC2626",
  5: "#A21CAF",
};

export const CATEGORY_COLORS = {
  "-1": "#5B6472", // sub-tropical depression / unrated
  0: "#38BDF8", // tropical storm
  1: "#22D3EE",
  2: "#2DD4BF",
  3: "#A78BFA",
  4: "#C084FC",
  5: "#F472B6",
};

export function efColor(rating) {
  if (rating === null || rating === undefined) return EF_COLORS["-1"];
  return EF_COLORS[rating] ?? EF_COLORS["-1"];
}

export function categoryColor(category) {
  if (category === null || category === undefined) return CATEGORY_COLORS["-1"];
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS["-1"];
}

export function efLabel(rating) {
  if (rating === null || rating === undefined) return "Unrated";
  return `EF${rating}`;
}

export function categoryLabel(category) {
  if (category === null || category === undefined) return "Unrated";
  if (category <= 0) return "Tropical Storm";
  return `Category ${category}`;
}

// Chaser badge tiers - distinct colors so the three read differently at
// a glance, not just as the same pill in different text.
export const BADGE_COLORS = {
  trusted: "#8B93E8",
  verified: "#8ED1F5",
  featured: "#C9A7F5",
};

export function badgeColor(badge) {
  return BADGE_COLORS[badge] || "#8B96A8";
}

// Saffir-Simpson category from max sustained wind (knots) - same logic
// as the server-side version in scripts/parse-hurdat2.js, duplicated
// here because this needs to run per-point client-side (each track
// segment gets colored by its own wind speed, not the storm's peak).
export function windToCategory(windKt) {
  if (windKt >= 137) return 5;
  if (windKt >= 113) return 4;
  if (windKt >= 96) return 3;
  if (windKt >= 83) return 2;
  if (windKt >= 64) return 1;
  if (windKt >= 34) return 0;
  return -1;
}

// --- True-to-scale width ---
// MapLibre line-width is always in screen pixels, not real-world units.
// To make a line's rendered width represent an actual geographic
// distance at any zoom, scale it using the Web Mercator meters-per-pixel
// constant: meters/px = 156543.03392 * cos(latitude) / 2^zoom. Since
// that's latitude-dependent and a per-feature expression can't easily
// read "this feature's own latitude" for this purpose, this uses one
// fixed reference latitude (~38N, central US - reasonable for
// tornado/hurricane activity, which skews toward the US). Renders
// slightly wide north of that, slightly narrow south of it - a real
// but minor approximation, not an error.
const REF_LAT_COS = Math.cos((38 * Math.PI) / 180);
const MERCATOR_ZOOM0_METERS_PER_PX = 156543.03392;
const SCALE_CONSTANT = 1 / (MERCATOR_ZOOM0_METERS_PER_PX * REF_LAT_COS);

// Builds a MapLibre line-width expression rendering `widthMetersExpr`
// (a sub-expression evaluating to real-world meters) as an
// approximately-true-to-scale pixel width at any zoom, floored at
// `minPx` so nothing becomes invisible or unclickable at low zoom -
// a pure 1:1 scale would make most tornado paths sub-pixel at any
// zoom level that shows more than one state.
function trueScaleWidthExpression(widthMetersExpr, minPx) {
  return [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    0,
    ["max", minPx, ["*", widthMetersExpr, SCALE_CONSTANT]],
    24,
    ["max", minPx, ["*", widthMetersExpr, SCALE_CONSTANT * Math.pow(2, 24)]],
  ];
}

// Tornado: real reported damage-path width (yards -> meters). Floored
// at 1.5px - true scale alone would render most tornadoes as an
// unclickable sliver except when zoomed in quite close, which is
// physically accurate (tornado paths ARE tiny compared to state-scale
// distances) but not usable.
export const TORNADO_TRUE_WIDTH_EXPRESSION = trueScaleWidthExpression(
  ["*", ["coalesce", ["get", "width_yards"], 0], 0.9144],
  1.5
);

// Hurricane: real 34kt wind-radii extent where available (2004+
// storms), converted radius -> diameter (x2) and nm -> meters (x1852).
// Older/gap records fall back to a generic size-by-category estimate -
// NOT this specific storm's actual measured extent, just a reasonable
// stand-in so older storms don't render at zero width. Floored at 2px.
export const CATEGORY_FALLBACK_RADIUS_NM = {
  "-1": 30,
  0: 60,
  1: 80,
  2: 90,
  3: 100,
  4: 110,
  5: 120,
};

export const HURRICANE_TRUE_WIDTH_EXPRESSION = trueScaleWidthExpression(
  [
    "*",
    [
      "coalesce",
      ["get", "radius_34kt_nm"],
      [
        "match",
        ["coalesce", ["get", "category"], -1],
        0, CATEGORY_FALLBACK_RADIUS_NM[0],
        1, CATEGORY_FALLBACK_RADIUS_NM[1],
        2, CATEGORY_FALLBACK_RADIUS_NM[2],
        3, CATEGORY_FALLBACK_RADIUS_NM[3],
        4, CATEGORY_FALLBACK_RADIUS_NM[4],
        5, CATEGORY_FALLBACK_RADIUS_NM[5],
        CATEGORY_FALLBACK_RADIUS_NM["-1"],
      ],
    ],
    1852 * 2,
  ],
  2
);

// MapLibre "match" expressions - used directly as paint properties.
// Falls back to the muted "unrated" color for any value not listed.
export const EF_MATCH_EXPRESSION = [
  "match",
  ["coalesce", ["get", "ef_rating"], -1],
  0, EF_COLORS[0],
  1, EF_COLORS[1],
  2, EF_COLORS[2],
  3, EF_COLORS[3],
  4, EF_COLORS[4],
  5, EF_COLORS[5],
  EF_COLORS["-1"],
];

export const CATEGORY_MATCH_EXPRESSION = [
  "match",
  ["coalesce", ["get", "category"], -1],
  0, CATEGORY_COLORS[0],
  1, CATEGORY_COLORS[1],
  2, CATEGORY_COLORS[2],
  3, CATEGORY_COLORS[3],
  4, CATEGORY_COLORS[4],
  5, CATEGORY_COLORS[5],
  CATEGORY_COLORS["-1"],
];

// Tornado line width in pixels, scaled from the reported damage-path width
// (yards). This is a screen-space visual scale, not a true geographic
// buffer - at real-world scale most tornado paths would be invisible at
// any zoom level useful for seeing the whole track.
export const TORNADO_WIDTH_EXPRESSION = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "width_yards"], 0],
  0, 2,
  100, 3,
  500, 5,
  1500, 7,
  4000, 10,
];

// Hurricane tracks don't have a single reported "width" the way tornadoes
// do (HURDAT2 gives wind-radii extents, not a path width) - so intensity
// (max wind) stands in as the analogous "how big a deal was this" scale.
// Kept noticeably thinner than tornado tracks - hurricane tracks already
// read as visually heavy just from spanning thousands of miles, so a wide
// line on top of that overwhelms the map fast.
export const HURRICANE_WIDTH_EXPRESSION = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "max_wind_kt"], 0],
  20, 1,
  50, 1.5,
  74, 2,
  96, 2.5,
  113, 3,
  137, 4,
];
