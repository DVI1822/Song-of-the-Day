import { createBrowserClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "./env";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}

// Only for sending the sign-in email. The usual client sends a link that
// works only in the browser the email was typed into, but on a phone the
// link opens in Mail's or Gmail's own browser. This one sends a link that
// carries the session itself, so it works anywhere (see /auth/done).
export function createLinkClient() {
  return createPlainClient(supabaseUrl, supabaseKey, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
