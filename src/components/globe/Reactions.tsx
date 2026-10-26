"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime, initials } from "@/lib/day";
import type { Note, Post, Reactions } from "@/lib/types";
import type { GlobeApi } from "./api";
import { Magma } from "./Magma";
import { CloseIcon } from "./ui";

// Feeling a song (the like) and the notes people leave on it. The feel is
// a drop that fills with the core's magma; notes open in a sheet under the
// song.

export function useReactions(api: GlobeApi, postId: string) {
  const [r, setR] = useState<Reactions | null>(null);
  useEffect(() => {
    let on = true;
    api.reactions(postId).then((x) => on && setR(x ?? { feels: [], notes: [] }));
    return () => {
      on = false;
    };
  }, [api, postId]);
  return [r, setR] as const;
}

const DropIcon = () => (
  <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <path d="M12 3.2c3.6 4.3 6 7.7 6 10.6a6 6 0 0 1-12 0c0-2.9 2.4-6.3 6-10.6z" />
  </svg>
);
const NoteIcon = () => (
  <svg aria-hidden width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-7l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />
  </svg>
);

// The two buttons beside a song's title.
export function ReactionButtons({
  r,
  mine,
  meId,
  onFeel,
  onNotes,
}: {
  r: Reactions | null;
  mine: boolean;
  meId: string;
  onFeel(): void;
  onNotes(): void;
}) {
  const felt = Boolean(r?.feels.some((f) => f.user.id === meId));
  const [burst, setBurst] = useState(0);
  const feels = r?.feels.length ?? 0,
    notes = r?.notes.length ?? 0;
  const count = "min-w-[1ch] text-[11px] font-semibold tabular-nums leading-none text-muted";
  return (
    <div className="-mr-1.5 flex flex-none items-start">
      <button
        type="button"
        onClick={() => {
          if (mine) return onNotes();
          if (!felt) setBurst((b) => b + 1);
          onFeel();
        }}
        aria-label={mine ? `${feels} felt your song` : felt ? "Felt it. Tap to take it back" : "Feel it"}
        aria-pressed={mine ? undefined : felt}
        className="flex w-11 flex-col items-center gap-1 pt-0.5 text-card-ink"
      >
        <span className="relative flex h-7 w-7 items-center justify-center">
          {felt || (mine && feels > 0) ? (
            <span key={burst} className="block h-[22px] w-[22px]" style={{ animation: burst ? "feel-pop .5s cubic-bezier(.2,.75,.25,1)" : undefined }}>
              <Magma className="h-full w-full drop-shadow-[0_1px_5px_rgba(60,90,110,0.5)]" />
            </span>
          ) : (
            <DropIcon />
          )}
          {burst > 0 && (
            <span
              key={`r${burst}`}
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-accent/60"
              style={{ animation: "feel-ring .7s ease-out forwards" }}
            />
          )}
        </span>
        <span className={count}>{feels || ""}</span>
      </button>
      <button
        type="button"
        onClick={onNotes}
        aria-label={notes ? `${notes} ${notes === 1 ? "note" : "notes"}` : "Leave a note"}
        className="flex w-11 flex-col items-center gap-1 pt-0.5 text-card-ink"
      >
        <span className="flex h-7 w-7 items-center justify-center">
          <NoteIcon />
        </span>
        <span className={count}>{notes || ""}</span>
      </button>
    </div>
  );
}

