// Parses SPC's daily preliminary tornado reports into GeoJSON. These are
// single-point Local Storm Reports (where a tornado was reported, not a
// surveyed start/end track), so they render as points, not lines - the
// same tornado-points layer already used for touchdown-only records in
// the finalized dataset. Once SPC finalizes this year's data (next
// year), build-static-data.js drops these in favor of the real surveyed
// tracks - see the note there.
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const RAW_PATH = path.join(process.cwd(), "data", "raw", "current-year-torn.csv");

export function parseCurrentYearTornadoes() {
  if (!fs.existsSync(RAW_PATH)) return [];
  const raw = fs.readFileSync(RAW_PATH, "utf-8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });

  const features = [];
  let seq = 0;
  for (const row of rows) {
    const lat = parseFloat(row.lat);
    const lon = parseFloat(row.lon);
    if (!lat || !lon || !row.report_date || row.report_date.length !== 6) continue;
    seq += 1;

    const yyyy = 2000 + parseInt(row.report_date.slice(0, 2), 10);
    const mm = row.report_date.slice(2, 4);
    const dd = row.report_date.slice(4, 6);

    // SPC's preliminary f_scale is an on-scene estimate, not a surveyed
    // rating - "UNK" or blank both mean not yet estimated.
    const efGuess = /^\d+$/.test((row.f_scale || "").trim())
      ? parseInt(row.f_scale, 10)
      : null;

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        id: `torn-prelim-${row.report_date}-${seq}`,
        event_type: "tornado",
        date: `${yyyy}-${mm}-${dd}`,
        year: yyyy,
        time: row.time || null,
        state: row.state || null,
        ef_rating: efGuess,
        preliminary: true,
        injuries: 0,
        fatalities: 0,
        property_loss: null,
        crop_loss: null,
        length_miles: null,
        width_yards: null,
        location: row.location || null,
        county: row.county || null,
      },
    });
  }
  return features;
}
