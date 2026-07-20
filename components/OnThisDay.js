"use client";

import { useState } from "react";
import { loadAllData } from "../lib/dataLoader";
import { efLabel, categoryLabel } from "../lib/colors";

export default function OnThisDay() {
  const [status, setStatus] = useState("idle"); // idle | loading | done
  const [matches, setMatches] = useState({ tornadoes: [], hurricanes: [] });

  async function check() {
    setStatus("loading");
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");

    const { tornadoes, hurricanes } = await loadAllData();

    const tornadoMatches = tornadoes.filter((f) => f.properties.date?.slice(5, 10) === `${mm}-${dd}`);
    const hurricaneMatches = hurricanes.filter(
      (f) => f.properties.start_date?.slice(4, 6) === mm && f.properties.start_date?.slice(6, 8) === dd
    );

    setMatches({ tornadoes: tornadoMatches, hurricanes: hurricaneMatches });
    setStatus("done");
  }

  if (status === "idle") {
    return (
      <button style={styles.checkButton} onClick={check}>
        What happened on this day in history?
      </button>
    );
  }

  if (status === "loading") {
    return <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Checking the full archive…</p>;
  }

  const total = matches.tornadoes.length + matches.hurricanes.length;
  if (total === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Nothing recorded for this exact date - a quiet one, historically.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
        {total} event{total === 1 ? "" : "s"} recorded on this calendar date across all years:
      </p>
      <ul style={styles.list} className="mono">
        {matches.tornadoes.slice(0, 15).map((f) => (
          <li key={f.properties.id} style={styles.item}>
            {f.properties.date} · {f.properties.state} · {efLabel(f.properties.ef_rating)}
          </li>
        ))}
        {matches.hurricanes.slice(0, 15).map((f) => (
          <li key={f.properties.id} style={styles.item}>
            {f.properties.name || "Unnamed"} ({f.properties.year}) · {categoryLabel(f.properties.category)}
          </li>
        ))}
      </ul>
      {total > 30 && (
        <p style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
          Showing the first 30 of {total}.
        </p>
      )}
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
