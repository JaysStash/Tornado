// SPC's annual finalized database (fetch-tornadoes.js) only contains
// fully surveyed prior years - the current year's tornadoes don't exist
// there until SPC finalizes and re-releases that file, typically the
// following spring/summer. In-progress-year data instead lives in SPC's
// daily preliminary Local Storm Report files, one CSV per calendar day:
// https://www.spc.noaa.gov/climo/reports/{YYMMDD}_rpts_filtered_torn.csv
//
// IMPORTANT CAVEAT: this format is based on general knowledge of a
// long-running, stable SPC data product, but spc.noaa.gov blocks
// automated fetching from where this pipeline was built, so the exact
// current column layout couldn't be directly verified before shipping.
// Run this once and sanity-check data/raw/current-year-torn.csv looks
// right (real dates, real-looking lat/lon) before trusting it blindly -
// if SPC changed their format, this needs a look.
import fs from "node:fs";
import path from "node:path";

const OUT_PATH = path.join(process.cwd(), "data", "raw", "current-year-torn.csv");

function pad2(n) {
  return String(n).padStart(2, "0");
}

function datesSinceJan1(year) {
  const dates = [];
  const now = new Date();
  const end = now.getUTCFullYear() === year ? now : new Date(Date.UTC(year, 11, 31));
  for (
    let d = new Date(Date.UTC(year, 0, 1));
    d <= end;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const yy = String(d.getUTCFullYear()).slice(2);
    dates.push(`${yy}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`);
  }
  return dates;
}

async function fetchDay(yymmdd) {
  const url = `https://www.spc.noaa.gov/climo/reports/${yymmdd}_rpts_filtered_torn.csv`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null; // very common - most days have zero tornado reports
    const text = await res.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return null; // header only, no actual reports
    return lines.slice(1); // drop SPC's own header row, we write our own
  } catch {
    return null;
  }
}

async function main() {
  const year = new Date().getUTCFullYear();
  const dates = datesSinceJan1(year);
  console.log(`Fetching SPC daily preliminary tornado reports for ${dates.length} days of ${year}...`);

  const rows = [];
  let daysWithReports = 0;
  for (const yymmdd of dates) {
    const lines = await fetchDay(yymmdd);
    if (lines) {
      daysWithReports++;
      for (const line of lines) rows.push(`${yymmdd},${line}`);
    }
    // Small delay between requests - this is a free government data
    // source, no need to hammer it just because we can.
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`${daysWithReports}/${dates.length} days had reports, ${rows.length} total rows.`);
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(
    OUT_PATH,
    "report_date,time,f_scale,location,county,state,lat,lon,comments\n" + rows.join("\n"),
    "utf-8"
  );
  console.log(`Saved ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
