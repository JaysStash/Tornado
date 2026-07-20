"use client";

import { FLAGSHIP_EVENTS } from "../lib/flagshipEvents";

export default function FlagshipEvents({ onFiltersChange, onClose }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
        Manually curated highlights - there's no clean bulk feed for event write-ups or photos,
        so this list grows by hand rather than automatically.
      </p>
      {FLAGSHIP_EVENTS.map((ev) => (
        <div key={ev.id} style={styles.card}>
          <h3 style={styles.title}>{ev.title}</h3>
          <p style={styles.blurb}>{ev.blurb}</p>
          <div style={styles.linkRow}>
            {ev.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener" style={styles.link}>
                {l.label} →
              </a>
            ))}
          </div>
          <button
            style={styles.jumpButton}
            onClick={() => {
              onFiltersChange((f) => ({ ...f, startYear: ev.yearRange[0], endYear: ev.yearRange[1] }));
              onClose?.();
            }}
          >
            Jump timeline to {ev.yearRange[0]}
          </button>
        </div>
      ))}
    </div>
  );
}

const styles = {
  card: {
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-md)",
    padding: 14,
  },
  title: {
    fontSize: 16,
    marginBottom: 6,
  },
  blurb: {
    fontSize: 12.5,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    margin: "0 0 10px",
  },
  linkRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  link: {
    fontSize: 12,
    color: "var(--accent-secondary)",
    textDecoration: "none",
  },
  jumpButton: {
    background: "none",
    border: "1px solid var(--accent-dim)",
    borderRadius: "var(--radius-sm)",
    color: "var(--accent)",
    padding: "5px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
};
