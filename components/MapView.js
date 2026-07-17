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
  efLabel,
  categoryLabel,
} from "../lib/colors";
import { supabase, supabaseConfigured } from "../lib/supabaseClient";

function emptyFC() {
  return { type: "FeatureCollection", features: [] };
}

// Compact popup content for a clicked tornado/hurricane track - the quick
// facts, not the full stats-panel breakdown. There's a "Full stats" button
// wired up below for anyone who wants the deeper view.
function eventPopupHTML(feature) {
  const p = feature.properties;
  if (p.event_type === "tornado") {
    return `
      <div class="event-popup">
        <strong>${efLabel(p.ef_rating)} tornado</strong>
        <div class="event-popup-row">${p.date} · ${p.state}</div>
        ${p.fatalities ? `<div class="event-popup-row">${p.fatalities} fatalities</div>` : ""}
        ${p.preliminary ? `<div class="event-popup-badge">Preliminary</div>` : ""}
        <button class="event-popup-stats-btn" data-open-stats="1">Full stats →</button>
      </div>`;
  }
  return `
    <div class="event-popup">
      <strong>${p.name || "Unnamed"} (${p.year})</strong>
      <div class="event-popup-row">${categoryLabel(p.category)} · ${p.max_wind_kt ?? "?"} kt</div>
      ${p.preliminary ? `<div class="event-popup-badge">Preliminary</div>` : ""}
      <button class="event-popup-stats-btn" data-open-stats="1">Full stats →</button>
    </div>`;
}

