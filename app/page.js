"use client";

import { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import MenuPanel from "../components/MenuPanel";
import TracksView from "../components/TracksView";
import WarningsView from "../components/WarningsView";
import { loadDamageSummary } from "../lib/dataLoader";

const CURRENT_YEAR = new Date().getFullYear();

export default function Page() {
  const [view, setView] = useState("tracks"); // "tracks" | "warnings"
  const [fullscreen, setFullscreen] = useState(false);
  const [filters, setFilters] = useState({
    startYear: CURRENT_YEAR - 15,
    endYear: CURRENT_YEAR,
    showTornadoes: true,
    showHurricanes: true,
    efRatings: null, // null = show all ratings
    categories: null,
    states: new Set(),
    showChaserRoutes: true,
    chaserNameFilter: "",
    showDamagePoints: false,
    minRating: -1, // -1 = "All"
    minCategory: -1,
    dateFrom: null,
    activeDatePreset: null,
  });
  const [scrubYear, setScrubYear] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTab, setMenuTab] = useState("filters");
  const [loading, setLoading] = useState(false);
  const [flyToLocation, setFlyToLocation] = useState(null);
  const [chaseRouteCount, setChaseRouteCount] = useState(null);
  const [summaryStats, setSummaryStats] = useState(null);
  const [tornadoYearCounts, setTornadoYearCounts] = useState({});
  const [hurricaneYearCounts, setHurricaneYearCounts] = useState({});
  const [damageSummary, setDamageSummary] = useState(null);

  useEffect(() => {
    fetch("/data/tornadoes/year-counts.json")
      .then((r) => r.json())
      .then(setTornadoYearCounts)
      .catch(() => {});
    fetch("/data/hurricanes/year-counts.json")
      .then((r) => r.json())
      .then(setHurricaneYearCounts)
      .catch(() => {});
    loadDamageSummary()
      .then(setDamageSummary)
      .catch(() => {});
  }, []);

  function handleFeatureClick(feature) {
    setSelectedEvent(feature);
    setMenuTab("stats");
    setMenuOpen(true);
  }

  return (
    <main className="app-main-scroll">
      {!fullscreen && (
        <>
          <TopBar
            onMenuClick={() => setMenuOpen((o) => !o)}
            onProfileClick={() => {
              setMenuTab("chasers");
              setMenuOpen(true);
            }}
            loading={loading}
          />
          <div className="view-switcher">
            <button
              className={`view-tab${view === "tracks" ? " active" : ""}`}
              onClick={() => setView("tracks")}
            >
              Tornado &amp; Hurricane History
            </button>
            <button
              className={`view-tab${view === "warnings" ? " active" : ""}`}
              onClick={() => setView("warnings")}
            >
              Warning Polygon Maps
            </button>
          </div>
        </>
      )}

      {view === "tracks" && (
        <TracksView
          filters={filters}
          onFiltersChange={setFilters}
          scrubYear={scrubYear}
          onScrubYearChange={(updater) =>
            setScrubYear((prev) => (typeof updater === "function" ? updater(prev) : updater))
          }
          onFeatureClick={handleFeatureClick}
          flyToLocation={flyToLocation}
          summaryStats={summaryStats}
          onSummaryStatsChange={setSummaryStats}
          onChaseRouteCountChange={setChaseRouteCount}
          onLoadingChange={setLoading}
          tornadoYearCounts={tornadoYearCounts}
          hurricaneYearCounts={hurricaneYearCounts}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((f) => !f)}
          damageSummary={damageSummary}
        />
      )}

      {view === "warnings" && <WarningsView />}

      <MenuPanel
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        selectedEvent={selectedEvent}
        onFlyTo={setFlyToLocation}
        tab={menuTab}
        onTabChange={setMenuTab}
        chaseRouteCount={chaseRouteCount}
      />
    </main>
  );
}
