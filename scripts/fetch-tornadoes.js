// Downloads the SPC severe weather database (tornadoes only) and caches it raw.
// Source: SPC Storm Data - public domain.
// Docs: https://www.spc.noaa.gov/wcm/#data
import fs from "node:fs";
import path from "node:path";

const SPC_TORNADO_CSV_URL = "https://www.spc.noaa.gov/wcm/data/1950-2024_torn.csv";
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