// Builds a MapLibre filter expression combining: geometry type, active
// EF/category selections, active state selection, the timeline scrub
// position, and (for the split solid/dashed layer pairs) which side of
// the preliminary flag this particular layer renders.
function buildFilter({ geomType, ratingProp, allowedRatings, allowedStates, scrubYear, yearProp, preliminary }) {
  const clauses = ["all", ["==", ["geometry-type"], geomType]];

  if (preliminary === true) {
    clauses.push(["==", ["get", "preliminary"], true]);
  } else if (preliminary === false) {
    clauses.push(["!=", ["get", "preliminary"], true]);
  }
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
  const chaseRoutesRef = useRef([]);
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
          filter: ["all", ["==", ["geometry-type"], "LineString"], ["!=", ["get", "preliminary"], true]],
          paint: {
            "line-color": CATEGORY_MATCH_EXPRESSION,
            "line-width": HURRICANE_WIDTH_EXPRESSION,
            "line-opacity": 0.85,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        // Preliminary (unsurveyed / season-in-progress) events get their
        // own layer with a fixed dash pattern - line-dasharray can't be a
        // per-feature data-driven expression in MapLibre, only a plain
        // value or a zoom-based one, so "some tracks dashed, some not"
        // has to be two layers filtered by the same property instead of
        // one layer with a conditional.
        map.addLayer({
          id: "hurricane-tracks-preliminary",
          type: "line",
          source: "hurricanes",
          filter: ["all", ["==", ["geometry-type"], "LineString"], ["==", ["get", "preliminary"], true]],
          paint: {
            "line-color": CATEGORY_MATCH_EXPRESSION,
            "line-width": HURRICANE_WIDTH_EXPRESSION,
            "line-opacity": 0.85,
            "line-dasharray": [2, 1.5],
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });

        map.addLayer({
          id: "tornado-tracks",
          type: "line",
          source: "tornadoes",
          filter: ["all", ["==", ["geometry-type"], "LineString"], ["!=", ["get", "preliminary"], true]],
          paint: {
            "line-color": EF_MATCH_EXPRESSION,
            "line-width": TORNADO_WIDTH_EXPRESSION,
            "line-opacity": 0.9,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        map.addLayer({
          id: "tornado-tracks-preliminary",
          type: "line",
          source: "tornadoes",
          filter: ["all", ["==", ["geometry-type"], "LineString"], ["==", ["get", "preliminary"], true]],
          paint: {
            "line-color": EF_MATCH_EXPRESSION,
            "line-width": TORNADO_WIDTH_EXPRESSION,
            "line-opacity": 0.9,
            "line-dasharray": [2, 1.5],
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

        // Chaser-submitted routes - a visually distinct style (bright,
        // dashed) so they never get confused with the tornado/hurricane
        // tracks themselves.
        map.addSource("chase-routes", { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: "chase-routes",
          type: "line",
          source: "chase-routes",
          paint: {
            "line-color": "#F5F5F5",
            "line-width": 2,
            "line-dasharray": [2, 1.5],
            "line-opacity": 0.85,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });

        for (const layerId of [
          "tornado-tracks",
          "tornado-tracks-preliminary",
          "tornado-points",
          "hurricane-tracks",
          "hurricane-tracks-preliminary",
        ]) {
          map.on("click", layerId, (e) => {
            const feature = e.features?.[0];
            if (!feature) return;

            const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "260px" })
              .setLngLat(e.lngLat)
              .setHTML(eventPopupHTML(feature))
              .addTo(map);

            // The popup's "Full stats" button opens the side menu to the
            // stats tab for this event - the popup itself only needs to
            // exist after setHTML renders it into the DOM.
            popup.getElement()?.querySelector("[data-open-stats]")?.addEventListener("click", () => {
              onFeatureClick(feature);
              popup.remove();
            });
          });
          map.on("mouseenter", layerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
          });
        }

        map.on("click", "chase-routes", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const p = feature.properties;
          const photoLinks = p.photo_urls
            ? JSON.parse(p.photo_urls)
                .map((url, i) => `<a href="${url}" target="_blank" rel="noopener">Photo ${i + 1}</a>`)
                .join(" · ")
            : "";
          new maplibregl.Popup({ closeButton: true, maxWidth: "260px" })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div class="event-popup">
                 <strong>${p.chaser_name || "Chaser"}</strong>
                 ${p.chaser_badge ? `<span class="event-popup-badge">${p.chaser_badge}</span>` : ""}
                 <div class="event-popup-row">${p.event_id}</div>
                 ${photoLinks ? `<div class="event-popup-row">${photoLinks}</div>` : ""}
               </div>`
            )
            .addTo(map);
        });
        map.on("mouseenter", "chase-routes", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "chase-routes", () => {
          map.getCanvas().style.cursor = "";
        });

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
        preliminary: false,
      })
    );
    map.setFilter(
      "tornado-tracks-preliminary",
      buildFilter({
        geomType: "LineString",
        ratingProp: "ef_rating",
        allowedRatings: tornadoRatings,
        allowedStates: states,
        scrubYear,
        yearProp: "year",
        preliminary: true,
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
        preliminary: false,
      })
    );
    map.setFilter(
      "hurricane-tracks-preliminary",
      buildFilter({
        geomType: "LineString",
        ratingProp: "category",
        allowedRatings: categoryRatings,
        allowedStates: null,
        scrubYear,
        yearProp: "year",
        preliminary: true,
      })
    );
  }, [ready, filters.efRatings, filters.categories, filters.states, scrubYear]);

  // --- Chase routes: fetch once Supabase is configured, re-filter
  // client-side (no MapLibre expression does case-insensitive substring
  // match, and the dataset here is small enough that this is cheap) ---
  useEffect(() => {
    if (!ready || !supabaseConfigured) return;
    let cancelled = false;

    async function loadChaseRoutes() {
      const { data } = await supabase
        .from("chase_routes")
        .select("event_id, route_geojson, chasers(display_name, badge), route_photos(hotlink_url)")
        .eq("status", "auto_approved");
      if (cancelled || !data) return;

      const features = data.map((row) => ({
        type: "Feature",
        geometry: row.route_geojson.geometry,
        properties: {
          event_id: row.event_id,
          chaser_name: row.chasers?.display_name || "Unknown",
          chaser_badge: row.chasers?.badge || "",
          photo_urls: JSON.stringify((row.route_photos || []).map((p) => p.hotlink_url)),
        },
      }));

      chaseRoutesRef.current = features;
      applyChaseRouteFilter();
    }

    loadChaseRoutes();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function applyChaseRouteFilter() {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("chase-routes");
    if (!source) return;

    if (!filters.showChaserRoutes) {
      source.setData(emptyFC());
      return;
    }
    const nameFilter = (filters.chaserNameFilter || "").trim().toLowerCase();
    const filtered = nameFilter
      ? chaseRoutesRef.current.filter((f) =>
          f.properties.chaser_name.toLowerCase().includes(nameFilter)
        )
      : chaseRoutesRef.current;
    source.setData({ type: "FeatureCollection", features: filtered });
  }

  useEffect(() => {
    applyChaseRouteFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, filters.showChaserRoutes, filters.chaserNameFilter]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
