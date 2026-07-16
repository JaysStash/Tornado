// Downloads the SPC severe weather database (tornadoes only) and caches it raw.
// Source: SPC Storm Data - public domain.
// Docs: https://www.spc.noaa.gov/wcm/#data
//
// Filename pattern confirmed 2026-07-13: 1950-{lastYear}_actual_tornadoes.csv
// (older tutorials/scripts reference "*_torn.csv" - that convention was
// retired; don't fall back to it if this URL ever 404s again.)
import fs from "node:fs";
import path from "node:path";

const SPC_TORNADO_CSV_URL = "https://www.spc.noaa.gov/wcm/data/1950-2025_actual_tornadoes.csv";
const OUT_PATH = path.join(process.cwd(), "data", "raw", "torn.csv");

async function main() {
  console.log(`Fetching SPC tornado database from ${SPC_TORNADO_CSV_URL} ...`);
  const res = await fetch(SPC_TORNADO_CSV_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch SPC tornado data: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, text, "utf-8");
  console.log(`Saved ${OUT_PATH} (${(text.length / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
