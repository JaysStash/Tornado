"use client";

import { useState } from "react";
import { supabaseConfigured } from "../lib/supabaseClient";
import AuthPanel from "./AuthPanel";
import SubmissionForm from "./SubmissionForm";
import ModerationQueue from "./ModerationQueue";

export default function ChasersPanel() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("submit");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <AuthPanel onSessionChange={setSession} />

      {supabaseConfigured && session && (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            style={{ ...styles.subTab, ...(tab === "submit" ? styles.subTabActive : {}) }}
            onClick={() => setTab("submit")}
          >
            Submit a route
          </button>
          <button
            style={{ ...styles.subTab, ...(tab === "moderate" ? styles.subTabActive : {}) }}
            onClick={() => setTab("moderate")}
          >
            Moderation queue
          </button>
        </div>
      )}

      {supabaseConfigured && session && tab === "submit" && <SubmissionForm session={session} />}
      {supabaseConfigured && session && tab === "moderate" && <ModerationQueue session={session} />}
    </div>
  );
}

const styles = {
  subTab: {
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-secondary)",
    padding: "6px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
  subTabActive: {
    borderColor: "var(--accent)",
    color: "var(--text-primary)",
  },
};
