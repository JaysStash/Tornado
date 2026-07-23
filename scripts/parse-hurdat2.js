// Parses NHC's HURDAT2 fixed-format text file into normalized GeoJSON
// Features - one LineString per storm, with the full 6-hourly track
// (position, wind, pressure, status, wind radii) stored as
// properties.track for timeline playback, stats, and per-segment
// rendering (color/width that change along the track, not one flat
// value for the whole storm).
//
// Format docs: https://www.nhc.noaa.gov/data/hurdat/hurdat2-format-atlantic.pdf
import fs from "node:fs";
import path from "node:path";

const RAW_PATH = path.join(process.cwd(), "data", "raw", "hurdat2.txt");

function parseLatLon(latStr, lonStr) {
  const lat = parseFloat(latStr) * (latStr.includes("S") ? -1 : 1);
  const lon = parseFloat(lonStr) * (lonStr.includes("W") ? -1 : 1);
  return [lon, lat];
}

// Average of the 4 quadrant radii (NE/SE/SW/NW) for one wind threshold,
// ignoring missing (-999) quadrants. Returns null if all 4 are missing -
// this data only exists reliably from 2004 onward per NHC's own
// documentation; older records will mostly return null here, which
// callers need to handle (fall back to a category-based estimate).
function avgRadius(values) {
  const valid = values.filter((v) => v > 0);
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

export function parseHurdat2() {
  const raw = fs.readFileSync(RAW_PATH, "utf-8");
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  const features = [];
  let i = 0;
  const currentYear = new Date().getUTCFullYear();

  while (i < lines.length) {
    const header = lines[i].split(",").map((s) => s.trim());
    const [stormId, name, rowCountStr] = header;
    const rowCount = parseInt(rowCountStr, 10);
    i += 1;

    const track = [];
    let maxWind = 0;
    let minPressure = null;

    for (let r = 0; r < rowCount; r++) {
      const fields = lines[i + r].split(",").map((s) => s.trim());
      const [date, time, , status, latStr, lonStr, windStr, pressureStr, ...radiiFields] = fields;
      const [lon, lat] = parseLatLon(latStr, lonStr);
      const wind = parseInt(windStr, 10);
      const pressure = parseInt(pressureStr, 10);
      const radii = radiiFields.map((v) => parseInt(v, 10));

      if (wind > maxWind) maxWind = wind;
      if (pressure > 0 && (minPressure === null || pressure < minPressure)) {
        minPressure = pressure;
      }

      // radii layout (indices into the trailing fields): 0-3 = 34kt
      // NE/SE/SW/NW, 4-7 = 50kt, 8-11 = 64kt.
      const radius34ktNm = avgRadius(radii.slice(0, 4));

      track.push({
        date,
        time,
        status,
        lat,
        lon,
        wind_kt: wind >= 0 ? wind : null,
        pressure_mb: pressure > 0 ? pressure : null,
        radius_34kt_nm: radius34ktNm,
      });
    }
    i += rowCount;

    const year = parseInt(stormId.slice(4, 8), 10);

    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: track.map((p) => [p.lon, p.lat]),
      },
      properties: {
        id: `hur-${stormId.toLowerCase()}`,
        event_type: "hurricane",
        name: name === "UNNAMED" ? null : name,
        year,
        max_wind_kt: maxWind,
        min_pressure_mb: minPressure,
        category: windToCategory(maxWind),
        preliminary: year === currentYear,
        start_date: track[0]?.date ?? null,
        end_date: track[track.length - 1]?.date ?? null,
        track,
      },
    });
  }
  return features;
}

// Saffir-Simpson category from max sustained wind (knots)
function windToCategory(windKt) {
  if (windKt >= 137) return 5;
  if (windKt >= 113) return 4;
  if (windKt >= 96) return 3;
  if (windKt >= 83) return 2;
  if (windKt >= 64) return 1;
  if (windKt >= 34) return 0; // tropical storm
  return -1; // tropical depression or less
}
