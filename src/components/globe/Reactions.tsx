"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { formatTime } from "@/lib/day";
import type { Note, Post, Reactions } from "@/lib/types";
import type { GlobeApi } from "./api";
import { SignalCore } from "./SignalCore";
import { CloseIcon, Face } from "./ui";

// Liking a song and the notes people leave on it. The like is a set of level
// bars that jump up and light up when tapped, with the count beside it;
// notes open in a sheet under the song. (The likes are "feels" in the data.)

// Asked for the moment a song is tapped, while the camera's still flying to
// it, so the card opens with its likes and notes already filled in rather
// than its buttons popping in a beat later.
const early = new Map<string, { at: number; p: Promise<Reactions | null>; v?: Reactions | null }>();
export function prefetchReactions(api: GlobeApi, postId: string) {
  const e: { at: number; p: Promise<Reactions | null>; v?: Reactions | null } = { at: Date.now(), p: api.reactions(postId) };
  e.p.then((v) => void (e.v = v)).catch(() => early.delete(postId));
  early.set(postId, e);
}
const fresh = (postId: string) => {
  const e = early.get(postId);
  return e && Date.now() - e.at < 20_000 ? e : undefined;
};

export function useReactions(api: GlobeApi, postId: string) {
  const [r, setR] = useState<Reactions | null>(() => {
    const v = fresh(postId)?.v;
    return v === undefined ? null : (v ?? { feels: [], notes: [] });
  });
  useEffect(() => {
    let on = true;
    const e = fresh(postId);
    early.delete(postId);
    (e?.p ?? api.reactions(postId)).then((x) => on && setR(x ?? { feels: [], notes: [] }));
    return () => {
      on = false;
    };
  }, [api, postId]);
  return [r, setR] as const;
}

// The buttons' colours: the app's coral, a dark blue and a light green.
const CORAL_HEX = "#ff5e57",
  BLUE_HEX = "#1f4f8f",
  GREEN_HEX = "#6fdc9f";

// The like: three level bars that jump up when it's tapped. Under an opened
// song (`dance`), once liked they keep bouncing like an equaliser to music,
// each bar its own colour: coral, dark blue, light green.
const BARS: [number, number, number][] = [
  [3.5, 12, 8 / 12],
  [10, 18, 13 / 18],
  [16.5, 14.5, 7 / 14.5],
];
const EQ: [string, string][] = [
  [CORAL_HEX, "eq-a .82s"],
  [BLUE_HEX, "eq-b 1.04s"],
  [GREEN_HEX, "eq-c .9s"],
];
export const LevelsIcon = ({ on, size = 22, stroke = 1.8, dance }: { on?: boolean; size?: number; stroke?: number; dance?: boolean }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" overflow="visible">
    {BARS.map(([x, h, low], i) => {
      const lit = on && dance;
      return (
        <rect
          key={x}
          x={x}
          y={21 - h}
          width="4"
          height={h}
          rx="1.3"
          fill={lit ? EQ[i][0] : on ? "currentColor" : "none"}
          stroke={lit ? EQ[i][0] : "currentColor"}
          style={{
            transform: `scaleY(${on ? 1 : low})`,
            transformBox: "fill-box",
            transformOrigin: "bottom",
            transition: `transform .35s cubic-bezier(.3,1.5,.5,1) ${i * 0.05}s`,
            animation: lit ? `${EQ[i][1]} ease-in-out ${0.3 + i * 0.07}s infinite` : undefined,
            filter: lit ? `drop-shadow(0 0 3px ${EQ[i][0]}aa)` : undefined,
            vectorEffect: "non-scaling-stroke",
          }}
        />
      );
    })}
  </svg>
);
// The three buttons share one size and one thin coral line, so they read as a set.
const ICON = 46;
const LINE_PX = 1.4; // on screen
const LINE = (LINE_PX * 24) / ICON; // in the 24-unit drawing

