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
  badgeColor,
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
    return `
      <div class="event-popup">
        <strong>${efLabel(p.ef_rating)} tornado</strong>
        <div class="event-popup-row">${p.date} · ${p.state}</div>
        ${p.fatalities ? `<div class="event-popup-row">${p.fatalities} fatalities</div>` : ""}
        ${p.preliminary ? `<div class="event-popup-badge">Preliminary</div>` : ""}
        ${animateBtn}
        <button class="event-popup-stats-btn" data-open-stats="1">Full stats →</button>
      </div>`;
  }
  return `
    <div class="event-popup">
      <strong>${p.name || "Unnamed"} (${p.year})</strong>
      <div class="event-popup-row">${categoryLabel(p.category)} · ${p.max_wind_kt ?? "?"} kt</div>
      ${p.preliminary ? `<div class="event-popup-badge">Preliminary</div>` : ""}
      ${animateBtn}
      <button class="event-popup-stats-btn" data-open-stats="1">Full stats →</button>
    </div>`;
}

// Linear interpolation along a LineString's coordinates, t in [0,1].
// Returns the interpolated point and the coordinates "revealed" so far,
// used to draw a growing trail behind the animated marker.
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

export default function MapView({ filters, scrubYear, onFeatureClick, onLoadingChange, flyToLocation, onChaseRouteCountChange, onSummaryStatsChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const chaseRoutesRef = useRef([]);
  const lastTornadoesRef = useRef([]);
  const lastHurricanesRef = useRef([]);
  const damagePointsEnabledRef = useRef(false);
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

        // Live NWS damage points (NOAA DAT), fetched on demand for the
        // current viewport rather than baked into the static pipeline -
        // this is operational/recent survey data, not a full historical
        // archive back to 1950, so it's fetched fresh, not pre-processed.
        map.addSource("damage-points", { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: "damage-points",
          type: "circle",
          source: "damage-points",
          paint: {
            "circle-color": "#F5A623",
            "circle-radius": 4,
            "circle-stroke-color": "#0A0B0F",
            "circle-stroke-width": 1,
            "circle-opacity": 0.85,
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
        map.on("moveend", () => {
          if (damagePointsEnabledRef.current) loadDamagePoints();
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
            popup.getElement()?.querySelector("[data-animate]")?.addEventListener("click", () => {
              animatePlayback(feature);
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

      map.getSource("tornadoes")?.setData({
        type: "FeatureCollection",
        features: tornadoes,
      });
      map.getSource("hurricanes")?.setData({
        type: "FeatureCollection",
        features: hurricanes,
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
    reportSummaryStats();
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

  function reportSummaryStats() {
    const tornadoRatings = filters.efRatings;
    const states = filters.states;
    const visibleTornadoes = lastTornadoesRef.current.filter((f) => {
      const p = f.properties;
      if (tornadoRatings && !tornadoRatings.has(p.ef_rating ?? -1)) return false;
      if (states && states.size > 0 && !states.has(p.state)) return false;
      if (scrubYear !== null && p.year > scrubYear) return false;
      return true;
    });
    const categoryRatings = filters.categories;
    const visibleHurricanes = lastHurricanesRef.current.filter((f) => {
      const p = f.properties;
      if (categoryRatings && !categoryRatings.has(p.category ?? -1)) return false;
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

  // Live NWS damage points from NOAA's Damage Assessment Toolkit -
  // fetched fresh for whatever's currently in view, not baked into the
  // static pipeline. This is operational/recent survey data (not a full
  // historical archive), so results will skew toward recent events -
  // that's the nature of the source, not a bug here.
  async function loadDamagePoints() {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ].join(",");
    const url =
      "https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit/DamageViewer/FeatureServer/0/query" +
      `?where=1=1&outFields=efscale,stormdate,event_id&geometry=${bbox}` +
      "&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects" +
      "&outSR=4326&resultRecordCount=500&f=geojson";
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const geojson = await res.json();
      map.getSource("damage-points")?.setData(geojson);
    } catch {
      // Live external service outside our control - fail quietly rather
      // than breaking the rest of the map over it.
    }
  }

  // Keeps the moveend listener (registered once at map init) in sync
  // with the current toggle state, and loads/clears immediately when
  // the toggle itself changes.
  useEffect(() => {
    damagePointsEnabledRef.current = filters.showDamagePoints;
    if (!ready) return;
    if (filters.showDamagePoints) {
      loadDamagePoints();
    } else {
      mapRef.current?.getSource("damage-points")?.setData(emptyFC());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, filters.showDamagePoints]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
