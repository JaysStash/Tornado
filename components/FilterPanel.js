"use client";

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

function toggleInSet(set, value) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// Event type, minimum rating/category, and damage-point toggles now
// live in QuickFilterBar (always visible above the map, matching the
// reference site) instead of here. This panel holds the less-common
// power-user filters: state selection and chaser-route filtering.
export default function FilterPanel({ filters, onChange, chaseRouteCount }) {
  function update(patch) {
    onChange({ ...filters, ...patch });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
