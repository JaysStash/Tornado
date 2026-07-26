"use client";

import { useState } from "react";
import MapView from "./MapView";
import StatCards from "./StatCards";
import QuickFilterBar from "./QuickFilterBar";
import Timeline from "./Timeline";
import Legend from "./Legend";

const CURRENT_YEAR = new Date().getFullYear();

export default function TracksView({
  filters,
  onFiltersChange,
  scrubYear,
  onScrubYearChange,
  onFeatureClick,
  flyToLocation,
  summaryStats,
  onSummaryStatsChange,
  onChaseRouteCountChange,
  onLoadingChange,
  tornadoYearCounts,
  hurricaneYearCounts,
  fullscreen,
  onToggleFullscreen,
  damageSummary,
}) {
  const trackCount = (summaryStats?.tornadoCount ?? 0) + (summaryStats?.hurricaneCount ?? 0);

  return (
    <div>
      <div style={{ paddingTop: 12 }}>
        <StatCards stats={summaryStats} />
      </div>
      <QuickFilterBar filters={filters} onChange={onFiltersChange} />

      <div style={{ ...styles.mapWrap, ...(fullscreen ? styles.mapWrapFullscreen : {}) }}>
        <MapView
          filters={filters}
          scrubYear={scrubYear}
          onFeatureClick={onFeatureClick}
          onLoadingChange={onLoadingChange}
          flyToLocation={flyToLocation}
          onChaseRouteCountChange={onChaseRouteCountChange}
          onSummaryStatsChange={onSummaryStatsChange}
        />
        <Legend />
        <button style={styles.fullscreenBtn} onClick={onToggleFullscreen}>
          {fullscreen ? "Exit Full Screen" : "Full Screen"}
        </button>
        <div style={styles.countOverlay}>
          {trackCount.toLocaleString()} tracks
          {damageSummary ? ` · ${damageSummary.pointCount.toLocaleString()} damage points` : ""}
        </div>
        <Timeline
          maxYear={CURRENT_YEAR}
          yearRange={[filters.startYear, filters.endYear]}
          onYearRangeChange={([startYear, endYear]) =>
            onFiltersChange({ ...filters, startYear, endYear, dateFrom: null, activeDatePreset: null })
          }
          scrubYear={scrubYear}
          onScrubYearChange={onScrubYearChange}
          tornadoCounts={tornadoYearCounts}
          hurricaneCounts={hurricaneYearCounts}
        />
      </div>
    </div>
  );
}

const styles = {
  mapWrap: {
    position: "relative",
    height: "60vh",
    margin: "4px 16px 16px",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
    border: "1px solid var(--border-subtle)",
  },
  mapWrapFullscreen: {
    position: "fixed",
    inset: 0,
    margin: 0,
    height: "100dvh",
    borderRadius: 0,
    border: "none",
    zIndex: 50,
  },
  fullscreenBtn: {
    position: "absolute",
    top: 10,
    right: 56,
    zIndex: 6,
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-secondary)",
    padding: "6px 10px",
    fontSize: 11.5,
    cursor: "pointer",
  },
  countOverlay: {
    position: "absolute",
    top: 52,
    left: 12,
    zIndex: 5,
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-secondary)",
    padding: "6px 10px",
    fontSize: 11.5,
  },
};
