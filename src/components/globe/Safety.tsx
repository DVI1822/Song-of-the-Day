"use client";

import { useState } from "react";
import type { ReportReason } from "@/app/actions";
import type { GlobeApi } from "./api";

// Report a song or a person, or block them. On a song it takes the cover's
// place (the card's other "back"); on a core it opens under the archive.

const REASONS: [ReportReason, string][] = [
  ["offensive", "Offensive"],
  ["harassment", "Harassment"],
  ["spam", "Spam"],
  ["copyright", "Copyright"],
  ["other", "Something else"],
];

export function Safety({
  api,
  who,
  userId,
  postId,
  onBlocked,
  onHide,
  onDone,
}: {
  api: GlobeApi;
  who: string;
  userId: string;
  postId?: string | null;
  onBlocked(): void;
  onHide?: () => Promise<string | null>; // hide their songs from your globe
  onDone(): void;
}) {
  const [step, setStep] = useState<"menu" | "report" | "block" | "sent">("menu");
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = who.split(" ")[0];

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    const r = await api.report({ reportedId: userId, postId, reason, note });
    setBusy(false);
    if (r.error) setError(r.error);
    else setStep("sent");
  };
  const hide = async () => {
    if (!onHide) return;
    setBusy(true);
    setError(null);
    const e = await onHide();
    setBusy(false);
    if (e) setError(e);
  };
  const block = async () => {
    setBusy(true);
    setError(null);
    const r = await api.block(userId);
    setBusy(false);
    if (r.error) setError(r.error);
    else onBlocked();
  };

  const option = "flex w-full items-center gap-3 rounded-[18px] bg-card-ink/[0.05] px-4 py-3.5 text-left";
  const main = "h-11 w-full rounded-full text-sm font-semibold disabled:opacity-50";

  return (
    <div className="rise-in flex h-full flex-col gap-3 text-card-ink">
      {step === "menu" && (
        <>
          <div className="display text-xl">{onHide ? "Not your vibe?" : "Something wrong?"}</div>
          {onHide && (
            <button type="button" onClick={hide} disabled={busy} className={`${option} disabled:opacity-60`}>
              <HideIcon />
              <span className="flex flex-col">
                <span className="text-sm font-semibold">Hide {first}&apos;s songs</span>
                <span className="text-xs text-muted">Still friends, just off your globe. {first} won&apos;t know.</span>
              </span>
            </button>
          )}
          <button type="button" onClick={() => setStep("report")} className={option}>
            <FlagIcon />
            <span className="flex flex-col">
              <span className="text-sm font-semibold">{postId ? "Report this song" : `Report ${first}`}</span>
              <span className="text-xs text-muted">We&apos;ll look at it. {first} won&apos;t know it was you.</span>
            </span>
          </button>
          <button type="button" onClick={() => setStep("block")} className={option}>
            <BlockIcon />
            <span className="flex flex-col">
              <span className="text-sm font-semibold">Block {first}</span>
              <span className="text-xs text-muted">You&apos;ll vanish from each other&apos;s globes.</span>
            </span>
          </button>
          {error && <p className="text-xs text-accent-deep">{error}</p>}
          <button type="button" onClick={onDone} className="mt-auto text-xs font-semibold text-muted">
            Never mind
          </button>
        </>
      )}

      {step === "report" && (
        <>
          <div className="display text-xl">What&apos;s the problem?</div>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map(([r, label]) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                aria-pressed={reason === r}
                className={`h-8 rounded-full px-3 text-[13px] font-semibold transition-colors ${
                  reason === r ? "bg-accent text-white" : "bg-card-ink/[0.06]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder="Add a note (optional)"
            className="h-10 w-full flex-none rounded-full bg-card-ink/[0.05] px-4 text-base outline-none placeholder:text-muted/80"
          />
          {error && <p className="text-xs text-accent-deep">{error}</p>}
          <div className="mt-auto flex flex-col gap-2">
            <button type="button" onClick={send} disabled={!reason || busy} className={`${main} bg-accent text-white`}>
              {busy ? "Sending…" : "Send report"}
            </button>
            <button type="button" onClick={() => setStep("menu")} className="text-xs font-semibold text-muted">
              Back
            </button>
          </div>
        </>
      )}

      {step === "block" && (
        <>
          <div className="display text-xl">Block {first}?</div>
          <p className="text-sm leading-relaxed text-card-muted">
            {first}&apos;s songs leave your globe and yours leave theirs. Neither of you can find or add the other. You can
            unblock in Settings.
          </p>
          {error && <p className="text-xs text-accent-deep">{error}</p>}
          <div className="mt-auto flex flex-col gap-2">
            <button type="button" onClick={block} disabled={busy} className={`${main} bg-card-ink text-white`}>
              {busy ? "Blocking…" : `Block ${first}`}
            </button>
            <button type="button" onClick={() => setStep("menu")} className="text-xs font-semibold text-muted">
              Back
            </button>
          </div>
        </>
      )}

      {step === "sent" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white">
            <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <div className="display text-xl">Thanks for telling us</div>
          <p className="text-xs text-muted">We read every report.</p>
          <button type="button" onClick={() => setStep("block")} className="mt-2 text-xs font-semibold underline underline-offset-4">
            Block {first} too
          </button>
          <button type="button" onClick={onDone} className="text-xs font-semibold text-muted">
            Done
          </button>
        </div>
      )}
    </div>
  );
}

export const MoreIcon = () => (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
);
const FlagIcon = () => (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D7262B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </svg>
);
const HideIcon = () => (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c5 0 8.5 4.5 9.5 7a13 13 0 0 1-2.7 3.9M6.1 6.6A13 13 0 0 0 2.5 12c1 2.5 4.5 7 9.5 7a9.6 9.6 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);
const BlockIcon = () => (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M6 6l12 12" />
  </svg>
);
