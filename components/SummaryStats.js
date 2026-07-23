"use client";

import { efLabel } from "../lib/colors";

export default function SummaryStats({ stats }) {
  if (!stats) return null;

  return (
    <div style={styles.wrap}>
      <Stat label="Tornadoes" value={stats.tornadoCount} />
      <Stat label="Hurricanes" value={stats.hurricaneCount} />
      <Stat label="Injuries" value={stats.injuries} />
      <Stat label="Fatalities" value={stats.fatalities} />
      <Stat label="Highest EF" value={efLabel(stats.highestEF)} />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <div style={styles.value} className="mono">
        {value ?? "—"}
      </div>
      <div style={styles.label}>{label}</div>
    </div>
  );
}

const styles = {
  wrap: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    zIndex: 9,
    display: "flex",
    justifyContent: "center",
    gap: 6,
    padding: "0 14px",
    pointerEvents: "none",
  },
  stat: {
    background: "rgba(21, 22, 28, 0.85)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    padding: "5px 10px",
    textAlign: "center",
    minWidth: 58,
  },
  value: {
    fontSize: 14,
    color: "var(--accent-secondary)",
    lineHeight: 1.2,
  },
  label: {
    fontSize: 9,
    color: "var(--text-tertiary)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
};
