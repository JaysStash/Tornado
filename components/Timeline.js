"use client";

import { useEffect, useRef, useState } from "react";

const MIN_YEAR = 1851;

function clamp(year, min, max) {
  if (Number.isNaN(year)) return min;
  return Math.min(Math.max(year, min), max);
}

// Number inputs bound directly to a clamped value re-render on every
// keystroke with whatever the clamp produced - which stomps on
// mid-typing states like "2" or "20" before the user finishes typing
// "2020". This keeps its own draft text while focused, and only
// commits a clamped value on blur or Enter, so intermediate values
// during typing are left alone.
function YearInput({ value, min, max, onCommit }) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  function commit() {
    const n = clamp(Number(draft), min, max);
    setDraft(String(n));
    onCommit(n);
  }

  return (
    <input
      type="number"
      className="mono"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          e.currentTarget.blur();
        }
      }}
      style={styles.yearInput}
    />
  );
}

export default function Timeline({
  maxYear,
  yearRange,
  onYearRangeChange,
  scrubYear,
  onScrubYearChange,
  tornadoCounts,
  hurricaneCounts,
}) {
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!playing) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      onScrubYearChange((prev) => {
        const current = prev ?? yearRange[0];
        if (current >= yearRange[1]) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 220);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, yearRange]);

  const totalYears = MIN_YEAR ? maxYear - MIN_YEAR : 1;
  const maxCount = Math.max(
    1,
    ...Object.values(tornadoCounts || {}),
    ...Object.values(hurricaneCounts || {})
  );

  function yearToPercent(year) {
    return ((year - MIN_YEAR) / (maxYear - MIN_YEAR)) * 100;
  }

  function handleTrackClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const year = Math.round(MIN_YEAR + pct * (maxYear - MIN_YEAR));
    onScrubYearChange(year);
    setPlaying(false);
  }

  const bars = [];
  for (let y = MIN_YEAR; y <= maxYear; y++) {
    const count = (tornadoCounts?.[y] || 0) + (hurricaneCounts?.[y] || 0);
    bars.push(count);
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <button
          style={styles.playButton}
          onClick={() => {
            if (!playing && (scrubYear === null || scrubYear >= yearRange[1])) {
              onScrubYearChange(yearRange[0]);
            }
            setPlaying((p) => !p);
          }}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <span style={styles.yearReadout} className="mono">
          {scrubYear ?? `${yearRange[0]}–${yearRange[1]}`}
        </span>
        {scrubYear !== null && (
          <button
            style={styles.clearButton}
            onClick={() => {
              setPlaying(false);
              onScrubYearChange(null);
            }}
          >
            Show full range
          </button>
        )}
      </div>

      <div style={styles.track} onClick={handleTrackClick}>
        <div style={styles.histogram}>
          {bars.map((count, i) => (
            <div
              key={MIN_YEAR + i}
              style={{
                flex: "1 0 auto",
                height: `${Math.max(2, (count / maxCount) * 100)}%`,
                background:
                  MIN_YEAR + i >= yearRange[0] && MIN_YEAR + i <= yearRange[1]
                    ? "var(--accent-secondary)"
                    : "var(--border-subtle)",
              }}
            />
          ))}
        </div>

        <div
          style={{
            ...styles.rangeHighlight,
            left: `${yearToPercent(yearRange[0])}%`,
            width: `${yearToPercent(yearRange[1]) - yearToPercent(yearRange[0])}%`,
          }}
        />

        {scrubYear !== null && (
          <div style={{ ...styles.scrubHandle, left: `${yearToPercent(scrubYear)}%` }} />
        )}
      </div>

      <div style={styles.presetRow}>
        {[
          ["This year", 0],
          ["Last 5 yrs", 5],
          ["Last 10 yrs", 10],
          ["Last 30 yrs", 30],
        ].map(([label, yearsBack]) => (
          <button
            key={label}
            style={styles.presetButton}
            onClick={() => onYearRangeChange([maxYear - yearsBack, maxYear])}
          >
            {label}
          </button>
        ))}
        <button style={styles.presetButton} onClick={() => onYearRangeChange([MIN_YEAR, maxYear])}>
          All time
        </button>
      </div>

      <div style={styles.rangeInputs}>
        <YearInput
          value={yearRange[0]}
          min={MIN_YEAR}
          max={yearRange[1]}
          onCommit={(start) => onYearRangeChange([start, yearRange[1]])}
        />
        <span style={{ color: "var(--text-tertiary)" }}>to</span>
        <YearInput
          value={yearRange[1]}
          min={yearRange[0]}
          max={maxYear}
          onCommit={(end) => onYearRangeChange([yearRange[0], end])}
        />
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: "10px 14px 14px",
    background:
      "linear-gradient(to top, var(--bg-deep) 60%, transparent)",
    zIndex: 5,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  playButton: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: "1px solid var(--border-strong)",
    background: "var(--bg-panel-raised)",
    color: "var(--text-primary)",
    cursor: "pointer",
    fontSize: 12,
  },
  yearReadout: {
    color: "var(--text-primary)",
    fontSize: 14,
    minWidth: 90,
  },
  clearButton: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontSize: 12,
    cursor: "pointer",
    padding: "4px 6px",
  },
  track: {
    position: "relative",
    height: 40,
    cursor: "pointer",
    borderRadius: "var(--radius-sm)",
    overflow: "hidden",
    background: "var(--bg-panel)",
  },
  histogram: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "flex-end",
    gap: "1px",
    padding: "2px",
  },
  rangeHighlight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    background: "rgba(139, 147, 232, 0.14)",
    borderLeft: "1px solid var(--accent-dim)",
    borderRight: "1px solid var(--accent-dim)",
    pointerEvents: "none",
  },
  scrubHandle: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    background: "var(--accent)",
    pointerEvents: "none",
  },
  rangeInputs: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  presetRow: {
    display: "flex",
    gap: 5,
    marginTop: 8,
    flexWrap: "wrap",
  },
  presetButton: {
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-secondary)",
    padding: "4px 8px",
    fontSize: 11,
    cursor: "pointer",
  },
  yearInput: {
    width: 70,
    background: "var(--bg-panel-raised)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "4px 6px",
    fontSize: 13,
  },
};
