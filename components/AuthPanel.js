"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabaseClient";

export default function AuthPanel({ onSessionChange }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      onSessionChange?.(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      onSessionChange?.(newSession);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supabaseConfigured) {
    return (
      <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
        Accounts aren't set up yet on this deployment.
      </p>
    );
  }

  if (session) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }} className="mono">
          {session.user.email}
        </span>
        <button style={styles.secondaryButton} onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({ email });
    setStatus(error ? "error" : "sent");
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
        Sign in with email — we'll send a link, no password needed
      </label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        style={styles.input}
      />
      <button type="submit" disabled={status === "sending"} style={styles.primaryButton}>
        {status === "sending" ? "Sending…" : "Send sign-in link"}
      </button>
      {status === "sent" && (
        <p style={{ fontSize: 12, color: "var(--accent)" }}>Check your email for the link.</p>
      )}
      {status === "error" && (
        <p style={{ fontSize: 12, color: "var(--danger)" }}>Something went wrong — try again.</p>
      )}
    </form>
  );
}

const styles = {
  input: {
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "8px 10px",
    fontSize: 13,
  },
  primaryButton: {
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    color: "var(--bg-deep)",
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "none",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-secondary)",
    padding: "5px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
};