// Notes: a speech bubble with a little music note in it. Tapping it lights it
// up in light green and jingles the note (`ring` restarts that); once you've
// left a note it stays softly lit.
export const NoteIcon = ({ on, ring }: { on?: boolean; ring: number }) => (
  <svg
    key={ring}
    aria-hidden
    width={ICON}
    height={ICON}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={LINE}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ animation: ring ? "note-glow .9s ease-out" : undefined, overflow: "visible" }}
  >
    <path
      d="M12 3.5c4.9 0 8.5 3.3 8.5 7.6s-3.6 7.6-8.5 7.6c-1 0-2-.1-2.9-.4L4.5 20.5l1.3-3.8C4.3 15.3 3.5 13.3 3.5 11.1c0-4.3 3.6-7.6 8.5-7.6z"
      fill={ring || on ? `${GREEN_HEX}66` : "none"}
      style={{ transition: "fill .3s" }}
    />
    <g
      style={{
        transformBox: "fill-box",
        transformOrigin: "50% 100%",
        animation: ring ? "note-jingle .75s ease-in-out" : undefined,
      }}
    >
      <path d="M11 13.5V8.2l3.2-.8" />
      <circle cx="9.9" cy="13.6" r="1.4" fill="currentColor" stroke="none" />
    </g>
  </svg>
);

