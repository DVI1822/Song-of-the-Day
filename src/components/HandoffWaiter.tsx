"use client";

import { useEffect } from "react";
import { clearHandoff, waitingHandoff } from "@/lib/handoff";
import { createClient } from "@/lib/supabase/client";

// After asking for a sign-in link, this screen waits for the link's page to
// hand the sign-in back (see lib/handoff). It waits on every page, not just
// the login form: a phone often reloads the home-screen app while you're off
// in your email, and it comes back on the front page.
export function HandoffWaiter() {
  useEffect(() => {
    let busy = false,
      done = false;
    const check = async () => {
      const id = waitingHandoff();
      if (done || busy || !id || document.visibilityState === "hidden") return;
      busy = true;
      const supabase = createClient();
      const { data } = await supabase.rpc("claim_handoff", { handoff: id });
      if (typeof data === "string" && data) {
        done = true;
        clearHandoff();
        const { error } = await supabase.auth.refreshSession({ refresh_token: data });
        window.location.replace(error ? "/login?error=link" : "/");
      }
      busy = false;
    };
    check();
    const t = setInterval(check, 2500);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    return () => {
      done = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
    };
  }, []);
  return null;
}
