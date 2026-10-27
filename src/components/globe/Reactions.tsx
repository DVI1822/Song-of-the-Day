"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { formatTime, initials } from "@/lib/day";
import type { Note, Post, Reactions } from "@/lib/types";
import type { GlobeApi } from "./api";
import { Magma } from "./Magma";
import { CloseIcon } from "./ui";

// Liking a song and the notes people leave on it. The like is a set of level
// bars that jump up and light up when tapped, with the count beside it;
// notes open in a sheet under the song. (The likes are "feels" in the data.)

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

// The like: three level bars that jump up when it's tapped.
const BARS: [number, number, number][] = [
  [3.5, 12, 7 / 12],
  [10, 18, 11 / 18],
  [16.5, 14.5, 5 / 14.5],
];
export const LevelsIcon = ({ on, size = 22 }: { on?: boolean; size?: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    {BARS.map(([x, h, low], i) => (
      <rect
        key={x}
        x={x}
        y={21 - h}
        width="4"
        height={h}
        rx="1.3"
        fill={on ? "currentColor" : "none"}
        style={{
          transform: `scaleY(${on ? 1 : low})`,
          transformBox: "fill-box",
          transformOrigin: "bottom",
          transition: `transform .35s cubic-bezier(.3,1.5,.5,1) ${i * 0.05}s`,
          vectorEffect: "non-scaling-stroke",
        }}
      />
    ))}
  </svg>
);
// Notes: a speech bubble with a little music note in it, filled once you've
// left one.
const NoteIcon = ({ on }: { on?: boolean }) => (
  <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path
      d="M12 3.5c4.9 0 8.5 3.3 8.5 7.6s-3.6 7.6-8.5 7.6c-1 0-2-.1-2.9-.4L4.5 20.5l1.3-3.8C4.3 15.3 3.5 13.3 3.5 11.1c0-4.3 3.6-7.6 8.5-7.6z"
      fill={on ? "currentColor" : "none"}
    />
    <path d="M11 13.5V8.2l3.2-.8" stroke={on ? "white" : "currentColor"} strokeWidth="1.6" />
    <circle cx="9.9" cy="13.6" r="1.4" fill={on ? "white" : "currentColor"} stroke="none" />
  </svg>
);

// The buttons beside a song's title: save it to your core (not on your own
// song), like it, and notes, each count beside its button.
export function ReactionButtons({
  r,
  mine,
  meId,
  onFeel,
  onNotes,
  onSave,
  saveRef,
}: {
  r: Reactions | null;
  mine: boolean;
  meId: string;
  onFeel(): void;
  onNotes(): void;
  onSave(): void;
  saveRef?: Ref<HTMLButtonElement>;
}) {
  const liked = Boolean(r?.feels.some((f) => f.user.id === meId));
  const saved = Boolean(r?.saved);
  const noted = Boolean(r?.notes.some((n) => n.user.id === meId));
  const [savePop, setSavePop] = useState(0);
  const likes = r?.feels.length ?? 0,
    notes = r?.notes.length ?? 0;
  const count = "min-w-[1ch] text-[12px] font-semibold tabular-nums leading-none";
  return (
    <div className="-mr-1 flex flex-none items-center gap-0.5 pt-0.5">
      {!mine && (
        <button
          ref={saveRef}
          type="button"
          onClick={() => {
            if (!saved) setSavePop((b) => b + 1);
            onSave();
          }}
          aria-label={saved ? "Saved to your core. Tap to take it out" : "Save to your core"}
          aria-pressed={saved}
          className="relative flex h-10 w-9 items-center justify-center"
        >
          <span
            key={savePop}
            className="relative block h-[21px] w-[21px] transition-[opacity,filter] duration-300"
            style={{
              opacity: saved ? 1 : 0.5,
              filter: saved ? undefined : "saturate(0.35)",
              animation: savePop ? "core-pop .45s cubic-bezier(.2,.75,.25,1)" : undefined,
            }}
          >
            <Magma className="h-full w-full drop-shadow-[0_1px_4px_rgba(60,90,110,0.45)]" />
          </span>
          <span
            aria-hidden
            className={`absolute bottom-[7px] right-0.5 flex h-[13px] w-[13px] items-center justify-center rounded-full text-white shadow-[0_1px_2px_rgba(13,42,63,0.3)] ${saved ? "bg-accent" : "bg-card-ink/70"}`}
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <path d={saved ? "M5 12.5l4.5 4.5L19 7.5" : "M12 5v14M5 12h14"} />
            </svg>
          </span>
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          if (mine) return onNotes();
          onFeel();
        }}
        aria-label={
          mine ? `${likes} ${likes === 1 ? "like" : "likes"} on your song` : liked ? "Liked. Tap to take it back" : "Like"
        }
        aria-pressed={mine ? undefined : liked}
        className={`flex h-10 items-center gap-1.5 rounded-full px-2 transition-colors ${liked ? "text-accent" : "text-card-ink"}`}
      >
        <LevelsIcon on={liked} />
        <span className={`${count} ${liked ? "" : "text-muted"}`}>{likes || ""}</span>
      </button>
      <button
        type="button"
        onClick={onNotes}
        aria-label={notes ? `${notes} ${notes === 1 ? "note" : "notes"}` : "Leave a note"}
        className={`flex h-10 items-center gap-1.5 rounded-full px-2 ${noted ? "text-accent" : "text-card-ink"}`}
      >
        <NoteIcon on={noted} />
        <span className={`${count} ${noted ? "" : "text-muted"}`}>{notes || ""}</span>
      </button>
    </div>
  );
}

// Who liked the song, its notes, and a place to leave one.
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
  const likedLine =
    names.length === 0
      ? mine
        ? "No likes yet"
        : `Be the first to like ${first}'s song`
      : names.length <= 3
        ? `${names.slice(0, -1).join(", ")}${names.length > 1 ? " and " : ""}${names[names.length - 1]} liked it`
        : `${names.slice(0, 2).join(", ")} and ${names.length - 2} others liked it`;

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
          {feels.length > 0 && (
            <span className="flex-none text-accent">
              <LevelsIcon on size={16} />
            </span>
          )}
          <div className="min-w-0 flex-1 text-[13px] text-muted">{likedLine}</div>
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
