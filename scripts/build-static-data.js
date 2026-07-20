// Builds the final static GeoJSON files served by the site from the
// raw cached data. Splits tornadoes by decade and hurricanes by
// decade too, so the frontend never has to load the full 75-year
// dataset at once - it loads what the current filter/timeline needs.
import fs from "node:fs";
import path from "node:path";
import { parseTornadoes } from "./parse-tornadoes.js";
import { parseHurdat2 } from "./parse-hurdat2.js";
import { parseCurrentYearTornadoes } from "./parse-current-year-tornadoes.js";

const OUT_DIR = path.join(process.cwd(), "data", "processed");

function decadeOf(year) {
  return Math.floor(year / 10) * 10;
}

function groupByDecade(features, getYear) {
  const groups = {};
  for (const f of features) {
    const year = getYear(f);
    if (!year) continue;
    const d = decadeOf(year);
    groups[d] ??= [];
    groups[d].push(f);
  }
  return groups;
}

function writeGeoJSON(filePath, features) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify({ type: "FeatureCollection", features }),
    "utf-8"
  );
}

function main() {
  console.log("Parsing tornado data...");
  const tornadoes = parseTornadoes();
  console.log(`  ${tornadoes.length} finalized tornado records`);

  // The finalized annual database lags real time by a season or more -
  // the current year's tornadoes won't appear there until SPC releases
  // next year's update. Fill that gap with SPC's daily preliminary
  // reports, but only for years the finalized data doesn't already
  // cover - the moment SPC's real survey data for a year shows up in
  // the finalized file, this automatically stops using the preliminary
  // stand-in for that year, no manual cleanup needed.
  const finalizedYears = new Set(tornadoes.map((f) => f.properties.year));
  const preliminary = parseCurrentYearTornadoes().filter(
    (f) => !finalizedYears.has(f.properties.year)
  );
  console.log(
    `  ${preliminary.length} preliminary (unsurveyed) tornado reports for years not yet in the finalized database`
  );
  const allTornadoes = [...tornadoes, ...preliminary];

  console.log("Parsing hurricane data...");
  const hurricanes = parseHurdat2();
  console.log(`  ${hurricanes.length} hurricane tracks`);

  const tornadoDecades = groupByDecade(allTornadoes, (f) =>
    parseInt(f.properties.date?.slice(0, 4), 10)
  );
  const hurricaneDecades = groupByDecade(hurricanes, (f) => f.properties.year);

  for (const [decade, features] of Object.entries(tornadoDecades)) {
    writeGeoJSON(path.join(OUT_DIR, "tornadoes", `${decade}s.geojson`), features);
  }
  for (const [decade, features] of Object.entries(hurricaneDecades)) {
    writeGeoJSON(path.join(OUT_DIR, "hurricanes", `${decade}s.geojson`), features);
  }

  // Lightweight per-year counts for the timeline density histogram - so
  // the timeline can render instantly without loading full decade data.
  function yearCounts(features, getYear) {
    const counts = {};
    for (const f of features) {
      const y = getYear(f);
      if (!y) continue;
      counts[y] = (counts[y] || 0) + 1;
    }
    return counts;
  }
  fs.writeFileSync(
    path.join(OUT_DIR, "tornadoes", "year-counts.json"),
    JSON.stringify(yearCounts(allTornadoes, (f) => f.properties.year)),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "hurricanes", "year-counts.json"),
    JSON.stringify(yearCounts(hurricanes, (f) => f.properties.year)),
    "utf-8"
  );

  // Lightweight index files listing available decades - the frontend
  // reads these first to know what to fetch.
  fs.writeFileSync(
    path.join(OUT_DIR, "tornadoes", "index.json"),
    JSON.stringify({ decades: Object.keys(tornadoDecades).sort(), count: allTornadoes.length }),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "hurricanes", "index.json"),
    JSON.stringify({ decades: Object.keys(hurricaneDecades).sort(), count: hurricanes.length }),
    "utf-8"
  );

  console.log(`Done. Output in ${OUT_DIR}`);
}

main();
