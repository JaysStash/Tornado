# Storm Archive — Phase 1: Data Pipeline

This repo pulls the SPC tornado database + NHC HURDAT2 hurricane database
and turns them into static GeoJSON files, split by decade, ready to serve
from Vercel with no database needed for the historical bulk data.

## Setup — do this once

### 1. Create the GitHub repo
1. Go to github.com/new
2. Name it `storm-archive` (or whatever you want — update remotes below to match)
3. Leave it empty — no README/gitignore from GitHub, since this zip has them
4. Create it, copy the repo URL (e.g. `https://github.com/yourname/storm-archive.git`)

### 2. New Termux session for this project
Termux keeps every session's shell separate, so working in a new session
won't touch whatever's running in your other projects' sessions.
1. Open Termux
2. Swipe in from the left edge (or tap the hamburger icon top-left) to open the session drawer
3. Tap "New session" at the bottom of the drawer
4. That's a fresh shell — `cd` to wherever you keep your repos (e.g. `cd ~/storage/shared/projects` or `cd ~`)

You can flip between this and your other project's session anytime from that same drawer — they don't interfere with each other.

### 3. Vercel account
1. Go to vercel.com, sign up/log in with your GitHub account (keeps deploys automatic on push)
2. Don't import the project yet — there's no frontend to deploy in Phase 1. We'll do this in Phase 2 when there's a Next.js app to point it at.

### 4. Supabase account
1. Go to supabase.com, sign up/log in with GitHub
2. Create a new project (pick a region close to you, set a DB password, save it somewhere)
3. Not used yet in Phase 1 either — accounts/chaser submissions come in Phase 4. Just get the account made now so it's ready.

## Setup — this repo

```bash
cd storm-archive
git init
git remote add origin https://github.com/yourname/storm-archive.git
npm install
```

## Running the pipeline

```bash
npm run update:all
```

This runs all three steps in order:
1. `fetch:tornadoes` — downloads the SPC tornado CSV into `data/raw/torn.csv`
2. `fetch:hurricanes` — downloads HURDAT2 into `data/raw/hurdat2.txt`
3. `build:data` — parses both and writes decade-split GeoJSON into `data/processed/`

You can also run any step alone, e.g. `npm run fetch:tornadoes`.

### Output structure
```
data/processed/
  tornadoes/
    index.json       <- list of available decades + total count
    1950s.geojson
    1960s.geojson
    ... etc
  hurricanes/
    index.json
    1850s.geojson
    1860s.geojson
    ... etc
```

The frontend (Phase 2) reads `index.json` first, then fetches only the
decade files it needs for whatever's on screen — never the whole 75+
year dataset at once.

## A heads up on the two source URLs

Both SPC and NHC rename their bulk-download files as data gets updated:
- `scripts/fetch-tornadoes.js` points at `1950-2025_actual_tornadoes.csv`
  (verified 2026-07-13 against SPC's naming convention — don't fall
  back to the older `*_torn.csv` pattern seen in old tutorials, it's
  retired)
- `scripts/fetch-hurdat2.js` points at `hurdat2-1851-2025-02272026.txt`
  (verified 2026-07-13 directly against https://www.nhc.noaa.gov/data/ —
  NHC's trailing date stamp is the processing date, not guessable from
  a pattern)

If either fetch script starts failing with a 404, that's why — check
https://www.spc.noaa.gov/wcm/#data or https://www.nhc.noaa.gov/data/#hurdat
for the current filename and update the URL constant at the top of the
script.

## The auto-update cron

`.github/workflows/update-data.yml` runs this whole pipeline daily at
09:00 UTC via GitHub Actions (free for public repos), and commits any
changes to `data/processed/` automatically. You can also trigger it by
hand from the repo's Actions tab → "Update storm data" → "Run workflow".

It only needs to exist in GitHub — no Termux or local involvement once
it's pushed.

## Known data limitation (not a bug)