// Your core: a circle holding three sound waves, with a plus tucked at its
// bottom right. Once the song is in your core it lights up as a mini version of
// the real thing: the globe's own Signal core, same rings, colours and spin,
// with a band of coral running up and down through the rings, and the plus
// turned to a tick.
export const CoreIcon = ({ on }: { on?: boolean }) => (
  <span className="relative block" style={{ width: ICON, height: ICON }}>
    {on ? (
      <SignalCore rings={13} moving sweep="255,94,87" className="absolute inset-0 h-full w-full" />
    ) : (
      <svg aria-hidden width={ICON} height={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={LINE} strokeLinecap="round" strokeLinejoin="round" className="absolute inset-0">
        <circle cx="12" cy="12" r="8.6" />
        <path d="M5.2 8.6c1.7-1.3 3.4-1.3 5.1 0s3.4 1.3 5.1 0 2.4-1.1 3.4-.5" />
        <path d="M3.6 12.2c1.9-1.4 3.8-1.4 5.7 0s3.8 1.4 5.7 0 3.8-1.4 5.4 0" />
        <path d="M5.2 15.8c1.7-1.3 3.4-1.3 5.1 0s3.4 1.3 5.1 0" />
      </svg>
    )}
    <svg aria-hidden width={ICON} height={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={LINE} strokeLinecap="round" strokeLinejoin="round" className="absolute inset-0">
      <circle cx="19.4" cy="19.4" r="3.6" fill={on ? GREEN_HEX : "white"} stroke={on ? "#0b1f3d" : "currentColor"} />
      <path d={on ? "M17.8 19.5l1.1 1.1 2.1-2.3" : "M19.4 17.8v3.2M17.8 19.4h3.2"} stroke={on ? "#0b1f3d" : "currentColor"} />
    </svg>
  </span>
);

// The buttons beside a song's title: save it to your core (not on your own
// song), like it, and notes, each count beside its button.
export function ReactionButtons({
  r,
  mine,
  meId,
  onFeel,
  onLikes,
  onNotes,
  onSave,
  saveRef,
  crown,
}: {
  r: Reactions | null;
  mine: boolean;
  meId: string;
  onFeel(): void;
  onLikes(): void; // who liked it
  onNotes(): void;
  onSave(): void;
  saveRef?: Ref<HTMLButtonElement>;
  crown?: React.ReactNode; // a fourth button: crown it your TopTrack (Ranks.tsx)
}) {
  const liked = Boolean(r?.feels.some((f) => f.user.id === meId));
  const saved = Boolean(r?.saved);
  const noted = Boolean(r?.notes.some((n) => n.user.id === meId));
  const [savePop, setSavePop] = useState(0);
  const [ring, setRing] = useState(0);
  const likes = r?.feels.length ?? 0,
    notes = r?.notes.length ?? 0;
  const count = "min-w-[1ch] text-[15px] font-semibold tabular-nums leading-none text-card-ink";
  // a row of equal columns, each button dead centre in its own; a count hangs
  // off the icon's right edge so it never pushes the icons out of line
  const btn = "relative flex h-14 w-14 items-center justify-center rounded-full text-card-ink";
  const badge = `pointer-events-none absolute left-[52px] top-1/2 -translate-y-1/2 ${count}`;
  return (
    <div data-motion className={`grid ${mine ? "grid-cols-2" : crown ? "grid-cols-4" : "grid-cols-3"} justify-items-center`}>
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
          className={btn}
        >
          <span
            key={savePop}
            className="flex"
            style={{ animation: savePop ? "core-light .6s cubic-bezier(.2,.75,.25,1)" : undefined }}
          >
            <CoreIcon on={saved} />
          </span>
        </button>
      )}
      {/* the bars like it (on your own song they show who did); the count beside
          them always opens the list of who liked it */}
      <div className="relative">
        <button
          type="button"
          onClick={() => (mine ? onLikes() : onFeel())}
          aria-label={mine ? `${likes} ${likes === 1 ? "like" : "likes"} on your song` : liked ? "Liked. Tap to take it back" : "Like"}
          aria-pressed={mine ? undefined : liked}
          className={btn}
        >
          <LevelsIcon on={liked} size={ICON} stroke={LINE_PX} dance />
        </button>
        {likes > 0 && (
          <button
            type="button"
            onClick={onLikes}
            aria-label={`See who liked it (${likes})`}
            className={`${count} absolute left-[48px] top-1/2 flex h-10 -translate-y-1/2 items-center px-1`}
          >
            {likes}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          setRing((n) => n + 1);
          // a beat to see it jingle before the notes slide up
          setTimeout(onNotes, 280);
        }}
        aria-label={notes ? `${notes} ${notes === 1 ? "note" : "notes"}` : "Leave a note"}
        className={btn}
      >
        <NoteIcon on={noted} ring={ring} />
        {notes > 0 && <span className={badge}>{notes}</span>}
      </button>
      {crown}
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
              <Face key={f.user.id} p={f.user} size={28} className="border-2 border-white" />
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

// Everyone who liked a song, newest first.
export function LikesSheet({ r, meId, title, onClose }: { r: Reactions | null; meId: string; title: string; onClose(): void }) {
  const feels = [...(r?.feels ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="fixed inset-0 z-[490] flex flex-col justify-end">
      <button type="button" aria-label="Close likes" onClick={onClose} className="absolute inset-0 cursor-default bg-[#0D2A3F]/20" />
      <div
        role="dialog"
        aria-label="Likes"
        className="rise-in relative mx-auto flex max-h-[72vh] w-full max-w-[520px] flex-col rounded-t-[28px] border border-white/60 bg-white/[0.92] text-card-ink backdrop-blur-2xl"
        style={{ boxShadow: "0 -20px 60px -30px rgba(13,42,63,0.45)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center gap-2 px-5 pb-2 pt-4">
          <span className="flex-none text-accent">
            <LevelsIcon on size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="display text-xl">
              {feels.length} {feels.length === 1 ? "like" : "likes"}
            </div>
            <div className="truncate text-xs text-muted">on {title}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center">
            <CloseIcon />
          </button>
        </div>
        <div className="flex flex-col overflow-y-auto border-t border-card-ink/[0.07] px-5 py-2">
          {r === null && <div className="py-3 text-sm text-muted">Loading…</div>}
          {feels.map((f) => (
            <div key={f.user.id} className="flex items-center gap-3 py-2">
              <Face p={f.user} size={36} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{f.user.id === meId ? "You" : f.user.display_name}</span>
                <span className="truncate text-xs text-muted">@{f.user.username}</span>
              </div>
              <span className="flex-none text-[11px] text-muted">{formatTime(f.created_at, tz)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
