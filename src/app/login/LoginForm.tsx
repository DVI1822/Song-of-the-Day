"use client";

import { useState } from "react";
import { Card, buttonClass, inputClass } from "@/components/Shell";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState(initialError);

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
