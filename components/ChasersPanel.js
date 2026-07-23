"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabaseClient";
import AuthPanel from "./AuthPanel";
import SubmissionForm from "./SubmissionForm";
import ModerationQueue from "./ModerationQueue";
import ChaserManagement from "./ChaserManagement";

export default function ChasersPanel() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState("submit");
  const [adminSection, setAdminSection] = useState("moderate");

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
          {isAdmin && (
            <button
              style={{ ...styles.subTab, ...(tab === "admin" ? styles.subTabActive : {}) }}
              onClick={() => setTab("admin")}
            >
              Admin
            </button>
          )}
        </div>
      )}

      {supabaseConfigured && session && tab === "submit" && <SubmissionForm session={session} />}

      {supabaseConfigured && session && isAdmin && tab === "admin" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <button
              style={{
                ...styles.subTab,
                ...(adminSection === "moderate" ? styles.subTabActive : {}),
              }}
              onClick={() => setAdminSection("moderate")}
            >
              Moderation queue
            </button>
            <button
              style={{
                ...styles.subTab,
                ...(adminSection === "manage" ? styles.subTabActive : {}),
              }}
              onClick={() => setAdminSection("manage")}
            >
              Manage chasers
            </button>
          </div>
          {adminSection === "moderate" && <ModerationQueue session={session} />}
          {adminSection === "manage" && <ChaserManagement />}
        </div>
      )}
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
