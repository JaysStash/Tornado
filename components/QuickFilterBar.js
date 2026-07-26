"use client";

import { EF_COLORS, CATEGORY_COLORS, efLabel, categoryLabel } from "../lib/colors";

const CURRENT_YEAR = new Date().getFullYear();

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const DATE_PRESETS = [
  ["30 days", 30],
  ["90 days", 90],
  ["6 months", 182],
  ["1 year", 365],
];

const RATING_PRESETS = [-1, 0, 1, 2, 3, 4, 5];

export default function QuickFilterBar({ filters, onChange }) {
  function update(patch) {
    onChange({ ...filters, ...patch });
  }

  function applyDatePreset(days) {
    const dateFrom = isoDaysAgo(days);
    const startYear = Math.min(filters.startYear, new Date(dateFrom).getFullYear());
    update({ dateFrom, activeDatePreset: days, startYear, endYear: CURRENT_YEAR });
  }

  function clearDatePreset() {
    update({ dateFrom: null, activeDatePreset: null });
  }

  return (
    <div style={styles.wrap}>
      <div>
        <div style={styles.sectionLabel}>Date range</div>
        <div style={styles.row}>
          {DATE_PRESETS.map(([label, days]) => (
            <button
              key={label}
              onClick={() => applyDatePreset(days)}
              style={{
                ...styles.pill,
                ...(filters.activeDatePreset === days ? styles.pillActive : {}),
              }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={clearDatePreset}
            style={{
              ...styles.pill,
              ...(!filters.activeDatePreset ? styles.pillActive : {}),
            }}
          >
            Custom
          </button>
        </div>
      </div>

      <div>
        <div style={styles.sectionLabel}>Minimum rating</div>
        <div style={styles.row}>
          {RATING_PRESETS.map((r) => (
            <button
              key={r}
              onClick={() => update({ minRating: r })}
              style={{
                ...styles.pill,
                ...(filters.minRating === r ? styles.pillActive : {}),
                borderColor: r === -1 ? styles.pill.borderColor : EF_COLORS[r],
              }}
            >
              {r === -1 ? (
                "All"
              ) : (
                <>
                  <span style={{ ...styles.dot, background: EF_COLORS[r] }} />
                  {efLabel(r)}
                  {r < 5 ? "+" : ""}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={styles.sectionLabel}>Min. hurricane category</div>
        <div style={styles.row}>
          {RATING_PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => update({ minCategory: c })}
              style={{
                ...styles.pill,
                ...(filters.minCategory === c ? styles.pillActive : {}),
                borderColor: c === -1 ? styles.pill.borderColor : CATEGORY_COLORS[c],
              }}
            >
              {c === -1 ? (
                "All"
              ) : (
                <>
                  <span style={{ ...styles.dot, background: CATEGORY_COLORS[c] }} />
                  {categoryLabel(c)}
                  {c < 5 ? "+" : ""}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={styles.sectionLabel}>Layers</div>
        <div style={styles.row}>
          <button
            onClick={() => update({ showTornadoes: !filters.showTornadoes })}
            style={{ ...styles.pill, ...(filters.showTornadoes ? styles.pillActiveBlue : {}) }}
          >
            Tracks
          </button>
          <button
            onClick={() => update({ showHurricanes: !filters.showHurricanes })}
            style={{ ...styles.pill, ...(filters.showHurricanes ? styles.pillActiveBlue : {}) }}
          >
            Hurricanes
          </button>
          <button
            onClick={() => update({ showDamagePoints: !filters.showDamagePoints })}
            style={{ ...styles.pill, ...(filters.showDamagePoints ? styles.pillActiveBlue : {}) }}
          >
            Damage Points
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: "0 16px 12px",
  },
  sectionLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-tertiary)",
    marginBottom: 6,
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
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
  pillActiveBlue: {
    borderColor: "var(--accent-secondary)",
    color: "var(--text-primary)",
    background: "var(--bg-panel)",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
  },
};
