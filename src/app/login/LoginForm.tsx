"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, buttonClass, inputClass } from "@/components/Shell";
import { newHandoff } from "@/lib/handoff";
import { createClient, createLinkClient } from "@/lib/supabase/client";

// Email only. Spotify sign-in is off while the Spotify app is in development
// mode, which lets in just 5 allowlisted accounts; Spotify is linked from
// Settings instead.
// The email carries a code ({{ .Token }} in Supabase's Magic Link and Confirm
// signup emails) as well as the link. Typing the code signs in right here,
// whichever app or browser this is, which is the sure way on a phone's home
// screen app. NEXT_PUBLIC_EMAIL_CODE=off hides the code box.
const withCode = process.env.NEXT_PUBLIC_EMAIL_CODE !== "off";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState(initialError);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const router = useRouter();

  // The same email carries a code, for when the link would open in another
  // browser (like a home-screen app on a phone): type it here instead.
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(undefined);
    const { error } = await createClient().auth.verifyOtp({ email, token: code, type: "email" });
    if (error) {
      setError("That code didn't work. Check the newest email, or send a new one.");
      setChecking(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(undefined);
    const { error } = await createLinkClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?h=${newHandoff()}` },
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
          We sent an email to <strong className="text-card-ink">{email}</strong>.
          {withCode ? " Type the code from it here." : " Tap the link in it and this screen signs you in."}
        </p>
        {withCode && (
          <form onSubmit={verify} className="mt-5 flex flex-col gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              aria-label="Code from the email"
              className="h-16 w-full rounded-2xl border border-line bg-white text-center font-bubble text-[30px] tracking-[0.35em] text-card-ink outline-none placeholder:text-card-muted/40 focus:border-accent"
            />
            {error && <p className="text-sm text-accent-deep">{error}</p>}
            <button className={buttonClass} disabled={code.length < 6 || checking}>
              {checking ? "Checking…" : "Sign in with code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setState("idle");
                setCode("");
                setError(undefined);
              }}
              className="text-xs font-semibold text-card-muted"
            >
              Use a different email
            </button>
          </form>
        )}
      </Card>
    );
  }

  return (
    <Card>
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
          {state === "sending" ? "Sending…" : "Email me a sign-in code"}
        </button>
        <p className="text-xs text-card-muted">No password needed. New here? The same code creates your account.</p>
      </form>
    </Card>
  );
}
