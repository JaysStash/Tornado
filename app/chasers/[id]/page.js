"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase, supabaseConfigured } from "../../../lib/supabaseClient";
import { badgeColor } from "../../../lib/colors";

export default function ChaserProfilePage() {
  const { id } = useParams();
  const [chaser, setChaser] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ok | not-found | error

  useEffect(() => {
    if (!supabaseConfigured) {
      setStatus("error");
      return;
    }
    let cancelled = false;

    async function load() {
      const { data: chaserData } = await supabase
        .from("chasers")
        .select("id, display_name, bio, badge")
        .eq("id", id)
        .eq("status", "active")
        .maybeSingle();

      if (cancelled) return;
      if (!chaserData) {
        setStatus("not-found");
        return;
      }
      setChaser(chaserData);

      const { data: routeData } = await supabase
        .from("chase_routes")
        .select("id, event_id, event_type, submitted_at")
        .eq("chaser_id", id)
        .eq("status", "auto_approved")
        .order("submitted_at", { ascending: false });

      if (!cancelled) {
        setRoutes(routeData || []);
        setStatus("ok");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (status === "loading") return <main style={styles.page}>Loading…</main>;

  if (status === "error") {
    return (
      <main style={styles.page}>
        <p style={{ color: "var(--text-secondary)" }}>
          Accounts aren't configured on this deployment.
        </p>
      </main>
    );
  }

  if (status === "not-found") {
    return (
      <main style={styles.page}>
        <p style={{ color: "var(--text-secondary)" }}>
          No chaser profile here — either it doesn't exist, or this chaser isn't a trusted
          member yet.
        </p>
        <Link href="/" style={styles.backLink}>
          ← Back to the map
        </Link>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <Link href="/" style={styles.backLink}>
        ← Back to the map
      </Link>
      <h1 style={styles.name}>{chaser.display_name}</h1>
      {chaser.badge && (
        <span
          className="event-popup-badge"
          style={{ color: badgeColor(chaser.badge), borderColor: badgeColor(chaser.badge) }}
        >
          {chaser.badge}
        </span>
      )}
      {chaser.bio && <p style={styles.bio}>{chaser.bio}</p>}

      <h2 style={styles.sectionTitle}>Chase routes ({routes.length})</h2>
      {routes.length === 0 ? (
        <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No published routes yet.</p>
      ) : (
        <ul style={styles.routeList}>
          {routes.map((r) => (
            <li key={r.id} style={styles.routeItem} className="mono">
              {r.event_id} · {r.event_type}
              <span style={{ color: "var(--text-tertiary)", marginLeft: 8 }}>
                {new Date(r.submitted_at).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--bg-deep)",
    color: "var(--text-primary)",
    padding: "24px 20px",
    maxWidth: 560,
    margin: "0 auto",
  },
  backLink: {
    color: "var(--accent)",
    fontSize: 13,
    textDecoration: "none",
    display: "inline-block",
    marginBottom: 20,
  },
  name: {
    fontSize: 24,
    marginBottom: 8,
  },
  bio: {
    color: "var(--text-secondary)",
    fontSize: 14,
    lineHeight: 1.6,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    marginTop: 28,
    marginBottom: 12,
  },
  routeList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  routeItem: {
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    padding: "8px 12px",
    fontSize: 12.5,
  },
};
