"use client";

import { useActionState } from "react";
import { fileTakedown } from "@/app/actions";
import { buttonClass, inputClass } from "@/components/Shell";

export function TakedownForm() {
  const [state, action, pending] = useActionState(fileTakedown, undefined);

  if (state?.ok)
    return (
      <div className="rise-in rounded-[22px] bg-card-ink/[0.04] p-5">
        <div className="display text-lg">Notice received</div>
        <p className="mt-1 text-sm text-card-muted">We&apos;ll review it and reply by email.</p>
      </div>
    );

  const field = "flex flex-col gap-2";
  const label = "text-sm font-semibold";
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className={field}>
        <span className={label}>Your full name</span>
        <input name="name" required maxLength={200} autoComplete="name" className={inputClass} />
      </label>
      <label className={field}>
        <span className={label}>Email</span>
        <input name="email" type="email" required maxLength={200} autoComplete="email" className={inputClass} />
      </label>
      <label className={field}>
        <span className={label}>The copyrighted work</span>
        <textarea
          name="work"
          required
          maxLength={2000}
          rows={3}
          placeholder="What it is, and who owns it"
          className={`${inputClass} h-auto py-3`}
        />
      </label>
      <label className={field}>
        <span className={label}>Where it appears here</span>
        <textarea
          name="song_link"
          required
          maxLength={2000}
          rows={2}
          placeholder="The person's username and the day of the post, or a link to their page"
          className={`${inputClass} h-auto py-3`}
        />
      </label>
      <label className="flex items-start gap-3 text-sm leading-relaxed">
        <input name="good_faith" type="checkbox" required className="mt-1 h-4 w-4 flex-none accent-[#D7262B]" />
        <span>
          I believe in good faith that this use isn&apos;t authorized by the owner, its agent or the law. The
          information in this notice is accurate, and under penalty of perjury, I am the owner or authorized to act for
          the owner.
        </span>
      </label>
      <label className={field}>
        <span className={label}>Signature (type your full name)</span>
        <input name="signature" required maxLength={200} className={inputClass} />
      </label>
      {state?.error && <p className="text-sm text-accent-deep">{state.error}</p>}
      <button className={buttonClass} disabled={pending}>
        {pending ? "Sending…" : "Send notice"}
      </button>
    </form>
  );
}
