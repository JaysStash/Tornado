"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { parseRouteFile } from "../lib/routeParser";
import { loadTornadoesInRange, loadHurricanesInRange } from "../lib/dataLoader";
import { efLabel, categoryLabel } from "../lib/colors";

export default function SubmissionForm({ session }) {
  const [eventType, setEventType] = useState("tornado");
  const [searchYear, setSearchYear] = useState(new Date().getFullYear());
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [routeFeature, setRouteFeature] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [photos, setPhotos] = useState([{ url: "", caption: "" }]);
  const [displayName, setDisplayName] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { ok: bool, message }

  if (!session) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Sign in above to submit a chase route.
      </p>
    );
  }

  async function handleSearch() {
    setSearching(true);
    setSelectedEvent(null);
    const features =
      eventType === "tornado"
        ? await loadTornadoesInRange(searchYear, searchYear)
        : await loadHurricanesInRange(searchYear, searchYear);
    setSearchResults(features.slice(0, 200)); // cap the list, it's a picker not a report
    setSearching(false);
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    try {
      const text = await file.text();
      const feature = parseRouteFile(text, file.name);
      setRouteFeature(feature);
    } catch (err) {
      setFileError(err.message);
      setRouteFeature(null);
    }
  }

  function updatePhoto(i, patch) {
    setPhotos((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedEvent || !routeFeature || !consent) return;
    setSubmitting(true);
    setResult(null);

    try {
      // 1. Find or create this user's chaser record.
      let { data: chaser } = await supabase
        .from("chasers")
        .select("id, status")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!chaser) {
        const { data: newChaser, error: chaserErr } = await supabase
          .from("chasers")
          .insert({
            user_id: session.user.id,
            display_name: displayName || session.user.email,
          })
          .select("id, status")
          .single();
        if (chaserErr) throw chaserErr;
        chaser = newChaser;
      }

      const autoApproved = chaser.status === "active";

      // 2. Insert the route.
      const { data: route, error: routeErr } = await supabase
        .from("chase_routes")
        .insert({
          event_id: selectedEvent.properties.id,
          event_type: eventType,
          chaser_id: chaser.id,
          route_geojson: routeFeature,
          status: autoApproved ? "auto_approved" : "pending",
        })
        .select("id")
        .single();
      if (routeErr) throw routeErr;

      // 3. Insert any photo links provided.
      const validPhotos = photos.filter((p) => p.url.trim());
      if (validPhotos.length > 0) {
        await supabase.from("route_photos").insert(
          validPhotos.map((p) => ({
            route_id: route.id,
            hotlink_url: p.url.trim(),
            caption: p.caption.trim() || null,
          }))
        );
      }

      // 4. Alert Jay if this needs manual review.
      if (!autoApproved) {
        fetch("/api/notify-moderation", { method: "POST" }).catch(() => {
          // Non-critical - the submission itself already succeeded.
        });
      }

      setResult({
        ok: true,
        message: autoApproved
          ? "Submitted and published — thanks for adding your route!"
          : "Submitted for review. You'll see it appear once it's approved.",
      });
      setRouteFeature(null);
      setSelectedEvent(null);
      setPhotos([{ url: "", caption: "" }]);
    } catch (err) {
      setResult({ ok: false, message: err.message || "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <section>
        <label style={styles.label}>Your name (as shown on your chase route)</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={session.user.email}
          style={styles.input}
        />
      </section>

      <section>
        <label style={styles.label}>1. Find the event you chased</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            style={styles.select}
          >
            <option value="tornado">Tornado</option>
            <option value="hurricane">Hurricane</option>
          </select>
          <input
            type="number"
            className="mono"
            value={searchYear}
            onChange={(e) => setSearchYear(Number(e.target.value))}
            style={{ ...styles.input, width: 90 }}
          />
          <button type="button" onClick={handleSearch} style={styles.secondaryButton}>
            {searching ? "Searching…" : "Search"}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div style={styles.resultsList}>
            {searchResults.map((f, i) => (
              <button
                type="button"
                key={f.properties.id || i}
                onClick={() => setSelectedEvent(f)}
                style={{
                  ...styles.resultItem,
                  borderColor:
                    selectedEvent?.properties.id === f.properties.id
                      ? "var(--accent)"
                      : "var(--border-subtle)",
                }}
              >
                {eventType === "tornado"
                  ? `${f.properties.date} · ${f.properties.state} · ${efLabel(f.properties.ef_rating)}`
                  : `${f.properties.name || "Unnamed"} (${f.properties.year}) · ${categoryLabel(f.properties.category)}`}
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <label style={styles.label}>2. Upload your route (GPX or KML)</label>
        <input type="file" accept=".gpx,.kml" onChange={handleFileChange} style={{ fontSize: 13 }} />
        {fileError && <p style={{ color: "var(--danger)", fontSize: 12 }}>{fileError}</p>}
        {routeFeature && (
          <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>
            Loaded {routeFeature.properties.point_count} points.
          </p>
        )}
      </section>

      <section>
        <label style={styles.label}>3. Photos (optional — link to where they're already hosted)</label>
        {photos.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input
              placeholder="https://..."
              value={p.url}
              onChange={(e) => updatePhoto(i, { url: e.target.value })}
              style={{ ...styles.input, flex: 2 }}
            />
            <input
              placeholder="Caption (optional)"
              value={p.caption}
              onChange={(e) => updatePhoto(i, { caption: e.target.value })}
              style={{ ...styles.input, flex: 1 }}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPhotos((p) => [...p, { url: "", caption: "" }])}
          style={styles.linkButton}
        >
          + Add another photo link
        </button>
      </section>

      <label style={{ display: "flex", gap: 8, fontSize: 12.5, alignItems: "flex-start" }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          I confirm I own the rights to this route and any linked photos. I grant Storm Archive
          a non-exclusive, revocable license to display them on the site and in related
          promotion; I retain full ownership and can request removal at any time.
          <br />
          <span style={{ color: "var(--text-tertiary)" }}>
            (Placeholder wording — functional, but worth a real legal review before this scales
            up. Not legal advice.)
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={!selectedEvent || !routeFeature || !consent || submitting}
        style={styles.primaryButton}
      >
        {submitting ? "Submitting…" : "Submit route"}
      </button>

      {result && (
        <p style={{ color: result.ok ? "var(--accent)" : "var(--danger)", fontSize: 13 }}>
          {result.message}
        </p>
      )}
    </form>
  );
}

const styles = {
  label: {
    display: "block",
    fontSize: 12.5,
    color: "var(--text-secondary)",
    marginBottom: 6,
  },
  input: {
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "7px 9px",
    fontSize: 13,
    width: "100%",
  },
  select: {
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "7px 9px",
    fontSize: 13,
  },
  secondaryButton: {
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "7px 12px",
    fontSize: 13,
    cursor: "pointer",
  },
  primaryButton: {
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    color: "var(--bg-deep)",
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  linkButton: {
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
  },
  resultsList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    maxHeight: 180,
    overflowY: "auto",
  },
  resultItem: {
    background: "var(--bg-panel-raised)",
    border: "1px solid",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "6px 9px",
    fontSize: 12.5,
    textAlign: "left",
    cursor: "pointer",
  },
};