// Who felt the song, its notes, and a place to leave one.
export function NotesSheet({
  api,
  post,
  r,
  setR,
  meId,
  mine,
  who,
  onClose,
}: {
  api: GlobeApi;
  post: Post;
  r: Reactions | null;
  setR(r: Reactions): void;
  meId: string;
  mine: boolean;
  who: string;
  onClose(): void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const feels = r?.feels ?? [];
  const notes = r?.notes ?? [];
  const first = who.split(" ")[0];

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [notes.length]);

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await api.addNote(post.id, text);
    setBusy(false);
    if (!res.note) return setError(res.error ?? "Couldn't post that note. Try again.");
    setText("");
    setR({ feels, notes: [...notes, res.note] });
  };
  const remove = async (n: Note) => {
    const res = await api.deleteNote(n.id);
    if (res.error) return setError(res.error);
    setR({ feels, notes: notes.filter((x) => x.id !== n.id) });
  };
  const report = async (n: Note) => {
    const res = await api.report({ reportedId: n.user.id, postId: post.id, reason: "offensive", note: `Note: ${n.body}` });
    if (res.error) setError(res.error);
    else setReported(n.id);
  };

  const names = feels.map((f) => (f.user.id === meId ? "You" : f.user.display_name.split(" ")[0]));
  const feltLine =
    names.length === 0
      ? mine
        ? "No one's felt it yet"
        : `Be the first to feel ${first}'s song`
      : names.length <= 3
        ? `${names.slice(0, -1).join(", ")}${names.length > 1 ? " and " : ""}${names[names.length - 1]} felt it`
        : `${names.slice(0, 2).join(", ")} and ${names.length - 2} others felt it`;

  return (
    <div className="fixed inset-0 z-[490] flex flex-col justify-end">
      <button type="button" aria-label="Close notes" onClick={onClose} className="absolute inset-0 cursor-default bg-[#0D2A3F]/20" />
      <div
        role="dialog"
        aria-label="Notes"
        className="rise-in relative mx-auto flex max-h-[72vh] w-full max-w-[520px] flex-col rounded-t-[28px] border border-white/60 bg-white/[0.92] text-card-ink backdrop-blur-2xl"
        style={{ boxShadow: "0 -20px 60px -30px rgba(13,42,63,0.45)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center gap-2 px-5 pb-2 pt-4">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="display text-xl">Notes</div>
            <div className="truncate text-xs text-muted">on {post.title}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center">
            <CloseIcon />
          </button>
        </div>

        <div className="flex items-center gap-2.5 px-5 pb-3">
          <div className="flex -space-x-2">
            {feels.slice(0, 5).map((f) => (
              <span
                key={f.user.id}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[9px] font-semibold"
                style={{ background: "linear-gradient(135deg, #FFE1D6, #F6A9A0)", color: "#8A2A22" }}
              >
                {initials(f.user.display_name)}
              </span>
            ))}
          </div>
          {feels.length > 0 && <Magma className="h-4 w-4 flex-none" />}
          <div className="min-w-0 flex-1 text-[13px] text-muted">{feltLine}</div>
        </div>

        <div ref={list} className="flex min-h-[90px] flex-1 flex-col gap-3 overflow-y-auto border-t border-card-ink/[0.07] px-5 py-3">
          {r === null && <div className="text-sm text-muted">Loading…</div>}
          {r && !notes.length && (
            <div className="py-4 text-sm text-muted">{mine ? "No notes yet." : `Tell ${first} what this one does for you.`}</div>
          )}
          {notes.map((n) => {
            const own = n.user.id === meId;
            return (
              <div key={n.id} className={`flex flex-col gap-1 ${own ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-[18px] px-3.5 py-2 text-sm leading-snug ${
                    own ? "rounded-br-[6px] bg-accent text-white" : "rounded-bl-[6px] bg-card-ink/[0.06]"
                  }`}
                >
                  {n.body}
                </div>
                <div className="flex items-center gap-2 px-1 text-[10px] text-muted">
                  <span>
                    {own ? "You" : n.user.display_name} · {formatTime(n.created_at, Intl.DateTimeFormat().resolvedOptions().timeZone)}
                  </span>
                  {(own || mine) && (
                    <button type="button" onClick={() => remove(n)} className="font-semibold underline-offset-2 hover:underline">
                      Delete
                    </button>
                  )}
                  {!own &&
                    (reported === n.id ? (
                      <span>Reported</span>
                    ) : (
                      <button type="button" onClick={() => report(n)} className="font-semibold underline-offset-2 hover:underline">
                        Report
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="px-5 pb-1 text-xs text-accent-deep">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2 border-t border-card-ink/[0.07] px-4 py-3"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 200))}
            placeholder={mine ? "Reply to your notes" : `Leave ${first} a note`}
            aria-label="Write a note"
            className="h-11 min-w-0 flex-1 rounded-full bg-card-ink/[0.05] px-4 text-base outline-none placeholder:text-muted/80"
          />
          <button
            type="submit"
            disabled={!text.trim() || busy}
            aria-label="Post note"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-accent text-white disabled:opacity-40"
          >
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
