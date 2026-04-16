import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for use in the browser (React components).
 * Call this inside onClick handlers, useEffect, etc.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
