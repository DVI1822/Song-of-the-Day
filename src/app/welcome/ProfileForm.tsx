"use client";

import { useActionState, useEffect, useState } from "react";
import { saveProfile } from "@/app/actions";
import { buttonClass, inputClass } from "@/components/Shell";

export function ProfileForm({
  submitLabel,
  initial,
}: {
  submitLabel: string;
  initial?: { username: string; display_name: string };
}) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  const [timezone, setTimezone] = useState("UTC");
  useEffect(() => {
    // Your midnight is when your song moves to the archive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  }, []);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Your name</span>
        <input
          name="display_name"
          required
          maxLength={40}
          defaultValue={initial?.display_name}
          placeholder="Derek"
          className={inputClass}
        />
      </label>
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
