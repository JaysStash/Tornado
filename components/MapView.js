"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASE_STYLE_URL, tuneStyle } from "../lib/mapStyle";
import {
  loadTornadoesInRange,
  loadHurricanesInRange,
} from "../lib/dataLoader";
import {
  EF_MATCH_EXPRESSION,
  CATEGORY_MATCH_EXPRESSION,
  TORNADO_WIDTH_EXPRESSION,
  HURRICANE_WIDTH_EXPRESSION,
} from "../lib/colors";

function emptyFC() {
  return { type: "FeatureCollection", features: [] };
}

// Builds a MapLibre filter expression combining: geometry type, active
// EF/category selections, active state selection, and the timeline
// scrub position (only show events at or before the scrubbed year).
function buildFilter({ geomType, ratingProp, allowedRatings, allowedStates, scrubYear, yearProp }) {
  const clauses = ["all", ["==", ["geometry-type"], geomType]];

  if (allowedRatings) {
    clauses.push([
      "in",
      ["coalesce", ["get", ratingProp], -1],
      ["literal", [...allowedRatings]],
    ]);
  }
  if (allowedStates && allowedStates.size > 0) {
    clauses.push(["in", ["get", "state"], ["literal", [...allowedStates]]]);
  }
  if (scrubYear !== null && scrubYear !== undefined) {
    clauses.push(["<=", ["get", yearProp], scrubYear]);
  }
  return clauses;
}

export default function MapView({ filters, scrubYear, onFeatureClick, onLoadingChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);

  // --- Map init (once) ---
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const res = await fetch(BASE_STYLE_URL);
      const rawStyle = await res.json();
      if (cancelled) return;
      const style = tuneStyle(rawStyle);

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [-95, 39],
        zoom: 3.3,
        minZoom: 2,
        maxZoom: 14,
        attributionControl: true,
      });
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right"
      );

      map.on("load", () => {
        if (cancelled) return;

        map.addSource("tornadoes", { type: "geojson", data: emptyFC() });
        map.addSource("hurricanes", { type: "geojson", data: emptyFC() });

        map.addLayer({
          id: "hurricane-tracks",
          type: "line",
          source: "hurricanes",
          filter: ["==", ["geometry-type"], "LineString"],
          paint: {
            "line-color": CATEGORY_MATCH_EXPRESSION,
            "line-width": HURRICANE_WIDTH_EXPRESSION,
            "line-opacity": 0.85,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });

        map.addLayer({
          id: "tornado-tracks",
          type: "line",
          source: "tornadoes",
          filter: ["==", ["geometry-type"], "LineString"],
          paint: {
            "line-color": EF_MATCH_EXPRESSION,
            "line-width": TORNADO_WIDTH_EXPRESSION,
            "line-opacity": 0.9,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });

        // Some SPC records only have a touchdown point, no end coordinate.
        map.addLayer({
          id: "tornado-points",
          type: "circle",
          source: "tornadoes",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-color": EF_MATCH_EXPRESSION,
            "circle-radius": 3,
            "circle-opacity": 0.9,
          },
        });

        for (const layerId of [
          "tornado-tracks",
          "tornado-points",
          "hurricane-tracks",
        ]) {
          map.on("click", layerId, (e) => {
            const feature = e.features?.[0];
            if (feature) onFeatureClick(feature);
          });
          map.on("mouseenter", layerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
          });
        }

        mapRef.current = map;
        setReady(true);
      });
    }

    init();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Load data whenever the year range or event-type toggles change ---
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function load() {
      onLoadingChange?.(true);
      const map = mapRef.current;
      const { startYear, endYear, showTornadoes, showHurricanes } = filters;

      const [tornadoes, hurricanes] = await Promise.all([
        showTornadoes ? loadTornadoesInRange(startYear, endYear) : [],
        showHurricanes ? loadHurricanesInRange(startYear, endYear) : [],
      ]);
      if (cancelled) return;

      map.getSource("tornadoes")?.setData({
        type: "FeatureCollection",
        features: tornadoes,
      });
      map.getSource("hurricanes")?.setData({
        type: "FeatureCollection",
        features: hurricanes,
      });
      onLoadingChange?.(false);
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, filters.startYear, filters.endYear, filters.showTornadoes, filters.showHurricanes]);

  // --- Apply EF/category/state/timeline filters (fast, no refetch) ---
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    const tornadoRatings = filters.efRatings; // Set or null (null = all)
    const categoryRatings = filters.categories;
    const states = filters.states;

    map.setFilter(
      "tornado-tracks",
      buildFilter({
        geomType: "LineString",
        ratingProp: "ef_rating",
        allowedRatings: tornadoRatings,
        allowedStates: states,
        scrubYear,
        yearProp: "year",
      })
    );
    map.setFilter(
      "tornado-points",
      buildFilter({
        geomType: "Point",
        ratingProp: "ef_rating",
        allowedRatings: tornadoRatings,
        allowedStates: states,
        scrubYear,
        yearProp: "year",
      })
    );
    map.setFilter(
      "hurricane-tracks",
      buildFilter({
        geomType: "LineString",
        ratingProp: "category",
        allowedRatings: categoryRatings,
        allowedStates: null,
        scrubYear,
        yearProp: "year",
      })
    );
  }, [ready, filters.efRatings, filters.categories, filters.states, scrubYear]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
