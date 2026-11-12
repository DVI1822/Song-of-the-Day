"use client";

import { useActionState, useEffect, useState } from "react";
import { saveProfile } from "@/app/actions";
import { buttonClass, inputClass } from "@/components/Shell";

export function ProfileForm({
  submitLabel,
  initial,
}: {
  submitLabel: string;
  initial?: { username: string; display_name: string; first_name?: string | null; last_name?: string | null };
}) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  // People who joined with one name field get it split as a starting guess.
  const [guessFirst, ...rest] = (initial?.display_name ?? "").trim().split(/\s+/);
  const first = initial?.first_name ?? guessFirst ?? "";
  const last = initial?.last_name ?? rest.join(" ");
  const [timezone, setTimezone] = useState("UTC");
  useEffect(() => {
    // Your midnight is when your song moves to the archive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  }, []);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-sm font-semibold">First name</span>
          <input
            name="first_name"
            required
            maxLength={30}
            defaultValue={first}
            placeholder="Derek"
            autoComplete="given-name"
            autoCapitalize="words"
            className={inputClass}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-sm font-semibold">Last name</span>
          <input
            name="last_name"
            required
            maxLength={30}
            defaultValue={last}
            placeholder="Smith"
            autoComplete="family-name"
            autoCapitalize="words"
            className={inputClass}
          />
        </label>
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Username</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-card-muted">@</span>
          <input
            name="username"
            required
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_]+"
            defaultValue={initial?.username}
            placeholder="derek"
            autoCapitalize="none"
            autoCorrect="off"
            className={`${inputClass} pl-9 lowercase`}
          />
        </div>
      </label>
      <input type="hidden" name="timezone" value={timezone} />
      {state?.error && <p className="text-sm text-accent-deep">{state.error}</p>}
      <button className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
