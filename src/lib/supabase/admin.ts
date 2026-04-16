import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client using the service-role key.
 * Only use server-side for privileged operations (inviting users, etc.).
 * Never import this in client components.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
