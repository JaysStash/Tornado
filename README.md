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

---

# Phase 4: Accounts + Chaser Submissions

Adds Supabase-backed accounts, a chase-route submission form, and a
moderation queue.

## 1. Run the database schema

Open your Supabase project dashboard -> **SQL Editor** -> **New query**,
paste the entire contents of `supabase/schema.sql`, and run it. Safe to
run once; re-running is harmless since every table uses
`create table if not exists`.

## 2. Get your API keys

Supabase dashboard -> **Project Settings** -> **API**. You need three
values:
- **Project URL**
- **anon / public key**
- **service_role key** (click "Reveal" - keep this one secret, it
  bypasses all the access rules in the database)

## 3. Set environment variables

Copy `.env.local.example` to `.env.local` and fill in the three
Supabase values above, plus Resend (next step):

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your actual values (`nano .env.local` or
`sed` per your usual workflow).

**Also add the same variables in Vercel:** Project Settings ->
Environment Variables -> add all five (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY`, `ADMIN_EMAIL`) -> redeploy. `.env.local` only affects
your local `npm run dev` - Vercel needs its own copy.

## 4. Set up Resend (for moderation email alerts)

1. Sign up free at resend.com (no credit card required)
2. Dashboard -> API Keys -> create one -> paste into `RESEND_API_KEY`
3. Set `ADMIN_EMAIL` to whatever address you want alerts sent to
4. The default sender (`onboarding@resend.dev`) works with zero extra
   setup. If you want it to send from an `@sswx.space` address instead,
   Resend has a "Domains" section to verify that - optional, not
   required for this to work.

## 5. Make yourself an admin

1. Deploy (or run locally) and sign in once with your own email via
   the Chasers tab in the menu - this creates your `auth.users` row
2. Supabase dashboard -> **Authentication** -> **Users** -> find your
   email -> copy the **User UID**
3. Supabase dashboard -> **Table Editor** -> `admins` table -> Insert
   row -> paste your User UID as `user_id`

You now see the "Moderation queue" tab with approve/reject controls.

## 6. Onboarding trusted chasers (the three paths)

All three still require the chaser to sign in once first (creates
their `auth.users` row) - after that:

- **Manual whitelist**: Table Editor -> `chasers` table -> find their
  row (created automatically the first time they submit a route, or
  insert one yourself with their `user_id`) -> set `trust_level` =
  `manual`, `status` = `active`. Their future submissions auto-publish.
- **Apply-and-approve**: they submit a route while signed in as normal
  - it lands in your moderation queue as `pending` alongside their new
  `chasers` row (also `pending_application`). Approving the route
  doesn't change their trust status - to make future submissions
  auto-publish too, set their `chasers.status` to `active` the same
  way as manual whitelisting.
- **Token-based API**: for a chaser who wants to script uploads
  instead of using the form. Generate a token yourself:

  ```bash
  # Generate a random token
  openssl rand -hex 32
  # Hash it the same way the server checks it
  echo -n "PASTE_THE_TOKEN_HERE" | sha256sum
  ```

  Give the chaser the plaintext token. In Supabase Table Editor,
  insert a row into `chaser_api_tokens` with their `chaser_id` and the
  **hash** (never the plaintext) as `token_hash`. They then POST to
  `https://your-domain/api/chaser-upload` with
  `Authorization: Bearer <token>` and a JSON body of `event_id`,
  `event_type`, `route_geojson`, and optionally `photos`. Auto-approved
  on arrival - this path is for people you already trust.

## What's implemented

- Passwordless email sign-in (magic link - no password to manage or
  reset)
- Submission form: search for the event you chased, upload a GPX or
  KML route file (parsed client-side, no server upload needed), add
  optional hotlinked photo URLs, submit
- First submission auto-creates your chaser record; trust status
  determines whether it auto-publishes or goes to moderation
- Moderation queue (admin-only, enforced by database rules - not just
  hidden UI) to approve/reject pending routes
- Email alert on new pending submissions via Resend
- Approved routes render on the map as a distinct dashed layer,
  filterable by chaser name

## Known gaps / placeholder content

- **The rights/license consent text in the submission form is
  placeholder wording**, not reviewed by a lawyer. Worth having an
  actual final version before this goes fully public.
- **No chaser public profile pages yet** - by design, that's
  post-launch per the build plan.
- **Badge tiers** (`trusted` / `verified` / `featured` in the schema)
  aren't assigned anywhere automatically - set them manually per
  chaser in the Table Editor whenever you want to.

---

# Bug fixes in this update

Three issues from testing, fixed alongside Phase 5:

1. **Hurricane tracks were too visually heavy.** Two contributing causes,
   both fixed: the line-width scale was too thick (now roughly half as
   wide across the board), and the map was loading the *entire* 75+ year
   history by default on first load, which is a lot of hurricane spaghetti
   at once regardless of width. Default view is now the last 15 years -
   expand the timeline range yourself for the full history.
2. **Clicking a tornado/hurricane track now shows a small map popup**
   with the quick facts, instead of opening the full side menu. The
   popup has a "Full stats →" button for anyone who wants the deeper
   stats-panel view.
3. **Year range inputs could be typed down to year 0.** HTML's `min`/
   `max` attributes on a number input only affect the up/down spinner
   arrows - they don't stop someone from typing an out-of-range value
   directly. Added real clamping logic so typed values can't escape
   1851-present.

---

# Phase 5: Public Launch

## Domain

Two things you flagged as undecided: `tornado.sswx.space` vs
`historic.sswx.space`. The setup steps are identical either way, so
pick whichever when you're ready and substitute it below:

1. Vercel dashboard -> your project -> **Settings -> Domains** -> add
   your chosen subdomain
2. Vercel shows you a CNAME record to add - copy it
3. GoDaddy -> your domain -> **DNS** -> add that CNAME record
   (Host: `tornado` or `historic`, pointing at what Vercel gave you)
4. Wait for DNS to propagate (usually minutes, sometimes longer) -
   Vercel's domain page shows a checkmark once it's live

## Donation link

`lib/config.js` has a `DONATION_URL` constant, empty by default - the
"Support" link in the top bar only renders when it's set, so this is
safe to leave blank until you have a Ko-fi or Buy Me a Coffee page.
Once you do:

```js
export const DONATION_URL = "https://ko-fi.com/yourpage";
```

Ad support wasn't built this round - per the build plan, that's a
later evaluation once there's real traffic to justify it.

## Preliminary-event visibility

Preliminary (unsurveyed tornadoes / in-progress hurricane seasons) now
render with a dashed line directly on the map, not just in the click
popup - so it's visible at a glance which tracks aren't finalized yet.

## Chaser badges

The `trusted` / `verified` / `featured` badge tiers (set manually per
chaser in Supabase, per the Phase 4 section above) now show up in the
chase-route map popup and in the moderation queue. Renaming the tiers
is possible but means updating the `check` constraint on `chasers.badge`
in the schema, not just a text change - ask if you want that changed.

## Other launch polish

- Custom favicon (a small tornado-funnel icon, matches the site's
  accent color)
- `robots.txt` allowing indexing

---

# Data fix: current-year tornadoes weren't showing

Not actually a bug in the code - the annual finalized SPC database
(what Phase 1's `fetch-tornadoes.js` pulls) only contains fully
surveyed prior years. The current year's tornadoes don't exist in that
file until SPC finalizes and re-releases it, typically the following
spring or summer. There was never a code path pulling in-progress-year
data, so it was correctly showing nothing - just not what anyone
looking at the map would expect.

**Fix:** `scripts/fetch-current-year-tornadoes.js` now pulls SPC's
separate daily preliminary Local Storm Report files
(`{YYMMDD}_rpts_filtered_torn.csv`, one per calendar day) for the
current year to date, and `build-static-data.js` merges them in -
automatically, only for years the finalized database doesn't already
cover. The moment SPC's real survey data for a year lands in the
finalized file (next year, for 2026), this stops using the
preliminary stand-in for that year on its own - no manual cleanup.

**Worth knowing about this data:**
- These are single-point reports (where a tornado was seen), not
  surveyed start/end tracks - they render as points, not lines, same
  as the rare touchdown-only records in the finalized dataset
- The F-scale shown is an on-scene estimate, not a post-storm survey
  rating - treat it as rougher than the finalized EF ratings
- **This format is based on general knowledge of a long-standing SPC
  data product, not a verified live fetch** - spc.noaa.gov blocks
  automated access from where this was built, so the exact current
  column layout couldn't be directly confirmed before shipping. Run
  `npm run update:all` and sanity-check
  `data/raw/current-year-torn.csv` looks right (real dates, plausible
  lat/lon) before trusting it blindly. If SPC changed their format,
  the parser will likely just silently produce zero rows rather than
  crash - worth a look if 2026 still shows nothing after running this.

---

# Phase 6: Post-launch

## Chaser public profile pages

`/chasers/[id]` - bio, badge, and their published routes. Linked from
the "View profile →" line in any chase-route map popup. Public, no
sign-in needed to view (same as browsing the map itself).

## Badge visual refinement

The three badge tiers now render in distinct colors (trusted = amber,
verified = cyan, featured = pink) instead of one flat style, wherever
a badge shows up - map popups, moderation queue, profile pages.

## Ad support - not built this round, and here's the honest read on why

The build plan flagged this as "evaluate once there's real traffic to
justify it," and that's still the right call: there's no traffic data
yet since the domain isn't live. A few things worth knowing whenever
that evaluation happens:
- Display ad networks (the realistic free-tier option) generally need
  a meaningful, sustained visitor baseline before approval or payout
  is worth the effort - applying too early usually just means
  rejection or pennies
- A map-forward, dark-themed site is a genuinely awkward fit for
  typical banner/display ad units visually - would need real design
  thought about where an ad could go without wrecking the look, not
  just dropping a script tag in
- Donations are already wired up (Phase 5) and cost nothing to leave
  running indefinitely - worth letting that sit for a while before
  layering in ads at all

Not a "come back in X months" - just flagging that this one benefits
from actually having numbers to look at, which nothing else in this
build needed.

---

# Open decisions - resolved

**Domain: recommending `historic.sswx.space`.** `tornado.sswx.space`
undersells it now that hurricanes, chaser routes, and everything else
are part of the site - same naming mismatch that came up with the
GitHub repo being called "Tornado" despite covering both. Switching
a Vercel domain later is trivial if you'd rather go the other way -
this isn't a load-bearing decision.

**Badge tier names: keeping Trusted / Verified / Featured.** Already
built, already sensible, no reason to relitigate without a specific
alternative in mind. Say the word if you want different names -
it's a one-line schema change plus updating `BADGE_COLORS` in
`lib/colors.js`.

**License wording: tightened**, still explicitly flagged as
placeholder / not legal advice in the UI itself. Chasers now see they
retain ownership, the license is revocable, and removal can be
requested anytime - more concrete than the first draft without
pretending to be real legal language.

---

# Three additions

Picked for genuine fit with what already exists here, not just
novelty:

**1. Per-event animated playback.** Click any tornado or hurricane
track, and the popup now has a "▶ Animate track" button - a marker
travels the actual path with a growing trail behind it. This was
implicit in the very first ask ("track playback that draws in") but
never actually got built as a per-event thing, only as the global
timeline reveal. Tornado tracks animate the straight touchdown-to-
liftoff line; hurricane tracks animate through every real 6-hourly
position, so multi-day storms actually read as a multi-day
progression, not just a fast line-draw.

**2. On This Day.** In the new Discover tab - checks the full archive
for tornadoes and hurricanes that happened on today's calendar date,
any year. Manually triggered (a button, not automatic) since it loads
the complete dataset - didn't want that data cost happening silently
the moment someone opens a menu tab.

**3. Storms Near Me.** Also in Discover - uses the browser's location
API to find everything within 60 miles of you, all-time, and flies
the map there. Same manual-trigger reasoning as above, plus it needs
explicit permission anyway.

---

# Flagship events

Seeded with two entries, each with a real, checked link - not
padded out with placeholders:
- **2011 Super Outbreak**, linking to NWS Birmingham's event summary
- **Hurricane Katrina**, linking to NHC's actual Tropical Cyclone
  Report PDF

This is genuinely a manual-curation feature (per the original
scoping - no bulk photo/writeup feed exists to automate this from),
so it grows exactly as fast as you add to `lib/flagshipEvents.js`
by hand. Each entry needs either an `eventId` matching a real record
in the static data, or a `yearRange` for outbreaks spanning many
individual tornadoes.

---

# Theme: cool tones

New palette - black/gray base with periwinkle as the primary accent
and baby blue as a secondary one (timeline highlight, preliminary
badges), replacing the old dark-navy/amber scheme. Typography is now
Agbalumo for headers (bold, curvy display face - scoped to short text
only, since it's genuinely hard to read at paragraph length) paired
with Nunito Sans for body/UI text; IBM Plex Mono stays for numbers
and coordinates since that's a legibility choice, not a brand one.

**One deliberate exception:** the tornado EF-rating and hurricane
category color ramps (green-through-purple, blue-through-pink)
*didn't* change. Those aren't brand colors, they're a real
meteorological convention - remapping them to fit a cool-tone palette
would actively hurt usability for exactly the audience (chasers,
meteorologists) this site is built for. Everything else - backgrounds,
panels, borders, buttons, badges, the map's basemap tuning - follows
the new palette throughout.
