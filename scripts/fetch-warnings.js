// Auto-updating warning polygon data from IEM's documented WFS archive.
// Loops one request per day (this endpoint is date-keyed, not
// range-queryable) over a rolling recent window, refreshed daily by the
// same cron as the rest of update:all.
//
// SCOPE NOTE: only covers a 100-day rolling window (enough for
// Yesterday/Last 3/7/30/90 Days in the UI) - a full 6-month or 1-year
// window would mean 180-365 individual day-requests per pipeline run,
// which starts to be a real runtime/data-volume cost for a daily cron
// job. If 6-month/1-year views turn out to matter, this can be
// extended, but starting conservative rather than guessing that's fine.
import fs from "node:fs";
import path from "node:path";

const WINDOW_DAYS = 100;

function isoDateDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function fetchDay(dateStr) {
  try {
    const url = `https://mesonet.agron.iastate.edu/wfs/ww.php?date=${dateStr}&format=geojson`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (data?.type !== "FeatureCollection") return [];
    return data.features.map((f) => ({
      ...f,
      properties: { ...f.properties, warning_date: dateStr },
    }));
  } catch {
    return [];
  }
}

async function main() {
  console.log(`Fetching IEM warning polygons for the last ${WINDOW_DAYS} days...`);
  const allFeatures = [];

  for (let i = 0; i < WINDOW_DAYS; i++) {
    const dateStr = isoDateDaysAgo(i);
    const features = await fetchDay(dateStr);
    if (features.length > 0) {
      console.log(`  ${dateStr}: ${features.length} warnings`);
    }
    allFeatures.push(...features);
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`Total: ${allFeatures.length} warning polygons`);
  const outDir = path.join(process.cwd(), "data", "raw");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "warnings-recent.json"),
    JSON.stringify({ type: "FeatureCollection", features: allFeatures }),
    "utf-8"
  );
  console.log("Saved data/raw/warnings-recent.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
