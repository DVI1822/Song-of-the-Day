"use client";

import { useState } from "react";
import { Card, buttonClass, inputClass } from "@/components/Shell";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState(initialError);
  const [spotifyBusy, setSpotifyBusy] = useState(false);

  // Spotify sends people back through Supabase to /auth/callback. Spotify
  // shares their email, so the invite list works the same as for email links.
  async function spotify() {
    setSpotifyBusy(true);
    setError(undefined);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "spotify",
      options: { redirectTo: `${window.location.origin}/auth/callback`, scopes: "user-read-email" },
    });
    if (error) {
      setError(error.message);
      setSpotifyBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(undefined);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setState("idle");
    } else {
      setState("sent");
    }
  }

  if (state === "sent") {
    return (
      <Card className="rise-in">
        <h2 className="display text-xl">Check your email</h2>
        <p className="mt-2 text-sm text-card-muted">
          We sent a sign-in link to <strong className="text-card-ink">{email}</strong>. Open it on this device and
          you&apos;re in.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <button
        type="button"
        onClick={spotify}
        disabled={spotifyBusy}
        className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-[#1DB954] text-[15px] font-semibold text-black disabled:opacity-60"
      >
        <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.4a.62.62 0 0 1-.86.2c-2.35-1.43-5.3-1.76-8.78-.96a.62.62 0 1 1-.28-1.22c3.8-.87 7.07-.5 9.7 1.12.3.18.39.57.21.86zm1.22-2.72a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.57 11.24 1.33.37.22.48.7.25 1.07zm.1-2.83C14.7 8.94 9.37 8.76 6.3 9.7a.94.94 0 1 1-.54-1.8c3.53-1.07 9.4-.86 13.1 1.34a.94.94 0 0 1-.95 1.61z" />
        </svg>
        {spotifyBusy ? "Opening Spotify…" : "Continue with Spotify"}
      </button>
      <div className="my-5 flex items-center gap-3 text-xs text-card-muted">
        <div className="h-px flex-1 bg-card-ink/12" />
        or
        <div className="h-px flex-1 bg-card-ink/12" />
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Sign in or join with your email</span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        {error && <p className="text-sm text-accent-deep">{error}</p>}
        <button className={buttonClass} disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
        <p className="text-xs text-card-muted">No password needed. New here? The same link creates your account.</p>
      </form>
    </Card>
  );
}
