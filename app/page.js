"use client";

import { useEffect, useState } from "react";
import MapView from "../components/MapView";
import TopBar from "../components/TopBar";
import Timeline from "../components/Timeline";
import MenuPanel from "../components/MenuPanel";

const CURRENT_YEAR = new Date().getFullYear();

export default function Page() {
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
  });
  const [scrubYear, setScrubYear] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tornadoYearCounts, setTornadoYearCounts] = useState({});
  const [hurricaneYearCounts, setHurricaneYearCounts] = useState({});

  useEffect(() => {
    fetch("/data/tornadoes/year-counts.json")
      .then((r) => r.json())
      .then(setTornadoYearCounts)
      .catch(() => {});
    fetch("/data/hurricanes/year-counts.json")
      .then((r) => r.json())
      .then(setHurricaneYearCounts)
      .catch(() => {});
  }, []);

  function handleFeatureClick(feature) {
    setSelectedEvent(feature);
    setMenuOpen(true);
  }

  return (
    <main className="app-main">
      <MapView
        filters={filters}
        scrubYear={scrubYear}
        onFeatureClick={handleFeatureClick}
        onLoadingChange={setLoading}
      />

      <TopBar onMenuClick={() => setMenuOpen((o) => !o)} loading={loading} />

      <Timeline
        maxYear={CURRENT_YEAR}
        yearRange={[filters.startYear, filters.endYear]}
        onYearRangeChange={([startYear, endYear]) =>
          setFilters((f) => ({ ...f, startYear, endYear }))
        }
        scrubYear={scrubYear}
        onScrubYearChange={(updater) =>
          setScrubYear((prev) =>
            typeof updater === "function" ? updater(prev) : updater
          )
        }
        tornadoCounts={tornadoYearCounts}
        hurricaneCounts={hurricaneYearCounts}
      />

      <MenuPanel
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        selectedEvent={selectedEvent}
      />
    </main>
  );
}
