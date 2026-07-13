// Parses the raw SPC tornado CSV into normalized GeoJSON Features.
//
// KNOWN LIMITATION (per SPC): the begin/end lat-lon pair is a straight
// line between touchdown and lift-off, not the tornado's true curving
// ground track. That's a data limitation, not a bug in this parser.
//
// SPC CSV columns (1950-present):
// om,yr,mo,dy,date,time,tz,st,stf,stn,mag,inj,fat,loss,closs,
// slat,slon,elat,elon,len,wid,ns,sn,sg,f1,f2,f3,f4,fc
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const RAW_PATH = path.join(process.cwd(), "data", "raw", "torn.csv");

export function parseTornadoes() {
  const raw = fs.readFileSync(RAW_PATH, "utf-8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });

  const features = [];
  for (const row of rows) {
    const slat = parseFloat(row.slat);
    const slon = parseFloat(row.slon);
    const elat = parseFloat(row.elat);
    const elon = parseFloat(row.elon);

    // Skip records with no usable start coordinate
    if (!slat || !slon) continue;

    const hasEnd = elat && elon && (elat !== slat || elon !== slon);
    const geometry = hasEnd
      ? { type: "LineString", coordinates: [[slon, slat], [elon, elat]] }
      : { type: "Point", coordinates: [slon, slat] };

    const efRating = row.mag === "" || row.mag === "-9" ? null : parseInt(row.mag, 10);

    features.push({
      type: "Feature",
      geometry,
      properties: {
        id: `torn-${row.yr}-${row.om}`,
        event_type: "tornado",
        date: row.date,
        time: row.time,
        timezone: row.tz,
        state: row.st,
        ef_rating: efRating,
        preliminary: Number(row.yr) === new Date().getUTCFullYear(),
        injuries: Number(row.inj) || 0,
        fatalities: Number(row.fat) || 0,
        length_miles: Number(row.len) || null,
        width_yards: Number(row.wid) || null,
        start_lat: slat,
        start_lon: slon,
        end_lat: hasEnd ? elat : null,
        end_lon: hasEnd ? elon : null,
      },
    });
  }
  return features;
}