SPC's tornado tracks are a straight line from touchdown to lift-off,
not the tornado's actual curving ground path — that's how SPC's own
database represents them, so it carries through here. Worth remembering
when the map shows a perfectly straight tornado line.

## Push this to GitHub

```bash
git add .
git commit -m "Phase 1: data pipeline for tornado + hurricane GeoJSON"
git push -u origin main
```

(If your default branch is `master` instead of `main`, swap it above.)

## What's next

Phase 2 is the Mapbox/MapLibre dark map + track rendering + stats panel,
built against the `data/processed/` output this pipeline produces.

---

# Phase 2 + 3: Map, Filters, Stats, Timeline

Adds the actual site: a full-screen dark map (MapLibre GL, no API key
needed - uses CARTO's free vector basemaps), tornado/hurricane track
rendering colored by EF rating / hurricane category, a filter + stats
menu, and a history timeline with a year-density histogram.

## Important: re-run the data pipeline after pulling this update

The tornado parser picked up two new fields (`year`, `property_loss`,
`crop_loss`) and the build script now also emits per-year count
summaries for the timeline. If your `data/processed/` folder was built
before this update, it's missing these - regenerate it:

```bash
npm install
npm run update:all
git add data/processed/
git commit -m "Regenerate data with year/loss fields + year-counts"
git push
```

Skipping this step won't crash the site, but the timeline histogram
will be empty and event stats will show blanks for loss/year fields
until you do.

## Running it locally

```bash
npm install
npm run dev
```

Opens on http://localhost:3000 (or whatever port Termux/your browser
shows). The `predev`/`prebuild` scripts automatically copy
`data/processed/` into `public/data/` before Next.js starts - you
don't need to do that by hand.

## Deploying to Vercel

1. In the Vercel dashboard: **Add New Project** → import this repo
2. Framework preset should auto-detect as Next.js - leave defaults as-is
3. No environment variables needed yet (Supabase isn't wired in until Phase 4)
4. Deploy

Every push to `main`/`master` auto-deploys from here on, same as
you're used to with your other StormSync properties.

## What's implemented

- **Map**: MapLibre GL JS, CARTO's free dark basemap re-tuned for
  visible borders/cities/roads against a dark (not black) background
- **Tornado tracks**: colored by EF rating, line width scaled to
  reported damage-path width
- **Hurricane tracks**: colored by Saffir-Simpson category, line width
  scaled to peak wind intensity (HURDAT2 has no single "width" field
  the way tornado records do, so intensity stands in as the analogous
  scale)
- **Filters**: event type, EF rating, hurricane category, state -
  all combinable
- **Stats panel** (in the hamburger menu): per-event detail on
  whatever's clicked, plus aggregate stats for the current timeline
  range or all-time (busiest/least busy years, busiest months, top
  outbreak days, longest/shortest tracks, deadliest tornadoes, states
  with the most EF4+ tornadoes)
- **Timeline**: year-range scrubber with a density histogram showing
  which years were busiest, plus play/pause animated reveal

## Known gaps (by design, not oversights)

- **No "deadliest hurricanes" stat.** HURDAT2 - the actual source this
  pipeline pulls - only has position/wind/pressure, no fatality or
  damage figures. Adding that would mean pulling in a second,
  separate dataset. Flagged in the stats panel itself rather than
  silently missing.
- **"Top outbreak days" is a count-based heuristic**, not an official
  outbreak classification. Real outbreak naming involves synoptic
  judgment this data alone can't capture. Labeled as such in the UI.
- **Flagship event photo/radar curation hasn't started.** As covered
  when we first scoped this, there's no clean bulk photo feed to
  auto-scrape, so this stays a manual curation task for specific
  events - not built into Phase 2/3.
- **Global timeline scrubber performance hasn't been tested on an
  actual phone yet.** The implementation is built to be efficient
  (filters data already loaded in the browser rather than refetching
  on every scrub tick), but the build plan called for testing this on
  a real device before committing to it over a per-event-only
  fallback. Try it on your phone once this is deployed - if it lags,
  say so and we'll scope it back.
