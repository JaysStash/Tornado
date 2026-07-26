"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASE_STYLE_URL, tuneStyle } from "../lib/mapStyle";
import {
  loadTornadoesInRange,
  loadHurricanesInRange,
  loadDamagePoints,
  loadDamageLines,
  loadDamagePolygons,
} from "../lib/dataLoader";
import {
  EF_MATCH_EXPRESSION,
  CATEGORY_MATCH_EXPRESSION,
  TORNADO_TRUE_WIDTH_EXPRESSION,
  HURRICANE_TRUE_WIDTH_EXPRESSION,
  DAT_EFSCALE_MATCH_EXPRESSION,
  efLabel,
  categoryLabel,
  badgeColor,
  windToCategory,
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
  const animateBtn = feature.geometry.type === "LineString"
    ? `<button class="event-popup-stats-btn" data-animate="1">▶ Animate track</button>`
    : "";
  if (p.event_type === "tornado") {
    const warningsBtn = p.date
      ? `<button class="event-popup-stats-btn" data-warnings="${p.date}">Show warning polygons</button>`
      : "";
    return `
      <div class="event-popup">
        <strong>${efLabel(p.ef_rating)} tornado</strong>
        <div class="event-popup-row">${p.date} · ${p.state}</div>
        ${p.fatalities ? `<div class="event-popup-row">${p.fatalities} fatalities</div>` : ""}
        ${p.preliminary ? `<div class="event-popup-badge">Preliminary</div>` : ""}
        ${animateBtn}
        ${warningsBtn}
        <button class="event-popup-stats-btn" data-open-stats="1">Full stats →</button>
      </div>`;
  }
  const atThisPoint = p.segment_wind_kt !== undefined
    ? `<div class="event-popup-row">At this point: ${categoryLabel(p.category)} · ${p.segment_wind_kt} kt</div>`
    : "";
  const hurricaneWarningsBtn = p.segment_date
    ? `<button class="event-popup-stats-btn" data-warnings="${p.segment_date}">Show warning polygons (${p.segment_date})</button>`
    : "";
  return `
    <div class="event-popup">
      <strong>${p.name || "Unnamed"} (${p.year})</strong>
      <div class="event-popup-row">Peak: ${categoryLabel(p.peak_category ?? p.category)} · ${p.max_wind_kt ?? "?"} kt</div>
      ${atThisPoint}
      ${p.preliminary ? `<div class="event-popup-badge">Preliminary</div>` : ""}
      ${animateBtn}
      ${hurricaneWarningsBtn}
      <button class="event-popup-stats-btn" data-open-stats="1">Full stats →</button>
    </div>`;
}

// Linear interpolation along a LineString's coordinates, t in [0,1].
// Returns the interpolated point and the coordinates "revealed" so far,
// used to draw a growing trail behind the animated marker.
// Splits one hurricane's full track into 2-point segment features, one
// per consecutive pair of 6-hourly positions. Each segment carries its
// OWN category/width (computed from that specific point), not the
// storm's peak - this is what fixes the "whole track shows Cat 5 pink
// even during the tropical-depression days" problem. `track` itself is
// deliberately excluded from each segment's properties (it'd otherwise
// get duplicated into every single segment - O(n) data times O(n)
// segments is real bloat for a 100+ point storm). The full original
// feature stays available via hurricaneByIdRef for anything that needs
// the whole track (animate playback, full stats).
function segmentHurricaneTrack(feature) {
  const track = feature.properties.track || [];
  const { track: _track, ...restProps } = feature.properties;
  const segments = [];

  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i];
    const b = track[i + 1];
    if (a.lon == null || a.lat == null || b.lon == null || b.lat == null) continue;
    const segWind = b.wind_kt ?? a.wind_kt ?? 0;
    const rawDate = b.date || a.date; // "YYYYMMDD" from HURDAT2
    const segmentDate = rawDate
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : null;
    segments.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[a.lon, a.lat], [b.lon, b.lat]] },
      properties: {
        ...restProps,
        category: windToCategory(segWind),
        peak_category: restProps.category,
        segment_wind_kt: segWind,
        segment_date: segmentDate,
        radius_34kt_nm: b.radius_34kt_nm ?? a.radius_34kt_nm ?? null,
      },
    });
  }

  // Rare case: a storm with only one recorded position can't form a
  // segment - render it as a point rather than dropping it silently.
  if (segments.length === 0 && track.length === 1 && track[0].lon != null) {
    const p = track[0];
    segments.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: {
        ...restProps,
        category: windToCategory(p.wind_kt ?? 0),
        peak_category: restProps.category,
        segment_wind_kt: p.wind_kt ?? 0,
        radius_34kt_nm: p.radius_34kt_nm ?? null,
      },
    });
  }

  return segments;
}

