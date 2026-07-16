"use client";

export default function TopBar({ onMenuClick, loading }) {
  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Storm Archive</h1>
      {loading && <span style={styles.loadingDot} aria-label="Loading data" />}
      <button style={styles.menuButton} onClick={onMenuClick} aria-label="Open menu">
        <span style={styles.bar} />
        <span style={styles.bar} />
        <span style={styles.bar} />
      </button>
    </div>
  );
}

const styles = {
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    background: "linear-gradient(to bottom, var(--bg-deep) 40%, transparent)",
  },
  title: {
    fontSize: 18,
    letterSpacing: "0.01em",
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--accent)",
    animation: "pulse 1s infinite ease-in-out",
  },
  menuButton: {
    marginLeft: "auto",
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
