-- Storm Archive - Phase 4 schema
-- Run this once in your Supabase project's SQL Editor (Dashboard -> SQL Editor -> New query).
-- Safe to run top-to-bottom in a single paste.

-- Chasers: one row per person with a role beyond anonymous browsing.
-- Requires a Supabase Auth account first (sign in via magic link creates
-- the auth.users row; a chasers row gets created the first time someone
-- submits a route - see SubmissionForm.js).
create table if not exists chasers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  display_name text not null,
  bio text,
  trust_level text not null default 'applied' check (trust_level in ('manual', 'applied', 'token')),
  status text not null default 'pending_application' check (status in ('active', 'pending_application', 'suspended')),
  badge text check (badge in ('trusted', 'verified', 'featured')),
  created_at timestamptz not null default now()
);

-- API tokens for the token-based trusted-chaser upload path
-- (see app/api/chaser-upload/route.js). Deliberately has NO RLS policies
-- below beyond enabling RLS - meaning it's unreachable from the browser
-- entirely. Only the server-side service-role key can read it.
create table if not exists chaser_api_tokens (
  id uuid primary key default gen_random_uuid(),
  chaser_id uuid not null references chasers(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- One row per chaser's submitted route for one tornado/hurricane. event_id
-- is a plain text field (not a foreign key) since events live in the
-- static GeoJSON from Phase 1, not a database table.
create table if not exists chase_routes (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  event_type text not null check (event_type in ('tornado', 'hurricane')),
  chaser_id uuid not null references chasers(id) on delete cascade,
  route_geojson jsonb not null,
  status text not null default 'pending' check (status in ('auto_approved', 'pending', 'rejected')),
  notes text,
  submitted_at timestamptz not null default now(),
  approved_at timestamptz
);

-- Optional hotlinked photos attached to a route. hotlink_url only - photos
-- are never stored/uploaded here, per the "chasers hotlink their own" decision.
create table if not exists route_photos (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references chase_routes(id) on delete cascade,
  hotlink_url text not null,
  caption text,
  taken_at timestamptz
);

-- Saved events for signed-in users.
create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  event_type text not null check (event_type in ('tornado', 'hurricane')),
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

-- Who can moderate. After you sign in for the first time, add yourself
-- here manually via the Supabase Table Editor (Dashboard -> Table Editor
-- -> admins -> Insert row -> paste your user_id from the auth.users table).
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table chasers enable row level security;
alter table chaser_api_tokens enable row level security;
alter table chase_routes enable row level security;
alter table route_photos enable row level security;
alter table favorites enable row level security;
alter table admins enable row level security;

-- chasers: public can see active chasers; you can always see your own row
-- (including while pending); admins can do anything (approving applications).
--
-- Insert is restricted to the safe starting values only (pending_application
-- / applied) - same reasoning as the chase_routes insert check below: never
-- trust the client to self-report a privileged status.
create policy "chasers_select" on chasers for select using (
  status = 'active' or user_id = auth.uid()
);
create policy "chasers_insert_own" on chasers for insert with check (
  user_id = auth.uid()
  and status = 'pending_application'
  and trust_level = 'applied'
);
create policy "chasers_update_own" on chasers for update using (user_id = auth.uid());
create policy "chasers_admin_all" on chasers for all using (
  exists (select 1 from admins where user_id = auth.uid())
);

-- UPDATE's WITH CHECK can't reliably compare against the pre-update row
-- (self-referential subqueries there are ambiguous about old-vs-new
-- visibility), so status/trust_level/badge are locked from self-editing
-- via a trigger instead, which has unambiguous OLD/NEW access. Non-admins
-- can still update their own display_name/bio freely - the update policy
-- above already permits any column, this trigger just silently reverts
-- the three trust-sensitive ones unless the actor is an admin.
create or replace function prevent_chaser_self_escalation()
returns trigger as $$
begin
  -- auth.uid() is null when there's no user JWT in play - that's the
  -- Supabase dashboard's Table Editor, or a service-role request. Only
  -- enforce this against an actual authenticated, non-admin client
  -- request; don't block Jay's own manual edits in the dashboard.
  if auth.uid() is not null and not exists (select 1 from admins where user_id = auth.uid()) then
    new.status := old.status;
    new.trust_level := old.trust_level;
    new.badge := old.badge;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists chasers_prevent_self_escalation on chasers;
create trigger chasers_prevent_self_escalation
  before update on chasers
  for each row
  execute function prevent_chaser_self_escalation();

-- chase_routes: public sees auto_approved routes; chasers can see their
-- own regardless of status; only admins can flip status after the fact
-- (moderation). The insert check below is the important part: it's not
-- enough to check chaser_id ownership, because the app decides client-side
-- whether a submission should be "auto_approved" or "pending" - without
-- this second condition, a tampered client could insert status =
-- 'auto_approved' directly and skip moderation entirely regardless of
-- actual trust level. This enforces that only a chaser whose row is
-- already status = 'active' may self-insert as auto_approved; everyone
-- else can only insert as pending, no matter what the client sends.
create policy "routes_select" on chase_routes for select using (
  status = 'auto_approved'
  or chaser_id in (select id from chasers where user_id = auth.uid())
);
create policy "routes_insert_own" on chase_routes for insert with check (
  chaser_id in (select id from chasers where user_id = auth.uid())
  and (
    status = 'pending'
    or (
      status = 'auto_approved'
      and chaser_id in (select id from chasers where user_id = auth.uid() and status = 'active')
    )
  )
);
create policy "routes_admin_all" on chase_routes for all using (
  exists (select 1 from admins where user_id = auth.uid())
);

-- route_photos: follows the parent route's visibility.
create policy "photos_select" on route_photos for select using (
  route_id in (
    select id from chase_routes
    where status = 'auto_approved'
       or chaser_id in (select id from chasers where user_id = auth.uid())
  )
);
create policy "photos_insert_own" on route_photos for insert with check (
  route_id in (
    select id from chase_routes
    where chaser_id in (select id from chasers where user_id = auth.uid())
  )
);

-- favorites: fully private to the owning user.
create policy "favorites_own" on favorites for all using (user_id = auth.uid());

-- admins: readable only by admins themselves (doesn't leak who's an admin
-- to anyone else). No insert/update policy - you manage this table only
-- via the Supabase Table Editor, never from the app.
create policy "admins_select_self" on admins for select using (user_id = auth.uid());
