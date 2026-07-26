"use client";

import { useState } from "react";
import { EF_COLORS, CATEGORY_COLORS, efLabel, categoryLabel } from "../lib/colors";

export default function Legend() {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button style={styles.chip} onClick={() => setOpen(true)}>
        Legend
      </button>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Legend</span>
        <button style={styles.closeBtn} onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
      <div style={styles.group}>
        {[-1, 0, 1, 2, 3, 4, 5].map((r) => (
          <div key={r} style={styles.row}>
            <span style={{ ...styles.dot, background: EF_COLORS[r] }} />
            {efLabel(r === -1 ? null : r)}
          </div>
        ))}
      </div>
      <div style={{ ...styles.group, marginTop: 8 }}>
        {[-1, 0, 1, 2, 3, 4, 5].map((c) => (
          <div key={c} style={styles.row}>
            <span style={{ ...styles.dot, background: CATEGORY_COLORS[c] }} />
            {categoryLabel(c === -1 ? null : c)}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  chip: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 6,
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-secondary)",
    padding: "5px 10px",
    fontSize: 11,
    cursor: "pointer",
  },
  panel: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 6,
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-md)",
    padding: "10px 12px",
    width: 150,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-tertiary)",
    fontSize: 12,
    cursor: "pointer",
  },
  group: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    color: "var(--text-secondary)",
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    flexShrink: 0,
  },
};
