"use client";

import { efLabel } from "../lib/colors";

export default function StatCards({ stats }) {
  return (
    <div style={styles.grid}>
      <Card label="Tornadoes" value={stats?.tornadoCount} />
      <Card label="Injuries" value={stats?.injuries} />
      <Card label="Fatalities" value={stats?.fatalities} />
      <Card label="Highest EF" value={stats ? efLabel(stats.highestEF) : null} />
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div style={styles.card}>
      <div style={styles.value} className="mono">
        {value ?? "—"}
      </div>
      <div style={styles.label}>{label}</div>
    </div>
  );
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    padding: "0 16px",
  },
  card: {
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-md)",
    padding: "16px 12px",
    textAlign: "center",
  },
  value: {
    fontSize: 30,
    color: "var(--accent-secondary)",
    lineHeight: 1.15,
  },
  label: {
    marginTop: 4,
    fontSize: 11.5,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
};
