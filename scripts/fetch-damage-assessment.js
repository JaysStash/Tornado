// Auto-updating damage assessment data from NOAA's DAT (Damage
// Assessment Toolkit). Unlike the historical tornado/hurricane
// pipeline, this only covers a recent rolling window - DAT is an
// operational/recent tool, not a deep historical archive (its own docs
// note it defaults to showing the preceding two weeks). Refreshed daily
// by the same cron that runs the rest of update:all, so this is
// genuinely auto-updating, not just fetched live in the browser.
//
// Layers confirmed via the service's own REST metadata
// (services.dat.noaa.gov/.../DamageViewer/FeatureServer/layers):
//   0 = Damage Points SDE   (esriGeometryPoint)
//   1 = Damage Lines SDE    (esriGeometryPolyline)
//   2 = Damage Polygons SDE (esriGeometryPolygon) - styled by efscale,
//       this is the actual damage-swath shape (varying width along the
//       path), not just a uniform-width line.
import fs from "node:fs";
import path from "node:path";

const BASE_URL =
  "https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit/DamageViewer/FeatureServer";

const WINDOW_DAYS = 400; // a bit over a year - covers every quick-range preset in the UI
const PAGE_SIZE = 2000; // matches the server's own MaxRecordCount

function isoDateDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function fetchLayer(layerId) {
  const sinceDate = isoDateDaysAgo(WINDOW_DAYS);
  const where = encodeURIComponent(`stormdate >= DATE '${sinceDate}'`);
  let offset = 0;
  const allFeatures = [];

  while (true) {
    const url =
      `${BASE_URL}/${layerId}/query?where=${where}&outFields=*&f=geojson` +
      `&resultOffset=${offset}&resultRecordCount=${PAGE_SIZE}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  layer ${layerId}: request failed at offset ${offset} (${res.status}), stopping`);
      break;
    }
    const data = await res.json();
    const features = data.features || [];
    allFeatures.push(...features);
    console.log(`  layer ${layerId}: +${features.length} (total ${allFeatures.length})`);

    if (features.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
    await new Promise((r) => setTimeout(r, 200)); // be reasonable about pacing
  }

  return allFeatures;
}

async function main() {
  console.log(`Fetching DAT damage data for the last ${WINDOW_DAYS} days...`);
  const outDir = path.join(process.cwd(), "data", "raw");
  fs.mkdirSync(outDir, { recursive: true });

  const layers = [
    { id: 0, name: "points" },
    { id: 1, name: "lines" },
    { id: 2, name: "polygons" },
  ];

  for (const layer of layers) {
    console.log(`Layer ${layer.id} (${layer.name}):`);
    try {
      const features = await fetchLayer(layer.id);
      fs.writeFileSync(
        path.join(outDir, `dat-${layer.name}.json`),
        JSON.stringify({ type: "FeatureCollection", features }),
        "utf-8"
      );
      console.log(`  saved ${features.length} ${layer.name}`);
    } catch (err) {
      console.log(`  ${layer.name} failed: ${err.message} - continuing with other layers`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
