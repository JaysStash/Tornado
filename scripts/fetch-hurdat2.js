// Downloads NHC's HURDAT2 best-track database and caches it raw.
// Source: National Hurricane Center - public domain.
// Docs: https://www.nhc.noaa.gov/data/#hurdat
//
// NOTE: NHC renames this file each year to include the latest season
// (e.g. hurdat2-1851-2024-*.txt -> hurdat2-1851-2025-*.txt). If this
// URL 404s, check https://www.nhc.noaa.gov/data/#hurdat for the
// current filename and update HURDAT2_URL below.
import fs from "node:fs";
import path from "node:path";

const HURDAT2_URL = "https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2024-040225.txt";
const OUT_PATH = path.join(process.cwd(), "data", "raw", "hurdat2.txt");

async function main() {
  console.log(`Fetching HURDAT2 from ${HURDAT2_URL} ...`);
  const res = await fetch(HURDAT2_URL);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch HURDAT2 (${res.status} ${res.statusText}). ` +
      `The filename likely changed for the new season - check https://www.nhc.noaa.gov/data/#hurdat`
    );
  }
  const text = await res.text();
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, text, "utf-8");
  console.log(`Saved ${OUT_PATH} (${(text.length / 1024).toFixed(0)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
