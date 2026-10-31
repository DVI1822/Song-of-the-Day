"use client";

import { createClient as createPlainClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { clearHandoff, waitingHandoff } from "@/lib/handoff";
import { createClient } from "@/lib/supabase/client";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

// Where an email sign-in link ends up: the session rides after the #, so it
// works in whatever browser opened the link. If this is the browser that
// asked for the link, sign in here. If another screen is waiting for it (on a
// phone, the app on the home screen), hand the sign-in over to that screen
// instead and say to go back there; this browser stays signed out, so the two
// never fight over the same session.
export default function AuthDone() {
  const router = useRouter();
  const [handed, setHanded] = useState<{ access_token: string; refresh_token: string; h: string } | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    const h = new URLSearchParams(window.location.search).get("h");
    history.replaceState(null, "", window.location.pathname);
    if (!access_token || !refresh_token) {
      router.replace("/login?error=link");
      return;
    }
    const here = () =>
      createClient()
        .auth.setSession({ access_token, refresh_token })
        .then(({ error }) => {
          clearHandoff();
          router.replace(error ? "/login?error=link" : "/");
          router.refresh();
        });
    if (!h || waitingHandoff() === h) return void here();
    const asThem = createPlainClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${access_token}` } },
    });
    asThem.rpc("put_handoff", { handoff: h, token: refresh_token }).then(({ error }) => {
      if (error) here(); // can't hand it over: sign in here, as before
      else setHanded({ access_token, refresh_token, h });
    });
  }, [router]);

  // changed their mind: take the sign-in back (if the other screen hasn't yet)
  const stayHere = async () => {
    if (!handed) return;
    const { data } = await createClient().rpc("claim_handoff", { handoff: handed.h });
    if (typeof data !== "string" || !data) return router.replace("/login");
    const { error } = await createClient().auth.setSession({ access_token: handed.access_token, refresh_token: data });
    router.replace(error ? "/login?error=link" : "/");
    router.refresh();
  };

  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        {handed ? (
          <>
            <h1 className="display text-3xl">You&apos;re signed in</h1>
            <p className="max-w-[300px] text-muted">
              Go back to Song of the Day where you asked for the link. It signs you in by itself.
            </p>
            <button type="button" onClick={stayHere} className="mt-4 text-sm font-semibold text-muted underline-offset-2 hover:underline">
              Use it in this browser instead
            </button>
          </>
        ) : (
          <div className="text-sm text-muted">Signing you in…</div>
        )}
      </div>
    </Shell>
  );
}
