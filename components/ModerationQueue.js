"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ModerationQueue({ session }) {
  const [isAdmin, setIsAdmin] = useState(null); // null = checking
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(Boolean(data)));
  }, [session]);

  useEffect(() => {
    if (!isAdmin) return;
    refresh();
  }, [isAdmin]);

  async function refresh() {
    setLoading(true);
    const { data } = await supabase
      .from("chase_routes")
      .select("id, event_id, event_type, submitted_at, notes, chasers(display_name, trust_level, badge)")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true });
    setPending(data || []);
    setLoading(false);
  }

  async function approve(routeId) {
    await supabase
      .from("chase_routes")
      .update({ status: "auto_approved", approved_at: new Date().toISOString() })
      .eq("id", routeId);
    refresh();
  }

  async function reject(routeId) {
    await supabase.from("chase_routes").update({ status: "rejected" }).eq("id", routeId);
    refresh();
  }

  if (isAdmin === null) return null; // still checking, avoid a flash
  if (!isAdmin) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
        Nothing here for you — this section is admin-only.
      </p>
    );
  }

  if (loading) return <p style={{ color: "var(--text-secondary)" }}>Loading…</p>;

  if (pending.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Queue's empty. Nothing pending.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {pending.map((route) => (
        <div key={route.id} style={styles.card}>
          <div style={styles.cardHeader}>
            <span className="mono" style={{ fontSize: 12.5 }}>
              {route.event_id} · {route.event_type}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {new Date(route.submitted_at).toLocaleDateString()}
            </span>
          </div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            {route.chasers?.display_name || "Unknown chaser"}
            <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
              {" "}
              ({route.chasers?.trust_level}
              {route.chasers?.badge ? `, ${route.chasers.badge}` : ""})
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => approve(route.id)} style={styles.approveButton}>
              Approve
            </button>
            <button onClick={() => reject(route.id)} style={styles.rejectButton}>
              Reject
            </button>
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
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
    color: "var(--text-secondary)",
  },
  approveButton: {
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    color: "var(--bg-deep)",
    padding: "6px 12px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  rejectButton: {
    background: "none",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-secondary)",
    padding: "6px 12px",
    fontSize: 12.5,
    cursor: "pointer",
  },
};
