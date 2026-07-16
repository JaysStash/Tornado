"use client";

import { useState } from "react";
import FilterPanel from "./FilterPanel";
import StatsPanel from "./StatsPanel";

export default function MenuPanel({ open, onClose, filters, onFiltersChange, selectedEvent }) {
  const [tab, setTab] = useState("filters");

  return (
    <div className={`menu-panel${open ? " open" : ""}`}>
      <div style={styles.header}>
        <div style={styles.tabRow}>
          <button
            style={{ ...styles.headerTab, ...(tab === "filters" ? styles.headerTabActive : {}) }}
            onClick={() => setTab("filters")}
          >
            Filters
          </button>
          <button
            style={{ ...styles.headerTab, ...(tab === "stats" ? styles.headerTabActive : {}) }}
            onClick={() => setTab("stats")}
          >
            Stats
          </button>
        </div>
        <button style={styles.closeButton} onClick={onClose} aria-label="Close menu">
          ✕
        </button>
      </div>

      <div style={styles.body}>
        {tab === "filters" ? (
          <FilterPanel filters={filters} onChange={onFiltersChange} />
        ) : (
          <StatsPanel selectedEvent={selectedEvent} filters={filters} />
        )}
      </div>
    </div>
  );
}

const styles = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: "1px solid var(--border-subtle)",
    position: "sticky",
    top: 0,
    background: "var(--bg-panel)",
  },
  tabRow: {
    display: "flex",
    gap: 6,
  },
  headerTab: {
    background: "none",
    border: "none",
    color: "var(--text-secondary)",
    fontFamily: "var(--font-display)",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    padding: "4px 8px",
    borderBottom: "2px solid transparent",
  },
  headerTabActive: {
    color: "var(--text-primary)",
    borderBottom: "2px solid var(--accent)",
  },
  closeButton: {
    background: "none",
    border: "none",
    color: "var(--text-secondary)",
    fontSize: 16,
    cursor: "pointer",
    padding: 6,
  },
  body: {
    padding: "16px",
  },
};