function interpolateAlongLine(coordinates, t) {
  if (coordinates.length < 2) return { point: coordinates[0], revealed: coordinates };
  const totalSegments = coordinates.length - 1;
  const segmentFloat = Math.min(t, 1) * totalSegments;
  const segmentIndex = Math.min(Math.floor(segmentFloat), totalSegments - 1);
  const segmentT = segmentFloat - segmentIndex;
  const [lon1, lat1] = coordinates[segmentIndex];
  const [lon2, lat2] = coordinates[segmentIndex + 1];
  const point = [lon1 + (lon2 - lon1) * segmentT, lat1 + (lat2 - lat1) * segmentT];
  return { point, revealed: [...coordinates.slice(0, segmentIndex + 1), point] };
}

// Builds a MapLibre filter expression combining: geometry type, active
// EF/category selections (either a specific allowed set, or a minimum
// threshold - "EF3+" style), active state selection, the timeline
// scrub position, and (for the split solid/dashed layer pairs) which
// side of the preliminary flag this particular layer renders.
function buildFilter({ geomType, ratingProp, allowedRatings, minRating, allowedStates, scrubYear, yearProp, preliminary, dateFrom, dateProp }) {
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
  if (minRating !== null && minRating !== undefined && minRating > -1) {
    clauses.push([">=", ["coalesce", ["get", ratingProp], -1], minRating]);
  }
  if (allowedStates && allowedStates.size > 0) {
    clauses.push(["in", ["get", "state"], ["literal", [...allowedStates]]]);
  }
  if (scrubYear !== null && scrubYear !== undefined) {
    clauses.push(["<=", ["get", yearProp], scrubYear]);
  }
  // ISO date strings ("YYYY-MM-DD") compare correctly lexicographically,
  // so a plain ">=" string comparison works fine here without needing
  // to parse into actual date values.
  if (dateFrom && dateProp) {
    clauses.push([">=", ["coalesce", ["get", dateProp], ""], dateFrom]);
  }
  return clauses;
}

