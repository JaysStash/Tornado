// Fetches the decade-split GeoJSON produced by the Phase 1 pipeline
// (served from /data/... via the prebuild copy into public/data/).
// Caches everything in memory so switching filters doesn't refetch
// decades already loaded, and so the "all-time" stats view only ever
// pays the full-dataset cost once per session.

const cache = {
  tornadoIndex: null,
  hurricaneIndex: null,
  tornadoDecades: new Map(),
  hurricaneDecades: new Map(),
};

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

export async function getTornadoIndex() {
  if (!cache.tornadoIndex) {
    cache.tornadoIndex = await fetchJSON("/data/tornadoes/index.json");
  }
  return cache.tornadoIndex;
}

export async function getHurricaneIndex() {
  if (!cache.hurricaneIndex) {
    cache.hurricaneIndex = await fetchJSON("/data/hurricanes/index.json");
  }
  return cache.hurricaneIndex;
}

export async function getTornadoDecade(decade) {
  if (!cache.tornadoDecades.has(decade)) {
    const data = await fetchJSON(`/data/tornadoes/${decade}s.geojson`);
    cache.tornadoDecades.set(decade, data.features);
  }
  return cache.tornadoDecades.get(decade);
}

export async function getHurricaneDecade(decade) {
  if (!cache.hurricaneDecades.has(decade)) {
    const data = await fetchJSON(`/data/hurricanes/${decade}s.geojson`);
    cache.hurricaneDecades.set(decade, data.features);
  }
  return cache.hurricaneDecades.get(decade);
}

function decadesInRange(startYear, endYear) {
  const startDecade = Math.floor(startYear / 10) * 10;
  const endDecade = Math.floor(endYear / 10) * 10;
  const decades = [];
  for (let d = startDecade; d <= endDecade; d += 10) decades.push(d);
  return decades;
}

// Loads every tornado feature whose year falls within [startYear, endYear].
export async function loadTornadoesInRange(startYear, endYear) {
  const index = await getTornadoIndex();
  const available = index.decades.map(Number);
  const wanted = decadesInRange(startYear, endYear).filter((d) =>
    available.includes(d)
  );
  const chunks = await Promise.all(wanted.map(getTornadoDecade));
  return chunks.flat();
}

export async function loadHurricanesInRange(startYear, endYear) {
  const index = await getHurricaneIndex();
  const available = index.decades.map(Number);
  const wanted = decadesInRange(startYear, endYear).filter((d) =>
    available.includes(d)
  );
  const chunks = await Promise.all(wanted.map(getHurricaneDecade));
  return chunks.flat();
}

// Loads the entire dataset (both types, full history). Used for "all-time"
// stats. Expensive on first call - cached after that.
export async function loadAllData() {
  const [tornadoIndex, hurricaneIndex] = await Promise.all([
    getTornadoIndex(),
    getHurricaneIndex(),
  ]);
  const [tornadoes, hurricanes] = await Promise.all([
    Promise.all(tornadoIndex.decades.map((d) => getTornadoDecade(Number(d)))),
    Promise.all(hurricaneIndex.decades.map((d) => getHurricaneDecade(Number(d)))),
  ]);
  return { tornadoes: tornadoes.flat(), hurricanes: hurricanes.flat() };
}
