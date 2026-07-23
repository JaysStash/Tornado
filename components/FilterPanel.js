"use client";

import { EF_COLORS, CATEGORY_COLORS, efLabel, categoryLabel } from "../lib/colors";

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const EF_RATINGS = [0, 1, 2, 3, 4, 5];
const CATEGORIES = [0, 1, 2, 3, 4, 5];

function toggleInSet(set, value) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export default function FilterPanel({ filters, onChange, chaseRouteCount }) {
  function update(patch) {
    onChange({ ...filters, ...patch });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <section>
        <h3 style={styles.sectionTitle}>NWS damage points</h3>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={filters.showDamagePoints}
            onChange={(e) => update({ showDamagePoints: e.target.checked })}
          />
          Show live damage survey points
        </label>
        <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
          Live from NOAA's Damage Assessment Toolkit - recent/operational data, not a full
          historical archive.
        </p>
      </section>

      <section>
        <h3 style={styles.sectionTitle}>Event types</h3>
        <div style={styles.chipRow}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={filters.showTornadoes}
              onChange={(e) => update({ showTornadoes: e.target.checked })}
            />
            Tornadoes
          </label>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={filters.showHurricanes}
              onChange={(e) => update({ showHurricanes: e.target.checked })}
            />
            Hurricanes
          </label>
        </div>
      </section>

      <section>
        <h3 style={styles.sectionTitle}>EF rating</h3>
        <div style={styles.chipRow}>
          {EF_RATINGS.map((r) => {
            const active = filters.efRatings === null || filters.efRatings.has(r);
            return (
              <button
                key={r}
                onClick={() =>
                  update({
                    efRatings: toggleInSet(
                      filters.efRatings ?? new Set(EF_RATINGS),
                      r
                    ),
                  })
                }
                style={{
                  ...styles.chip,
                  borderColor: EF_COLORS[r],
                  opacity: active ? 1 : 0.35,
                }}
              >
                {efLabel(r)}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 style={styles.sectionTitle}>Hurricane category</h3>
        <div style={styles.chipRow}>
          {CATEGORIES.map((c) => {
            const active = filters.categories === null || filters.categories.has(c);
            return (
              <button
                key={c}
                onClick={() =>
                  update({
                    categories: toggleInSet(
                      filters.categories ?? new Set(CATEGORIES),
                      c
                    ),
                  })
                }
                style={{
                  ...styles.chip,
                  borderColor: CATEGORY_COLORS[c],
                  opacity: active ? 1 : 0.35,
                }}
              >
                {categoryLabel(c)}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 style={styles.sectionTitle}>
          Chaser routes {chaseRouteCount !== null && chaseRouteCount !== undefined ? `(${chaseRouteCount} approved)` : ""}
        </h3>
        <label style={{ ...styles.checkboxLabel, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={filters.showChaserRoutes}
            onChange={(e) => update({ showChaserRoutes: e.target.checked })}
          />
          Show submitted chase routes
        </label>
        {filters.showChaserRoutes && (
          <input
            placeholder="Filter by chaser name"
            value={filters.chaserNameFilter}
            onChange={(e) => update({ chaserNameFilter: e.target.value })}
            style={styles.textInput}
          />
        )}
      </section>

      <section>
        <h3 style={styles.sectionTitle}>
          States {filters.states?.size ? `(${filters.states.size} selected)` : "(all)"}
        </h3>
        <div style={styles.stateGrid}>
          {STATES.map((s) => {
            const active = !filters.states || filters.states.size === 0 || filters.states.has(s);
            return (
              <button
                key={s}
                onClick={() =>
                  update({ states: toggleInSet(filters.states ?? new Set(), s) })
                }
                style={{ ...styles.stateChip, opacity: active ? 1 : 0.35 }}
              >
                {s}
              </button>
            );
          })}
        </div>
        {filters.states?.size > 0 && (
          <button
            style={styles.clearStatesButton}
            onClick={() => update({ states: new Set() })}
          >
            Clear state selection
          </button>
        )}
      </section>
    </div>
  );
}

const styles = {
  sectionTitle: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--text-secondary)",
    marginBottom: 10,
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
  },
  textInput: {
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "6px 9px",
    fontSize: 13,
    width: "100%",
  },
  chip: {
    background: "var(--bg-panel-raised)",
    border: "1.5px solid",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "5px 10px",
    fontSize: 13,
    cursor: "pointer",
  },
  stateGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 6,
  },
  stateChip: {
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "5px 0",
    fontSize: 12,
    cursor: "pointer",
  },
  clearStatesButton: {
    marginTop: 10,
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
  },
};
