"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { isApp, rememberSignIn, savedSignIn } from "@/lib/native";
import { createClient } from "@/lib/supabase/client";

// Only inside the TopTrack iPhone app (see lib/native).
//
// Staying signed in: each time the app sees a sign-in, it keeps a copy in
// the phone's own storage. If the web view ever comes back without one (iOS
// can drop a web view's cookies), the copy signs straight back in. Signing
// out or deleting your account ends that sign-in on Supabase's side, so the
// copy stops working and is thrown away.
//
// Coming back to the app on a new day, or after a few hours, reloads it so
// it opens on today's songs instead of wherever it was left. (Not sooner:
// people pop out to copy a song link and come straight back.)
const STALE = 3 * 60 * 60 * 1000;

export function AppBoot() {
  useEffect(() => {
    if (!isApp()) return;
    document.documentElement.dataset.app = "ios";
    const supabase = createClient();

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return rememberSignIn(data.session.refresh_token);
      if (window.location.pathname.startsWith("/auth")) return;
      const saved = await savedSignIn();
      if (!saved) return;
      const { data: back, error } = await supabase.auth.refreshSession({ refresh_token: saved });
      if (error || !back.session) return rememberSignIn(null);
      await rememberSignIn(back.session.refresh_token);
      window.location.replace("/");
    })();

    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) void rememberSignIn(session.refresh_token);
    });

    let away = 0;
    const listener = App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) away = Date.now();
      else if (away && (Date.now() - away > STALE || new Date(away).toDateString() !== new Date().toDateString()))
        window.location.reload();
    });

    return () => {
      auth.subscription.unsubscribe();
      void listener.then((l) => l.remove());
    };
  }, []);
  return null;
}
