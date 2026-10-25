"use client";

import { useEffect } from "react";

// If Supabase sends a sign-in link somewhere other than /auth/callback (it
// falls back to the site's home page when a link isn't on its allowed list),
// hand the session after the # to /auth/done.
export function SessionFromLink() {
  useEffect(() => {
    const { hash, pathname } = window.location;
    if (pathname !== "/auth/done" && hash.includes("access_token="))
      window.location.replace(`/auth/done${hash}`);
  }, []);
  return null;
}
