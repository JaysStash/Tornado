"use client";

import { useEffect, useState } from "react";
import {
  loadTornadoesInRange,
  loadHurricanesInRange,
  loadAllData,
} from "../lib/dataLoader";
import { tornadoStats, hurricaneStats, hurricaneTrackLengthMiles } from "../lib/stats";
import { efLabel, categoryLabel } from "../lib/colors";

export default function StatsPanel({ selectedEvent, filters }) {
  const [scope, setScope] = useState(selectedEvent ? "event" : "range");
  const [loading, setLoading] = useState(false);
  const [tStats, setTStats] = useState(null);
  const [hStats, setHStats] = useState(null);

  useEffect(() => {
    if (selectedEvent) setScope("event");
  }, [selectedEvent]);

  useEffect(() => {
    if (scope === "event") return;
    let cancelled = false;

    async function run() {
      setLoading(true);
      const data =
        scope === "alltime"
          ? await loadAllData()
          : {
              tornadoes: await loadTornadoesInRange(filters.startYear, filters.endYear),
              hurricanes: await loadHurricanesInRange(filters.startYear, filters.endYear),
            };
      if (cancelled) return;
      setTStats(tornadoStats(data.tornadoes));
      setHStats(hurricaneStats(data.hurricanes));
      setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [scope, filters.startYear, filters.endYear]);

  return (
    <div>
      <div style={styles.tabs}>
        {selectedEvent && (
          <button
            style={{ ...styles.tab, ...(scope === "event" ? styles.tabActive : {}) }}
            onClick={() => setScope("event")}
          >
            Selected event
          </button>
        )}
        <button
          style={{ ...styles.tab, ...(scope === "range" ? styles.tabActive : {}) }}
          onClick={() => setScope("range")}
        >
          {filters.startYear}–{filters.endYear}
        </button>
        <button
          style={{ ...styles.tab, ...(scope === "alltime" ? styles.tabActive : {}) }}
          onClick={() => setScope("alltime")}
        >
          All time
        </button>
      </div>

      {scope === "event" && selectedEvent && <EventDetail feature={selectedEvent} />}

      {scope !== "event" && loading && (
        <p style={{ color: "var(--text-secondary)" }}>Loading stats…</p>
      )}

      {scope !== "event" && !loading && tStats && hStats && (
        <AggregateStats tStats={tStats} hStats={hStats} />
      )}
    </div>
  );
}

function EventDetail({ feature }) {
  const p = feature.properties;
  if (p.event_type === "tornado") {
    return (
      <div style={styles.detailGrid} className="mono">
        <Row label="Date" value={p.date} />
        <Row label="State" value={p.state} />
        <Row label="Rating" value={efLabel(p.ef_rating)} />
        {p.preliminary && <Row label="Status" value="Preliminary (unsurveyed)" />}
        <Row label="Fatalities" value={p.fatalities} />
        <Row label="Injuries" value={p.injuries} />
        <Row label="Path length" value={p.length_miles ? `${p.length_miles} mi` : "—"} />
        <Row label="Path width" value={p.width_yards ? `${p.width_yards} yd` : "—"} />
        <Row
          label="Property loss"
          value={p.property_loss !== null ? `${p.property_loss} (as reported)` : "—"}
        />
        <Row
          label="Crop loss"
          value={p.crop_loss !== null ? `${p.crop_loss} (as reported)` : "—"}
        />
        <p style={styles.caveat}>
          Path shown is a straight line between touchdown and lift-off, per
          SPC's own database format — not the tornado's true curving ground
          track. Loss figures are as SPC reported them; SPC's dollar-value
          convention changed over the years, so cross-era comparisons aren't
          reliable without checking SPC's documentation.
        </p>
      </div>
    );
  }

  const length = Math.round(hurricaneTrackLengthMiles(feature));
  return (
    <div style={styles.detailGrid} className="mono">
      <Row label="Name" value={p.name || "Unnamed"} />
      <Row label="Year" value={p.year} />
      <Row label="Peak category" value={categoryLabel(p.category)} />
      {p.preliminary && <Row label="Status" value="Preliminary (season in progress)" />}
      <Row label="Max wind" value={p.max_wind_kt ? `${p.max_wind_kt} kt` : "—"} />
      <Row label="Min pressure" value={p.min_pressure_mb ? `${p.min_pressure_mb} mb` : "—"} />
      <Row label="Track length" value={`${length} mi`} />
      <Row label="Start" value={p.start_date} />
      <Row label="End" value={p.end_date} />
      <p style={styles.caveat}>
        No fatality or damage figures — HURDAT2 (this data's source) tracks
        position, wind, and pressure only, not casualties or cost.
      </p>
    </div>
  );
}

function AggregateStats({ tStats, hStats }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <StatGroup title={`Tornadoes (${tStats.totalCount.toLocaleString()})`}>
        <List title="Busiest years" items={tStats.busiestYears} />
        <List title="Least busy years" items={tStats.leastBusyYears} />
        <List title="Busiest months (all-time)" items={tStats.busiestMonths} />
        <List
          title="Top outbreak days"
          subtitle="Highest single-day tornado counts — not an official outbreak classification"
          items={tStats.topOutbreakDays}
        />
        <EventList title="Longest tracks" events={tStats.longestTracks} valueKey="length_miles" unit="mi" />
        <EventList title="Shortest tracks" events={tStats.shortestTracks} valueKey="length_miles" unit="mi" />
        <EventList title="Deadliest tornadoes" events={tStats.deadliestTornadoes} valueKey="fatalities" unit="deaths" />
        <List title="States with the most EF4+ tornadoes" items={tStats.statesWithMostViolentTornadoes} />
      </StatGroup>

      <StatGroup title={`Hurricanes (${hStats.totalCount.toLocaleString()})`}>
        <List title="Busiest years" items={hStats.busiestYears} />
        <List title="Least busy years" items={hStats.leastBusyYears} />
        <List title="Busiest months (all-time)" items={hStats.busiestMonths} />
        <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          No deadliest-hurricanes list — HURDAT2 doesn't include fatality data.
        </p>
      </StatGroup>
    </div>
  );
}

function StatGroup({ title, children }) {
  return (
    <div>
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

function List({ title, subtitle, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <div style={styles.listTitle}>{title}</div>
      {subtitle && <div style={styles.listSubtitle}>{subtitle}</div>}
      <ul style={styles.list} className="mono">
        {items.map(([label, count]) => (
          <li key={label} style={styles.listItem}>
            <span>{label}</span>
            <span style={{ color: "var(--accent)" }}>{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventList({ title, events, valueKey, unit }) {
  if (!events?.length) return null;
  const isHurricane = "length" in (events[0] || {});
  return (
    <div>
      <div style={styles.listTitle}>{title}</div>
      <ul style={styles.list} className="mono">
        {events.map((item, i) => {
          const f = isHurricane ? item.feature : item;
          const value = isHurricane ? Math.round(item.length) : f.properties[valueKey];
          const label = isHurricane
            ? `${f.properties.name || "Unnamed"} (${f.properties.year})`
            : `${f.properties.date} · ${f.properties.state} · ${efLabel(f.properties.ef_rating)}`;
          return (
            <li key={i} style={styles.listItem}>
              <span>{label}</span>
              <span style={{ color: "var(--accent)" }}>
                {value} {unit}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={styles.row}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span>{value ?? "—"}</span>
    </div>
  );
}

const styles = {
  tabs: {
    display: "flex",
    gap: 6,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  tab: {
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-secondary)",
    padding: "6px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
  tabActive: {
    borderColor: "var(--accent)",
    color: "var(--text-primary)",
  },
  detailGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    borderBottom: "1px solid var(--border-subtle)",
    padding: "5px 0",
  },
  caveat: {
    marginTop: 10,
    fontSize: 11.5,
    color: "var(--text-tertiary)",
    lineHeight: 1.5,
    fontFamily: "var(--font-body)",
  },
  listTitle: {
    fontSize: 12.5,
    color: "var(--text-secondary)",
    marginBottom: 6,
  },
  listSubtitle: {
    fontSize: 11,
    color: "var(--text-tertiary)",
    marginBottom: 6,
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12.5,
    gap: 10,
  },
};
