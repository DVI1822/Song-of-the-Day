"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

// Supabase lets one address ask for a new email once a minute.
const RESEND_SECONDS = 60;

// Turns Supabase's sign-in email errors into words a person can act on.
function sendErrorMessage(error: { message: string; status?: number; code?: string }) {
  const msg = error.message.toLowerCase();
  if (error.code === "over_email_send_rate_limit" || msg.includes("rate limit")) {
    return "We've hit our limit on sign-in emails for the moment. Try again in a little while.";
  }
  if (error.code === "over_request_rate_limit" || error.status === 429 || msg.includes("security purposes")) {
    return "Hang on a minute before asking for another email.";
  }
  if (msg.includes("not authorized")) {
    return "Our email sender can't reach that address yet. We're fixing it, so try again later.";
  }
  if (error.code === "email_address_invalid" || msg.includes("invalid")) {
    return "That email address doesn't look right. Check it and try again.";
  }
  return error.message;
}

export function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState(initialError);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [wait, setWait] = useState(0);
  const [resent, setResent] = useState(false);
  const router = useRouter();

  // Counts down until "Send it again" can be pressed.
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

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

  function send() {
    return createLinkClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?h=${newHandoff()}` },
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(undefined);
    const { error } = await send();
    if (error) {
      setError(sendErrorMessage(error));
      setState("idle");
    } else {
      setState("sent");
      setResent(false);
      setWait(RESEND_SECONDS);
    }
  }

  async function resend() {
    setError(undefined);
    setWait(RESEND_SECONDS);
    const { error } = await send();
    if (error) setError(sendErrorMessage(error));
    else setResent(true);
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
        {!withCode && error && <p className="mt-3 text-sm text-accent-deep">{error}</p>}
        <div className="mt-5 border-t border-line pt-4 text-xs text-card-muted">
          <p>
            Not there? Give it a minute, then check Spam. Yahoo and AOL call it <strong>Bulk</strong>.
            {resent && " We sent a new one, so use the newest email."}
          </p>
          <button
            type="button"
            onClick={resend}
            disabled={wait > 0}
            className="mt-2 font-semibold text-accent-deep disabled:text-card-muted"
          >
            {wait > 0 ? `Send it again in ${wait}s` : "Send it again"}
          </button>
        </div>
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
