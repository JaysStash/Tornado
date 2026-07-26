"use client";

import { useEffect, useState } from "react";
import { DONATION_URL } from "../lib/config";
import { supabase, supabaseConfigured } from "../lib/supabaseClient";

export default function TopBar({ onMenuClick, onProfileClick, loading }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const initial = session?.user?.email?.[0]?.toUpperCase();

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Storm Archive</h1>
      <div style={styles.rightGroup}>
        {loading && <span style={styles.loadingDot} aria-label="Loading data" />}
        {DONATION_URL && (
          <a href={DONATION_URL} target="_blank" rel="noopener" style={styles.supportLink}>
            Support
          </a>
        )}
        {supabaseConfigured && (
          <button
            style={styles.profileButton}
            onClick={onProfileClick}
            aria-label={session ? "Account" : "Sign in"}
          >
            {initial || "＋"}
          </button>
        )}
        <button style={styles.menuButton} onClick={onMenuClick} aria-label="Open menu">
          <span style={styles.bar} />
          <span style={styles.bar} />
          <span style={styles.bar} />
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    background: "var(--bg-deep)",
    borderBottom: "1px solid var(--border-subtle)",
  },
  title: {
    fontSize: 18,
    letterSpacing: "0.01em",
  },
  rightGroup: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--accent)",
    animation: "pulse 1s infinite ease-in-out",
  },
  supportLink: {
    fontSize: 12.5,
    color: "var(--accent)",
    textDecoration: "none",
    border: "1px solid var(--accent-dim)",
    borderRadius: "var(--radius-sm)",
    padding: "5px 10px",
  },
  profileButton: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    color: "var(--accent-secondary)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: "var(--radius-sm)",
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    cursor: "pointer",
  },
  bar: {
    width: 16,
    height: 2,
    background: "var(--text-primary)",
    borderRadius: 1,
  },
};
