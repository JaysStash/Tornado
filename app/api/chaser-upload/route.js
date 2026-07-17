// Token-based upload path for trusted chasers who'd rather script their
// uploads than use the web form. See README "Issuing an API token" for
// how Jay generates a token for a chaser - there's no self-serve UI for
// this on purpose, it's a manual trust decision.
import crypto from "node:crypto";
import { supabaseAdmin, supabaseAdminConfigured } from "../../../lib/supabaseAdmin";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request) {
  if (!supabaseAdminConfigured) {
    return Response.json({ error: "Server not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return Response.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const tokenHash = hashToken(token);
  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from("chaser_api_tokens")
    .select("id, chaser_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenErr || !tokenRow) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.event_id || !body?.event_type || !body?.route_geojson) {
    return Response.json(
      { error: "Required: event_id, event_type, route_geojson" },
      { status: 400 }
    );
  }
  if (!["tornado", "hurricane"].includes(body.event_type)) {
    return Response.json({ error: "event_type must be 'tornado' or 'hurricane'" }, { status: 400 });
  }

  const { data: route, error: routeErr } = await supabaseAdmin
    .from("chase_routes")
    .insert({
      event_id: body.event_id,
      event_type: body.event_type,
      chaser_id: tokenRow.chaser_id,
      route_geojson: body.route_geojson,
      status: "auto_approved",
      approved_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (routeErr) {
    return Response.json({ error: routeErr.message }, { status: 500 });
  }

  if (Array.isArray(body.photos) && body.photos.length > 0) {
    await supabaseAdmin.from("route_photos").insert(
      body.photos
        .filter((p) => p?.url)
        .map((p) => ({
          route_id: route.id,
          hotlink_url: p.url,
          caption: p.caption || null,
        }))
    );
  }

  await supabaseAdmin
    .from("chaser_api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  return Response.json({ ok: true, route_id: route.id });
}
