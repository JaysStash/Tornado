// SERVER-ONLY. This uses the service role key, which bypasses Row Level
// Security entirely. Never import this file from a "use client" component
// or anything that ships to the browser - it belongs in app/api/ route
// handlers only, where it runs on Vercel's server.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdminConfigured = Boolean(supabaseUrl && serviceRoleKey);

export const supabaseAdmin = supabaseAdminConfigured
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
