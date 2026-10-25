"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "@/app/actions";
import { Magma, MagmaFilters } from "@/components/globe/Magma";
import { inputClass } from "@/components/Shell";

// Leaving: your core melts away while everything you made is erased.
export function DeleteAccount({ username }: { username: string }) {
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const ready = typed.trim().replace(/^@/, "").toLowerCase() === username;

  return (
    <div className="flex flex-col gap-4">
      <MagmaFilters />
      <div className="flex items-center gap-4">
        <div className={`h-14 w-14 flex-none ${pending ? "core-fade" : ""}`}>
          <Magma className="h-full w-full" />
        </div>
        <p className="text-sm leading-relaxed">
          Deleting your account erases your core: every song you&apos;ve shared, your photos, who you follow and who
          follows you, and your Spotify link. It can&apos;t be undone.
        </p>
      </div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="self-start text-sm font-semibold text-accent-deep">
          Delete my account
        </button>
      ) : (
        <form action={action} className="rise-in flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">
              Type <span className="text-accent-deep">{username}</span> to confirm
            </span>
            <input
              name="confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className={inputClass}
            />
          </label>
          {state?.error && <p className="text-sm text-accent-deep">{state.error}</p>}
          <div className="flex items-center gap-3">
            <button
              disabled={!ready || pending}
              className="inline-flex h-12 items-center justify-center rounded-full bg-accent-deep px-6 text-sm font-semibold text-white disabled:opacity-40"
            >
              {pending ? "Fading out…" : "Delete everything"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-muted">
              Keep my account
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
