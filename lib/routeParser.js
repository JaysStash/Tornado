// Parses a chaser's uploaded GPX or KML route file into a GeoJSON
// LineString. Uses the browser's native DOMParser - no library needed,
// keeps this dependency-free.

export function parseRouteFile(text, filename) {
  const isKML = /\.kml$/i.test(filename) || text.includes("<kml");
  return isKML ? parseKML(text) : parseGPX(text);
}

function parseGPX(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const errorNode = doc.querySelector("parsererror");
  if (errorNode) throw new Error("Couldn't parse that GPX file - is it valid?");

  const points = [...doc.querySelectorAll("trkpt, rtept")];
  if (points.length === 0) {
    throw new Error("No track points found in that GPX file.");
  }

  const coordinates = points.map((pt) => {
    const lat = parseFloat(pt.getAttribute("lat"));
    const lon = parseFloat(pt.getAttribute("lon"));
    return [lon, lat];
  });

  const times = points
    .map((pt) => pt.querySelector("time")?.textContent)
    .filter(Boolean);

  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties: {
      point_count: coordinates.length,
      start_time: times[0] || null,
      end_time: times[times.length - 1] || null,
    },
  };
}

function parseKML(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const errorNode = doc.querySelector("parsererror");
  if (errorNode) throw new Error("Couldn't parse that KML file - is it valid?");

  const coordsNodes = [...doc.querySelectorAll("LineString > coordinates, coordinates")];
  if (coordsNodes.length === 0) {
    throw new Error("No LineString coordinates found in that KML file.");
  }

  // KML allows multiple LineStrings (e.g. a route split into segments) -
  // concatenate them in document order into one continuous track.
  const coordinates = coordsNodes.flatMap((node) =>
    node.textContent
      .trim()
      .split(/\s+/)
      .map((triplet) => {
        const [lon, lat] = triplet.split(",").map(Number);
        return [lon, lat];
      })
  );

  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties: {
      point_count: coordinates.length,
      start_time: null,
      end_time: null,
    },
  };
}