export default function MapView({ filters, scrubYear, onFeatureClick, onLoadingChange, flyToLocation, onChaseRouteCountChange, onSummaryStatsChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const chaseRoutesRef = useRef([]);
  const lastTornadoesRef = useRef([]);
  const lastHurricanesRef = useRef([]);
  const hurricaneByIdRef = useRef(new Map());
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
            "line-width": HURRICANE_TRUE_WIDTH_EXPRESSION,
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
            "line-width": HURRICANE_TRUE_WIDTH_EXPRESSION,
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
            "line-width": TORNADO_TRUE_WIDTH_EXPRESSION,
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
            "line-width": TORNADO_TRUE_WIDTH_EXPRESSION,
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
            "line-color": "#EDEEFA",
            "line-width": 2,
            "line-dasharray": [2, 1.5],
            "line-opacity": 0.85,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });

        // Per-event animated playback - a growing trail + leading marker,
        // normally empty until "Animate track" is clicked in a popup.
        map.addSource("playback-trail", { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: "playback-trail",
          type: "line",
          source: "playback-trail",
          paint: { "line-color": "#8ED1F5", "line-width": 3, "line-opacity": 0.9 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        map.addSource("playback-marker", { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: "playback-marker",
          type: "circle",
          source: "playback-marker",
          paint: {
            "circle-color": "#8ED1F5",
            "circle-radius": 6,
            "circle-stroke-color": "#0A0B0F",
            "circle-stroke-width": 2,
          },
        });

        // Historical NWS warning polygons for a specific event's date,
        // shown on demand from a popup rather than a standing toggle -
        // these are inherently tied to one specific day, not a year
        // range. Styled red/yellow matching IEM's own convention for
        // tornado vs severe thunderstorm warnings.
        map.addSource("warning-polygons", { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: "warning-polygons-fill",
          type: "fill",
          source: "warning-polygons",
          paint: {
            "fill-color": [
              "match",
              ["coalesce", ["get", "phenomena"], ""],
              "TO", "#DC2626",
              "SV", "#EAB308",
              "#8B93E8",
            ],
            "fill-opacity": 0.18,
          },
        });
        map.addLayer({
          id: "warning-polygons-line",
          type: "line",
          source: "warning-polygons",
          paint: {
            "line-color": [
              "match",
              ["coalesce", ["get", "phenomena"], ""],
              "TO", "#DC2626",
              "SV", "#EAB308",
              "#8B93E8",
            ],
            "line-width": 1.5,
          },
        });

        // NWS DAT damage assessment data - auto-updated daily via the
        // pipeline (scripts/fetch-damage-assessment.js), not fetched
        // live per-viewport. Polygons are the actual damage swath shape
        // (varying width along the path, unlike the tornado tracks
        // layer's width which is a modeled estimate) - this is real
        // surveyed damage-extent data where it exists.
        map.addSource("damage-polygons", { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: "damage-polygons",
          type: "fill",
          source: "damage-polygons",
          layout: { visibility: "none" },
          paint: { "fill-color": DAT_EFSCALE_MATCH_EXPRESSION, "fill-opacity": 0.45 },
        });
        map.addLayer({
          id: "damage-polygons-outline",
          type: "line",
          source: "damage-polygons",
          layout: { visibility: "none" },
          paint: { "line-color": DAT_EFSCALE_MATCH_EXPRESSION, "line-width": 1 },
        });

        map.addSource("damage-lines", { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: "damage-lines",
          type: "line",
          source: "damage-lines",
          layout: { visibility: "none" },
          paint: { "line-color": DAT_EFSCALE_MATCH_EXPRESSION, "line-width": 2.5 },
        });

        map.addSource("damage-points", { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: "damage-points",
          type: "circle",
          source: "damage-points",
          layout: { visibility: "none" },
          paint: {
            "circle-color": DAT_EFSCALE_MATCH_EXPRESSION,
            "circle-radius": 4,
            "circle-stroke-color": "#0A0B0F",
            "circle-stroke-width": 1,
            "circle-opacity": 0.9,
          },
        });
        map.on("click", "damage-points", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties;
          new maplibregl.Popup({ closeButton: true, maxWidth: "240px" })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div class="event-popup">
                 <strong>Damage point</strong>
                 <div class="event-popup-row">${p.efscale || "Rating not yet assigned"}</div>
                 ${p.stormdate ? `<div class="event-popup-row">${p.stormdate}</div>` : ""}
               </div>`
            )
            .addTo(map);
        });
        map.on("click", "damage-polygons", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties;
          new maplibregl.Popup({ closeButton: true, maxWidth: "240px" })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div class="event-popup">
                 <strong>Damage area</strong>
                 <div class="event-popup-row">${p.efscale || "Rating not yet assigned"}</div>
                 ${p.stormdate ? `<div class="event-popup-row">${p.stormdate}</div>` : ""}
               </div>`
            )
            .addTo(map);
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

            // Hurricane layers now render per-segment pieces (see
            // segmentHurricaneTrack) - the segment only knows about its
            // own 6-hour span, so animate/full-stats need to look up the
            // complete storm by id instead.
            const isHurricaneSegment = feature.properties.event_type === "hurricane";
            const fullFeature = isHurricaneSegment
              ? hurricaneByIdRef.current.get(feature.properties.id) || feature
              : feature;

            const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "260px" })
              .setLngLat(e.lngLat)
              .setHTML(eventPopupHTML(feature))
              .addTo(map);

            // The popup's "Full stats" button opens the side menu to the
            // stats tab for this event - the popup itself only needs to
            // exist after setHTML renders it into the DOM.
            popup.getElement()?.querySelector("[data-open-stats]")?.addEventListener("click", () => {
              onFeatureClick(fullFeature);
              popup.remove();
            });
            popup.getElement()?.querySelector("[data-animate]")?.addEventListener("click", () => {
              animatePlayback(fullFeature);
              popup.remove();
            });
            const warningsBtn = popup.getElement()?.querySelector("[data-warnings]");
            warningsBtn?.addEventListener("click", () => {
              loadWarningPolygons(warningsBtn.getAttribute("data-warnings"));
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
                 ${p.chaser_badge ? `<span class="event-popup-badge" style="color:${badgeColor(p.chaser_badge)};border-color:${badgeColor(p.chaser_badge)}">${p.chaser_badge}</span>` : ""}
                 <div class="event-popup-row">${p.event_id}</div>
                 ${photoLinks ? `<div class="event-popup-row">${photoLinks}</div>` : ""}
                 ${p.chaser_id ? `<a class="event-popup-row" href="/chasers/${p.chaser_id}">View profile →</a>` : ""}
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

      const hurricaneSegments = hurricanes.flatMap(segmentHurricaneTrack);
      hurricaneByIdRef.current = new Map(hurricanes.map((f) => [f.properties.id, f]));

      map.getSource("tornadoes")?.setData({
        type: "FeatureCollection",
        features: tornadoes,
      });
      map.getSource("hurricanes")?.setData({
        type: "FeatureCollection",
        features: hurricaneSegments,
      });
      onLoadingChange?.(false);
      lastTornadoesRef.current = tornadoes;
      lastHurricanesRef.current = hurricanes;
      reportSummaryStats();
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
    const minRating = filters.minRating ?? -1;
    const minCategory = filters.minCategory ?? -1;
    const dateFrom = filters.dateFrom ?? null;

    map.setFilter(
      "tornado-tracks",
      buildFilter({
        geomType: "LineString",
        ratingProp: "ef_rating",
        allowedRatings: tornadoRatings,
        minRating,
        allowedStates: states,
        scrubYear,
        yearProp: "year",
        preliminary: false,
        dateFrom,
        dateProp: "date",
      })
    );
    map.setFilter(
      "tornado-tracks-preliminary",
      buildFilter({
        geomType: "LineString",
        ratingProp: "ef_rating",
        allowedRatings: tornadoRatings,
        minRating,
        allowedStates: states,
        scrubYear,
        yearProp: "year",
        preliminary: true,
        dateFrom,
        dateProp: "date",
      })
    );
    map.setFilter(
      "tornado-points",
      buildFilter({
        geomType: "Point",
        ratingProp: "ef_rating",
        allowedRatings: tornadoRatings,
        minRating,
        allowedStates: states,
        scrubYear,
        yearProp: "year",
        dateFrom,
        dateProp: "date",
      })
    );
    map.setFilter(
      "hurricane-tracks",
      buildFilter({
        geomType: "LineString",
        ratingProp: "category",
        allowedRatings: categoryRatings,
        minRating: minCategory,
        allowedStates: null,
        scrubYear,
        yearProp: "year",
        preliminary: false,
        dateFrom,
        dateProp: "segment_date",
      })
    );
    map.setFilter(
      "hurricane-tracks-preliminary",
      buildFilter({
        geomType: "LineString",
        ratingProp: "category",
        allowedRatings: categoryRatings,
        minRating: minCategory,
        allowedStates: null,
        scrubYear,
        yearProp: "year",
        preliminary: true,
        dateFrom,
        dateProp: "segment_date",
      })
    );
    reportSummaryStats();
  }, [ready, filters.efRatings, filters.categories, filters.states, filters.minRating, filters.minCategory, filters.dateFrom, scrubYear]);

  // --- Chase routes: fetch once Supabase is configured, re-filter
  // client-side (no MapLibre expression does case-insensitive substring
  // match, and the dataset here is small enough that this is cheap) ---
  useEffect(() => {
    if (!ready || !supabaseConfigured) return;
    let cancelled = false;

    async function loadChaseRoutes() {
      const { data } = await supabase
        .from("chase_routes")
        .select("event_id, route_geojson, chasers(id, display_name, badge), route_photos(hotlink_url)")
        .eq("status", "auto_approved");
      if (cancelled || !data) return;

      const features = data.map((row) => ({
        type: "Feature",
        geometry: row.route_geojson.geometry,
        properties: {
          event_id: row.event_id,
          chaser_id: row.chasers?.id || "",
          chaser_name: row.chasers?.display_name || "Unknown",
          chaser_badge: row.chasers?.badge || "",
          photo_urls: JSON.stringify((row.route_photos || []).map((p) => p.hotlink_url)),
        },
      }));

      chaseRoutesRef.current = features;
      onChaseRouteCountChange?.(features.length);
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

  function animatePlayback(feature) {
    const map = mapRef.current;
    if (!map) return;
    const coords = feature.geometry.coordinates;
    if (!coords || coords.length < 2) return;

    const duration = 3000;
    const start = performance.now();

    function tick(now) {
      const t = (now - start) / duration;
      const { point, revealed } = interpolateAlongLine(coords, t);
      map.getSource("playback-marker")?.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: { type: "Point", coordinates: point }, properties: {} }],
      });
      map.getSource("playback-trail")?.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: { type: "LineString", coordinates: revealed }, properties: {} }],
      });
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          map.getSource("playback-marker")?.setData(emptyFC());
          map.getSource("playback-trail")?.setData(emptyFC());
        }, 800);
      }
    }
    requestAnimationFrame(tick);
  }

  // Storms Near Me passes a [lon, lat] to center on once it has the
  // user's location - null means no pending fly-to.
  useEffect(() => {
    if (!ready || !flyToLocation) return;
    mapRef.current?.flyTo({ center: flyToLocation, zoom: 8, duration: 1500 });
  }, [ready, flyToLocation]);

  // Historical NWS warning polygons for one specific date, from IEM's
  // documented WFS archive (mesonet.agron.iastate.edu/ogc/). Archive
  // coverage starts July 2002, so most of this site's 1950+ tornado
  // archive predates it - an empty/no-data result for older events is
  // expected, not a failure.
  //
  // CAVEAT: this endpoint's exact response format wasn't empirically
  // verified before shipping (same situation as the current-year
  // tornado fetch) - defensive parsing below means a format mismatch
  // shows a message rather than breaking anything, but if this keeps
  // coming back empty even for recent, well-documented events, the
  // query format below may need adjusting.
  async function loadWarningPolygons(dateStr) {
    const map = mapRef.current;
    if (!map) return;
    onLoadingChange?.(true);
    try {
      const url = `https://mesonet.agron.iastate.edu/wfs/ww.php?date=${dateStr}&format=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();
      if (data?.type !== "FeatureCollection") throw new Error("unexpected format");

      map.getSource("warning-polygons")?.setData(data);

      if (data.features.length === 0) {
        showInfoPopup(
          map.getCenter(),
          "No warning polygon data found for that date - either none were issued, or it predates IEM's archive (coverage starts July 2002)."
        );
      }
    } catch {
      showInfoPopup(
        map.getCenter(),
        "Couldn't load warning polygons for that date - the source may be temporarily unavailable, or its format changed since this was built."
      );
    } finally {
      onLoadingChange?.(false);
    }
  }

  function showInfoPopup(lngLat, message) {
    const map = mapRef.current;
    if (!map) return;
    new maplibregl.Popup({ closeButton: true, maxWidth: "240px" })
      .setLngLat(lngLat)
      .setHTML(`<div class="event-popup"><div class="event-popup-row">${message}</div></div>`)
      .addTo(map);
  }

  function reportSummaryStats() {
    const tornadoRatings = filters.efRatings;
    const states = filters.states;
    const minRating = filters.minRating ?? -1;
    const dateFrom = filters.dateFrom ?? null;
    const visibleTornadoes = lastTornadoesRef.current.filter((f) => {
      const p = f.properties;
      if (tornadoRatings && !tornadoRatings.has(p.ef_rating ?? -1)) return false;
      if (minRating > -1 && (p.ef_rating ?? -1) < minRating) return false;
      if (states && states.size > 0 && !states.has(p.state)) return false;
      if (scrubYear !== null && p.year > scrubYear) return false;
      if (dateFrom && (p.date ?? "") < dateFrom) return false;
      return true;
    });
    const categoryRatings = filters.categories;
    const minCategory = filters.minCategory ?? -1;
    const visibleHurricanes = lastHurricanesRef.current.filter((f) => {
      const p = f.properties;
      if (categoryRatings && !categoryRatings.has(p.category ?? -1)) return false;
      if (minCategory > -1 && (p.category ?? -1) < minCategory) return false;
      if (scrubYear !== null && p.year > scrubYear) return false;
      return true;
    });

    const highestEF = visibleTornadoes.reduce(
      (max, f) => Math.max(max, f.properties.ef_rating ?? -1),
      -1
    );
    onSummaryStatsChange?.({
      tornadoCount: visibleTornadoes.length,
      hurricaneCount: visibleHurricanes.length,
      injuries: visibleTornadoes.reduce((sum, f) => sum + (f.properties.injuries || 0), 0),
      fatalities: visibleTornadoes.reduce((sum, f) => sum + (f.properties.fatalities || 0), 0),
      highestEF: highestEF >= 0 ? highestEF : null,
    });
  }

  // NWS DAT damage points/lines/polygons - loaded once from the
  // auto-updated static files (refreshed daily by the pipeline, see
  // scripts/fetch-damage-assessment.js), not fetched live per-viewport.
  // This is operational/recent data only (~400 day rolling window),
  // not part of the deep historical archive.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function load() {
      const [points, lines, polygons] = await Promise.allSettled([
        loadDamagePoints(),
        loadDamageLines(),
        loadDamagePolygons(),
      ]);
      if (cancelled) return;
      const map = mapRef.current;
      if (points.status === "fulfilled") map.getSource("damage-points")?.setData(points.value);
      if (lines.status === "fulfilled") map.getSource("damage-lines")?.setData(lines.value);
      if (polygons.status === "fulfilled") map.getSource("damage-polygons")?.setData(polygons.value);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  // Toggling "Damage Points" shows/hides all three layers together
  // (matching the single toggle in the UI) - a visibility flip, not a
  // refetch, since the data's already loaded above.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    const visibility = filters.showDamagePoints ? "visible" : "none";
    for (const id of ["damage-points", "damage-lines", "damage-polygons", "damage-polygons-outline"]) {
      map.setLayoutProperty(id, "visibility", visibility);
    }
  }, [ready, filters.showDamagePoints]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
