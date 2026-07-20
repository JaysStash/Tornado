"use client";

import FlagshipEvents from "./FlagshipEvents";
import OnThisDay from "./OnThisDay";
import StormsNearMe from "./StormsNearMe";

export default function DiscoverPanel({ onFiltersChange, onClose, onFlyTo }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <section>
        <h3 style={styles.sectionTitle}>Near you</h3>
        <StormsNearMe onFlyTo={onFlyTo} />
      </section>

      <section>
        <h3 style={styles.sectionTitle}>On this day</h3>
        <OnThisDay />
      </section>

      <section>
        <h3 style={styles.sectionTitle}>Flagship events</h3>
        <FlagshipEvents onFiltersChange={onFiltersChange} onClose={onClose} />
      </section>
    </div>
  );
}

const styles = {
  sectionTitle: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--text-secondary)",
    marginBottom: 10,
  },
};
