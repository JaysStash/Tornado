// All aggregate stats are computed client-side against whatever feature
// arrays are passed in (a single year, a decade, or the full dataset via
// loadAllData()). Nothing here hits a network or database.

export function haversineMiles([lon1, lat1], [lon2, lat2]) {
  const R = 3958.8; // miles
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export function hurricaneTrackLengthMiles(feature) {
  const coords = feature.geometry?.coordinates ?? [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineMiles(coords[i - 1], coords[i]);
  }
  return total;
}

function yearOf(dateStr) {
  return dateStr ? parseInt(dateStr.slice(0, 4), 10) : null;
}
function monthOf(dateStr) {
  return dateStr ? parseInt(dateStr.slice(5, 7), 10) : null;
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (key === null || key === undefined) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function topEntries(counts, n, direction = "desc") {
  const entries = [...counts.entries()];
  entries.sort((a, b) => (direction === "desc" ? b[1] - a[1] : a[1] - b[1]));
  return entries.slice(0, n);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function tornadoStats(features) {
  const byYear = countBy(features, (f) => yearOf(f.properties.date));
  const byMonth = countBy(features, (f) => monthOf(f.properties.date));
  const byDay = countBy(features, (f) => f.properties.date);
  const byState = countBy(
    features.filter((f) => (f.properties.ef_rating ?? 0) >= 4),
    (f) => f.properties.state
  );

  const sortedByLength = [...features]
    .filter((f) => f.properties.length_miles)
    .sort((a, b) => b.properties.length_miles - a.properties.length_miles);

  const sortedByFatalities = [...features]
    .filter((f) => f.properties.fatalities > 0)
    .sort((a, b) => b.properties.fatalities - a.properties.fatalities);

  return {
    totalCount: features.length,
    busiestYears: topEntries(byYear, 5, "desc"),
    leastBusyYears: topEntries(byYear, 5, "asc"),
    busiestMonths: topEntries(byMonth, 12, "desc").map(([m, count]) => [
      MONTH_NAMES[m - 1],
      count,
    ]),
    // "Super outbreak" here means the single highest-count tornado days
    // in the dataset - a count-based heuristic, not an official outbreak
    // classification (real outbreak naming involves synoptic judgment
    // this data alone can't capture).
    topOutbreakDays: topEntries(byDay, 10, "desc"),
    longestTracks: sortedByLength.slice(0, 10),
    shortestTracks: sortedByLength.slice(-10).reverse(),
    deadliestTornadoes: sortedByFatalities.slice(0, 10),
    statesWithMostViolentTornadoes: topEntries(byState, 10, "desc"),
  };
}

export function hurricaneStats(features) {
  const byYear = countBy(features, (f) => f.properties.year);
  const byMonth = countBy(features, (f) => monthOf(f.properties.start_date));

  const withLength = features.map((f) => ({
    feature: f,
    length: hurricaneTrackLengthMiles(f),
  }));
  const sortedByLength = [...withLength].sort((a, b) => b.length - a.length);

  const sortedByIntensity = [...features].sort(
    (a, b) => (b.properties.max_wind_kt || 0) - (a.properties.max_wind_kt || 0)
  );

  return {
    totalCount: features.length,
    busiestYears: topEntries(byYear, 5, "desc"),
    leastBusyYears: topEntries(byYear, 5, "asc"),
    busiestMonths: topEntries(byMonth, 12, "desc").map(([m, count]) => [
      MONTH_NAMES[m - 1],
      count,
    ]),
    longestTracks: sortedByLength.slice(0, 10),
    shortestTracks: sortedByLength.slice(-10).reverse(),
    mostIntense: sortedByIntensity.slice(0, 10),
    // Deliberately no "deadliest hurricanes" here - HURDAT2 (the source
    // this pipeline pulls) doesn't include fatality or damage figures at
    // all. That'd need a separate supplementary dataset; not fabricating
    // numbers to fill the gap.
  };
}
