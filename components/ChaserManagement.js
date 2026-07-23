"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const TRUST_LEVELS = ["applied", "manual", "token"];
const STATUSES = ["pending_application", "active", "suspended"];
const BADGES = ["", "trusted", "verified", "featured"];

export default function ChaserManagement() {
  const [chasers, setChasers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    const { data } = await supabase
      .from("chasers")
      .select("id, display_name, trust_level, status, badge, created_at")
      .order("created_at", { ascending: false });
    setChasers(data || []);
    setLoading(false);
  }

  async function updateChaser(id, patch) {
    setSavingId(id);
    await supabase.from("chasers").update(patch).eq("id", id);
    await refresh();
    setSavingId(null);
  }

  if (loading) return <p style={{ color: "var(--text-secondary)" }}>Loading…</p>;
  if (chasers.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>No chasers yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {chasers.map((c) => (
        <div key={c.id} style={styles.card}>
          <div style={styles.name}>
            {c.display_name}
            {savingId === c.id && (
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}> saving…</span>
            )}
          </div>
          <div style={styles.row}>
            <label style={styles.label}>
              Status
              <select
                value={c.status}
                onChange={(e) => updateChaser(c.id, { status: e.target.value })}
                style={styles.select}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Trust level
              <select
                value={c.trust_level}
                onChange={(e) => updateChaser(c.id, { trust_level: e.target.value })}
                style={styles.select}
              >
                {TRUST_LEVELS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Badge
              <select
                value={c.badge || ""}
                onChange={(e) => updateChaser(c.id, { badge: e.target.value || null })}
                style={styles.select}
              >
                {BADGES.map((b) => (
                  <option key={b} value={b}>
                    {b || "none"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  card: {
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-md)",
    padding: 12,
  },
  name: {
    fontSize: 13,
    marginBottom: 10,
  },
  row: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 11,
    color: "var(--text-tertiary)",
  },
  select: {
    background: "var(--bg-panel)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "5px 6px",
    fontSize: 12.5,
  },
};
