"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASE_STYLE_URL, tuneStyle } from "../lib/mapStyle";
import { loadRecentWarnings } from "../lib/dataLoader";

const TIME_RANGES = [
  ["Yesterday", 1],
  ["Last 3 Days", 3],
  ["Last 7 Days", 7],
  ["Last 30 Days", 30],
  ["Last 90 Days", 90],
];

function emptyFC() {
  return { type: "FeatureCollection", features: [] };
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function WarningsView() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const allWarningsRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [rangeDays, setRangeDays] = useState(1);
  const [counts, setCounts] = useState({ tornado: 0, severe: 0 });
  const [status, setStatus] = useState("loading"); // loading | ok | error

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const res = await fetch(BASE_STYLE_URL);
      const rawStyle = await res.json();
      if (cancelled) return;
      const style = tuneStyle(rawStyle);

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [-95, 39],
        zoom: 3,
        minZoom: 2,
        maxZoom: 12,
        preserveDrawingBuffer: true, // needed for the canvas image-export button
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        if (cancelled) return;
        map.addSource("warnings", { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: "warnings-fill",
          type: "fill",
          source: "warnings",
          paint: {
            "fill-color": ["match", ["coalesce", ["get", "phenomena"], ""], "TO", "#DC2626", "SV", "#EAB308", "#8B93E8"],
            "fill-opacity": 0.35,
          },
        });
        map.addLayer({
          id: "warnings-line",
          type: "line",
          source: "warnings",
          paint: {
            "line-color": ["match", ["coalesce", ["get", "phenomena"], ""], "TO", "#DC2626", "SV", "#EAB308", "#8B93E8"],
            "line-width": 1.5,
          },
        });
        mapRef.current = map;
        setReady(true);
      });
    }
    init();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadRecentWarnings()
      .then((data) => {
        if (cancelled) return;
        allWarningsRef.current = data.features || [];
        setStatus("ok");
        applyRange();
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function applyRange() {
    if (!mapRef.current) return;
    const cutoff = isoDaysAgo(rangeDays);
    const filtered = allWarningsRef.current.filter((f) => (f.properties.warning_date || "") >= cutoff);
    mapRef.current.getSource("warnings")?.setData({ type: "FeatureCollection", features: filtered });
    const tornado = filtered.filter((f) => f.properties.phenomena === "TO").length;
    const severe = filtered.filter((f) => f.properties.phenomena === "SV").length;
    setCounts({ tornado, severe });
  }

  useEffect(() => {
    if (ready && status === "ok") applyRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays, ready, status]);

  function downloadImage() {
    const map = mapRef.current;
    if (!map) return;
    const link = document.createElement("a");
    link.download = `storm-archive-warnings-${isoDaysAgo(0)}.png`;
    link.href = map.getCanvas().toDataURL("image/png");
    link.click();
  }

  return (
    <div>
      <div style={styles.controlRow}>
        {TIME_RANGES.map(([label, days]) => (
          <button
            key={label}
            onClick={() => setRangeDays(days)}
            style={{ ...styles.pill, ...(rangeDays === days ? styles.pillActive : {}) }}
          >
            {label}
          </button>
        ))}
      </div>
      <p style={styles.note}>
        Auto-updated daily from IEM's warning archive - covers up to the last 100 days. 6-month
        and 1-year views aren't included yet (see README for why).
      </p>

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statValue} className="mono">
            {counts.tornado}
          </div>
          <div style={styles.statLabel}>Tornado Warnings</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue} className="mono">
            {counts.severe}
          </div>
          <div style={styles.statLabel}>Severe Warnings</div>
        </div>
      </div>

      <div style={styles.mapWrap}>
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
        <div style={styles.legend}>
          <div style={styles.legendRow}>
            <span style={{ ...styles.legendDot, background: "#DC2626" }} />
            Tornado Warning
          </div>
          <div style={styles.legendRow}>
            <span style={{ ...styles.legendDot, background: "#EAB308" }} />
            Severe Thunderstorm Warning
          </div>
        </div>
        <button style={styles.downloadBtn} onClick={downloadImage}>
          Download Image
        </button>
      </div>

      {status === "error" && (
        <p style={{ color: "var(--danger)", fontSize: 12.5, padding: "0 16px" }}>
          Couldn't load warning data right now - try again shortly.
        </p>
      )}

      <p style={styles.attribution}>Data: NOAA/NWS · Warning archive: Iowa Environmental Mesonet (IEM)</p>
    </div>
  );
}

const styles = {
  controlRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    padding: "12px 16px 4px",
  },
  pill: {
    background: "var(--bg-panel-raised)",
    border: "1.5px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-secondary)",
    padding: "6px 11px",
    fontSize: 12.5,
    cursor: "pointer",
  },
  pillActive: {
    borderColor: "var(--accent)",
    color: "var(--text-primary)",
    background: "var(--bg-panel)",
  },
  note: {
    fontSize: 11.5,
    color: "var(--text-tertiary)",
    padding: "4px 16px 8px",
    lineHeight: 1.5,
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    padding: "0 16px 12px",
  },
  statCard: {
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-md)",
    padding: "14px 12px",
    textAlign: "center",
  },
  statValue: {
    fontSize: 26,
    color: "var(--accent-secondary)",
  },
  statLabel: {
    marginTop: 4,
    fontSize: 11,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  mapWrap: {
    position: "relative",
    height: "55vh",
    margin: "0 16px",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
    border: "1px solid var(--border-subtle)",
  },
  legend: {
    position: "absolute",
    top: 10,
    left: 10,
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    padding: "8px 10px",
    zIndex: 5,
  },
  legendRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    color: "var(--text-secondary)",
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
  },
  downloadBtn: {
    position: "absolute",
    bottom: 10,
    left: 10,
    zIndex: 5,
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--accent-dim)",
    borderRadius: "var(--radius-sm)",
    color: "var(--accent)",
    padding: "7px 12px",
    fontSize: 12.5,
    cursor: "pointer",
  },
  attribution: {
    fontSize: 10.5,
    color: "var(--text-tertiary)",
    padding: "10px 16px 20px",
  },
};
