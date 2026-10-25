"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Shell } from "@/components/Shell";
import { createClient } from "@/lib/supabase/client";

// Where an email sign-in link ends up: the session rides after the #, so it
// works in whatever browser opened the link. Save it as cookies and go in.
export default function AuthDone() {
  const router = useRouter();
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    history.replaceState(null, "", window.location.pathname);
    if (!access_token || !refresh_token) {
      router.replace("/login?error=link");
      return;
    }
    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        router.replace(error ? "/login?error=link" : "/");
        router.refresh();
      });
  }, [router]);

  return (
    <Shell>
      <div className="flex flex-1 items-center justify-center text-sm text-muted">Signing you in…</div>
    </Shell>
  );
}
