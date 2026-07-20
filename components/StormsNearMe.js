"use client";

import { useState } from "react";
import { loadAllData } from "../lib/dataLoader";
import { haversineMiles } from "../lib/stats";
import { efLabel, categoryLabel } from "../lib/colors";

const RADIUS_MILES = 60;

export default function StormsNearMe({ onFlyTo }) {
  const [status, setStatus] = useState("idle"); // idle | locating | loading | done | error
  const [results, setResults] = useState({ tornadoes: [], hurricanes: [] });
  const [errorMsg, setErrorMsg] = useState("");

  function findNearby() {
    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMsg("Geolocation isn't available in this browser.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const origin = [pos.coords.longitude, pos.coords.latitude];
        setStatus("loading");
        const { tornadoes, hurricanes } = await loadAllData();

        const nearbyTornadoes = tornadoes.filter((f) => {
          const p = f.properties;
          if (!p.start_lat || !p.start_lon) return false;
          return haversineMiles(origin, [p.start_lon, p.start_lat]) <= RADIUS_MILES;
        });

        const nearbyHurricanes = hurricanes.filter((f) =>
          (f.geometry.coordinates || []).some(
            (pt) => haversineMiles(origin, pt) <= RADIUS_MILES
          )
        );

        setResults({ tornadoes: nearbyTornadoes, hurricanes: nearbyHurricanes });
        setStatus("done");
        onFlyTo?.(origin);
      },
      (err) => {
        setStatus("error");
        setErrorMsg(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied."
            : "Couldn't get your location."
        );
      }
    );
  }

  if (status === "idle" || status === "error") {
    return (
      <div>
        <button style={styles.checkButton} onClick={findNearby}>
          Show storm history within {RADIUS_MILES} miles of me
        </button>
        {status === "error" && (
          <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>{errorMsg}</p>
        )}
      </div>
    );
  }

  if (status === "locating" || status === "loading") {
    return (
      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        {status === "locating" ? "Getting your location…" : "Searching the full archive…"}
      </p>
    );
  }

  const total = results.tornadoes.length + results.hurricanes.length;
  if (total === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Nothing recorded within {RADIUS_MILES} miles - genuinely quiet territory, historically.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
        {total} event{total === 1 ? "" : "s"} within {RADIUS_MILES} miles, all-time:
      </p>
      <ul style={styles.list} className="mono">
        {results.tornadoes.slice(0, 20).map((f) => (
          <li key={f.properties.id} style={styles.item}>
            {f.properties.date} · {efLabel(f.properties.ef_rating)}
          </li>
        ))}
        {results.hurricanes.slice(0, 20).map((f) => (
          <li key={f.properties.id} style={styles.item}>
            {f.properties.name || "Unnamed"} ({f.properties.year}) · {categoryLabel(f.properties.category)}
          </li>
        ))}
      </ul>
    </div>
  );
}

const styles = {
  checkButton: {
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--accent-dim)",
    borderRadius: "var(--radius-sm)",
    color: "var(--accent)",
    padding: "9px 14px",
    fontSize: 13,
    cursor: "pointer",
    width: "100%",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    maxHeight: 220,
    overflowY: "auto",
  },
  item: {
    fontSize: 12,
    background: "var(--bg-panel-raised)",
    borderRadius: "var(--radius-sm)",
    padding: "6px 9px",
  },
};
