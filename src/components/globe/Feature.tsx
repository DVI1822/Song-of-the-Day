"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Ref } from "react";
import { formatTime } from "@/lib/day";
import type { Post, Profile } from "@/lib/types";
import { SignalCore } from "./SignalCore";
import { halloween } from "./halloween";
import type { GlobeApi } from "./api";
import { SongPlayer } from "./Preview";
import { CoverCrown, CrownButton } from "./Ranks";
import { ShareIcon, ShareSheet, type StoryOf } from "./ShareStory";
import type { StorySky } from "./storyVideo";
import { LikesSheet, NotesSheet, ReactionButtons, useReactions } from "./Reactions";
import { MoreIcon, Safety } from "./Safety";
import { Cover, CloseIcon } from "./ui";
import { RedoButton, Singularity } from "./Redo";

// A song, big, after the camera flies to it. Tap the cover to flip it over
// for the comment and photo. On someone else's song, ⋯ turns the cover into
// a place to report the song or block them. Beside the title: like it, and
// the notes people left. On your own song today, the arrows on the cover's
// bottom left are your one redo (Redo.tsx).
// Swipe the card up and it's pushed back down into the Globe; swipe it left
// or right and it slides away for the next (or last) song someone posted,
// which starts playing as it comes in. Arrow keys do the same on a computer.
export function Feature({
  post,
  me,
  who,
  timeZone,
  cover,
  dark,
  left,
  top,
  flipped,
  onFlip,
  onClose,
  onPush,
  onSwipe,
  enter = 0,
  onCore,
  api,
  onBlocked,
  onHide,
  onRedo,
  onRedone,
  crown,
  story,
  rootRef,
  backdropRef,
  cardRef,
}: {
  post: Post;
  me: Profile;
  who: string;
  timeZone: string;
  cover: number;
  dark: boolean;
  left: number;
  top: number;
  flipped: boolean;
  onFlip(): void;
  onClose(): void;
  // swiped up: back into the Globe
  onPush?: () => void;
  // swiped sideways: 1 for the next song, -1 for the one before. False when
  // there's no other song to go to.
  onSwipe?: (dir: 1 | -1) => boolean;
  // which side this card came in from, after a swipe (1: from the right)
  enter?: 1 | -1 | 0;
  onCore(): void;
  api: GlobeApi;
  onBlocked(): void;
  onHide?: () => Promise<string | null>;
  // only on your own song, today, while you still have the redo
  onRedo?: () => Promise<string | undefined>;
  onRedone?: () => void;
  // the TopTrack crown, on a friend's song once you've posted (Ranks.tsx): a
  // fourth button in the row, and the coloured crown on top of the cover
  crown?: { on: boolean; set(on: boolean): Promise<string | null> };
  story: StoryOf;
  rootRef: Ref<HTMLDivElement>;
  backdropRef: Ref<HTMLDivElement>;
  cardRef: Ref<HTMLDivElement>;
}) {
  const time = formatTime(post.created_at, timeZone);
  const [crownBurst, setCrownBurst] = useState(0);
  const [crownError, setCrownError] = useState<string | null>(null);
  const crownTap = async () => {
    if (!crown) return;
    const on = !crown.on;
    setCrownError(null);
    if (on) setCrownBurst((b) => b + 1);
    const e = await crown.set(on);
    if (e) {
      setCrownError(e);
      setTimeout(() => setCrownError(null), 3200);
    }
  };
  const hw = halloween(); // only ever shown after a tap, so always in the browser
  // big enough to see the whole cover: only a slight rounding, so no corner
  // of the artwork is cut off
  const radius = Math.round(0.03 * cover);
  const face = "absolute inset-0 overflow-hidden backface-hidden";
  const [flagging, setFlagging] = useState(false);
  const mine = who === "You";
  const [r, setR] = useReactions(api, post.id);
  const [notesOpen, setNotesOpen] = useState(false);
  const [likesOpen, setLikesOpen] = useState(false);
  // the sky the Story starts on: the one outside when you tap share
  const [sharing, setSharing] = useState<StorySky | null>(null);

  // like it, or take it back, straight away; undone if it doesn't stick
  const feel = async () => {
    if (!r || mine) return;
    const on = !r.feels.some((f) => f.user.id === me.id);
    const before = r;
    setR({
      ...r,
      feels: on ? [{ user: me, created_at: new Date().toISOString() }, ...r.feels] : r.feels.filter((f) => f.user.id !== me.id),
    });
    const res = await api.feel(post.id, on);
    if (res.error) setR(before);
  };
  // save it to your core, or take it back out, the same way
  const save = async () => {
    if (!r || mine) return;
    const on = !r.saved;
    if (on) setToast((n) => n + 1);
    const before = r;
    setR({ ...r, saved: on });
    const res = await api.save(post.id, on);
    if (res.error) setR(before);
  };

  // the title shrinks until it fits on two lines, so the card never runs off
  // the bottom of the screen however long the song's name is
  const titleRef = useRef<HTMLDivElement>(null);
  const [titleSize, setTitleSize] = useState(26);
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    let size = 26;
    el.style.fontSize = `${size}px`;
    el.style.webkitLineClamp = "unset";
    while (size > 17 && el.scrollHeight > size * 1.25 * 2 + 2) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
    el.style.webkitLineClamp = "";
    setTitleSize(size);
  }, [post.title, cover]);

  // on a short screen the card slides up just enough to keep its bottom on
  // screen, never past the top
  const card = useRef<HTMLDivElement>(null); // everything under the cover
  const [lift, setLift] = useState(0);
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    // the cover, its header and the gaps above are fixed; this part grows
    const fit = () =>
      setLift(Math.max(0, Math.min(top - 12, top + 42 + cover + 14 + el.offsetHeight + 24 - window.innerHeight)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [top, cover]);

  // a quick "Added to core" when you save it (the count restarts the pill)
  const [toast, setToast] = useState(0);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(0), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  // the hint when a song opens: the cover sits like it's floating on water,
  // then gets tossed (see toss below) over onto its back, where it rests a
  // moment so you see the caption and photo, then tossed back to the front.
  // Tells you there's more behind it and that it's there to tap.
  const spinner = useRef<HTMLDivElement>(null);
  const hint = useRef<Animation | null>(null);
  useEffect(() => {
    const el = spinner.current;
    if (!el || !el.animate || enter) return; // swiping through songs: no toss each time
    const keys: Toss = [
      [0, 0, 0, 0, 0, ROCK], // floating
      [250, 1, -5, 2.5, -2.5, ROCK],
      [400, 0, 0, 0, 0, "ease-in"], // dips before the toss
      ...toss(550, 0), // lands on its back by about 1150, rocks, then rests
      [2150, 0, 0, 0, 180, "ease-in"],
      ...toss(2300, 180), // back over to the front, all done by about 4s
    ];
    const a = play(el, keys, 250);
    hint.current = a;
    return () => a.cancel();
  }, [enter]);
  // a tap tosses it over the same way (from wherever it is now); the ⋯ menu
  // ends whatever's playing
  const tapCover = () => {
    hint.current?.cancel();
    const el = spinner.current;
    if (el?.animate) {
      const from = flipped ? 180 : 0;
      hint.current = play(el, [[0, 0, 0, 0, from, "ease-in"], ...toss(150, from)], 0);
    }
    onFlip();
  };
  useEffect(() => {
    if (flagging) hint.current?.cancel();
  }, [flagging]);

  // the redo: the cover's sucked away while today's song is taken back
  const sinkRef = useRef<HTMLDivElement>(null);
  const [sinking, setSinking] = useState(0);
  const [redoError, setRedoError] = useState<string | null>(null);
  const taking = useRef<Promise<string | undefined> | null>(null);
  const redo = () => {
    if (!onRedo || sinking) return;
    hint.current?.cancel();
    setRedoError(null);
    taking.current = onRedo().catch(() => "Couldn't redo it. Try again.");
    setSinking((n) => n + 1);
  };
  const sunk = async () => {
    const err = await taking.current;
    taking.current = null;
    if (err) {
      // it didn't go through: the cover comes back
      setSinking(0);
      setRedoError(err);
    } else onRedone?.();
  };

  // ---- swiping ----
  const cardEl = useRef<HTMLDivElement | null>(null);
  const setCard = useCallback(
    (el: HTMLDivElement | null) => {
      cardEl.current = el;
      if (typeof cardRef === "function") cardRef(el);
    },
    [cardRef],
  );
  // the card's pivot: the middle of the cover, so it shrinks into its own spot
  const origin = `${cover / 2}px ${42 + cover / 2}px`;
  // after a swipe: slide in from that side
  useLayoutEffect(() => {
    const el = cardEl.current;
    if (!enter || !el?.animate) return;
    el.animate(
      [
        { transform: `translateX(${enter * Math.min(window.innerWidth, 520) * 0.7}px) rotate(${enter * 7}deg)`, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 420, easing: "cubic-bezier(.2,.8,.25,1)" },
    );
  }, [enter]);
  type Drag = { id: number; x0: number; y0: number; dx: number; dy: number; axis: "x" | "y" | null; vx: number; vy: number; lx: number; ly: number; lt: number };
  const drag = useRef<Drag | null>(null);
  const dragged = useRef(false); // eats the tap that ends a swipe
  const gone = useRef(false); // on its way out: no more swiping
  const still = flagging || sinking > 0 || notesOpen || likesOpen || !!sharing;
  const sway = (d: Drag) => {
    if (d.axis === "x") {
      const x = onSwipe ? d.dx : d.dx * 0.3; // nothing to swipe to: it only gives a little
      return `translateX(${x}px) rotate(${x * 0.035}deg)`;
    }
    // up, it lifts away and gets smaller; down, it barely moves
    return d.dy < 0 ? `translateY(${d.dy}px) scale(${Math.max(0.7, 1 + d.dy / 1400)})` : `translateY(${d.dy * 0.2}px)`;
  };
  const settle = (from: string) => {
    const el = cardEl.current;
    if (!el) return;
    el.style.transform = "";
    el.animate?.([{ transform: from }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.3,1.35,.5,1)" });
  };
  // off it goes: sideways to the next song, or up and back into the Globe
  const leave = (to: string, ms: number, easing: string) => {
    const el = cardEl.current;
    gone.current = true;
    hint.current?.cancel();
    if (!el?.animate) return;
    const from = el.style.transform || "none";
    el.style.transform = "";
    el.animate([{ transform: from, opacity: 1 }, { transform: to, opacity: 0 }], { duration: ms, easing, fill: "forwards" });
  };
  const swipe = (dir: 1 | -1) => {
    if (gone.current || !onSwipe || !onSwipe(dir)) return false;
    const w = Math.min(window.innerWidth, 520);
    leave(`translateX(${-dir * w * 1.05}px) rotate(${-dir * 12}deg)`, 240, "cubic-bezier(.4,0,.8,.6)");
    return true;
  };
  const push = () => {
    if (gone.current || !onPush) return;
    leave("translateY(10px) scale(0.18)", 380, "cubic-bezier(.5,0,.75,.4)");
    onPush();
  };
  const down = (e: React.PointerEvent) => {
    dragged.current = false;
    if (still || gone.current || e.button > 0 || drag.current) return;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, axis: null, vx: 0, vy: 0, lx: e.clientX, ly: e.clientY, lt: e.timeStamp };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.dx = e.clientX - d.x0;
    d.dy = e.clientY - d.y0;
    const dt = Math.max(1, e.timeStamp - d.lt);
    d.vx = 0.6 * d.vx + 0.4 * ((e.clientX - d.lx) / dt);
    d.vy = 0.6 * d.vy + 0.4 * ((e.clientY - d.ly) / dt);
    d.lx = e.clientX;
    d.ly = e.clientY;
    d.lt = e.timeStamp;
    if (!d.axis) {
      if (Math.hypot(d.dx, d.dy) < 10) return;
      d.axis = Math.abs(d.dx) > Math.abs(d.dy) ? "x" : "y";
      dragged.current = true;
      hint.current?.cancel();
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
    }
    if (cardEl.current) cardEl.current.style.transform = sway(d);
  };
  const up = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.axis) return;
    const from = sway(d);
    const w = Math.min(window.innerWidth, 520);
    if (e.type !== "pointercancel") {
      if (d.axis === "x" && (Math.abs(d.dx) > w * 0.22 || (Math.abs(d.vx) > 0.45 && Math.abs(d.dx) > 30))) {
        if (swipe(d.dx < 0 ? 1 : -1)) return;
      }
      if (d.axis === "y" && onPush && (d.dy < -90 || (d.vy < -0.45 && d.dy < -30))) return push();
    }
    settle(from);
  };
  const now = useRef({ swipe, push, still });
  useLayoutEffect(() => {
    now.current = { swipe, push, still };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = now.current;
      if (k.still || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") k.swipe(1);
      else if (e.key === "ArrowLeft") k.swipe(-1);
      else if (e.key === "ArrowUp") k.push();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[480]"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClickCapture={(e) => {
        if (!dragged.current) return;
        dragged.current = false;
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <div
        ref={backdropRef}
        className="absolute inset-0"
        style={{ opacity: 0 }}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Back to the globe"
        className="absolute inset-0 cursor-default touch-none"
      />
      <div
        ref={setCard}
        className={`absolute flex flex-col gap-3.5 ${still ? "" : "touch-none"}`}
        style={{ left, top: top - lift, width: cover, opacity: 0, transformOrigin: origin }}
      >
        <div
          aria-hidden
          className={`absolute -inset-x-3.5 -bottom-4 -top-2 rounded-[30px] border border-white/50 backdrop-blur-none ${dark ? "bg-white/95" : "bg-white/90"}`}
          style={{
            // on Halloween the card glows in the look's colour (halloween.ts)
            boxShadow: `0 30px 80px -30px rgba(13,42,63,0.45)${hw ? `, 0 0 0 1.5px rgba(${hw.accentRgb},0.55), 0 0 60px -8px rgba(${hw.accentRgb},0.7)` : ""}`,
          }}
        />
        {/* your TopTrack: a gold crown floats above the card, off it */}
        {crown?.on && !flagging && <CoverCrown burst={crownBurst} fall={cover + 330} top={-14} />}
        <div className="relative flex h-7 items-center justify-between">
          <div className="min-w-0 truncate text-xs text-muted">
            {time} · {who}
            {post.place && ` · ${post.place}`}
          </div>
          <div className="-mr-2.5 flex">
            {mine && (
              <button
                type="button"
                onClick={() => setSharing(story.sky())}
                aria-label="Share to your Instagram Story"
                className="flex h-11 w-11 items-center justify-center text-card-ink"
              >
                <ShareIcon size={19} />
              </button>
            )}
            {!mine && (
              <button
                type="button"
                onClick={() => setFlagging((f) => !f)}
                aria-label="More"
                aria-expanded={flagging}
                className="flex h-11 w-11 items-center justify-center text-card-ink"
              >
                <MoreIcon />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center text-card-ink"
            >
              <CloseIcon size={20} />
            </button>
          </div>
        </div>
        <div className="relative">
          {flagging ? (
          <div className="relative overflow-hidden" style={{ width: cover, height: cover, borderRadius: radius }}>
            <Cover
              src={post.artwork_url}
              seed={post.title}
              size={cover}
              className="absolute inset-0 scale-110 blur-md"
              style={{ borderRadius: radius }}
            />
            <div className="absolute inset-0 bg-white/[0.9]" />
            <div className="absolute inset-x-[22px] bottom-[30px] top-[20px]">
              <Safety
                api={api}
                who={who}
                userId={post.user_id}
                postId={post.id}
                onBlocked={onBlocked}
                onHide={onHide}
                onDone={() => setFlagging(false)}
              />
            </div>
          </div>
        ) : (
          <div ref={sinkRef} className={sinking ? "pointer-events-none" : ""}>
          <button
            type="button"
            onClick={tapCover}
            aria-label={flipped ? "Flip back to the cover" : "Flip the cover"}
            className="relative block"
            style={{ width: cover, height: cover, perspective: 1400 }}
          >
            <div
              ref={spinner}
              className="preserve-3d relative h-full w-full transition-transform duration-[800ms] ease-[cubic-bezier(.2,.75,.25,1)]"
              style={{ transform: `rotateY(${flipped ? 180 : 0}deg)` }}
            >
              <div
                className={face}
                style={{
                  borderRadius: radius,
                  boxShadow: "0 40px 90px -30px rgba(13,42,63,0.55), 0 0 60px -10px rgba(217,255,248,0.33)",
                }}
              >
                <Cover src={post.artwork_url} seed={post.title} size={cover} style={{ borderRadius: radius }} />
              </div>
              <div className={face} style={{ borderRadius: radius, transform: "rotateY(180deg)" }}>
                <Cover
                  src={post.artwork_url}
                  seed={post.title}
                  size={cover}
                  className="absolute inset-0"
                  style={{ borderRadius: radius }}
                />
                <div className="absolute inset-0 bg-white/[0.88]" />
                {post.photo_url ? (
                  <div className="absolute inset-[18px] flex flex-col gap-3.5 text-left">
                    <div className="relative flex-1 overflow-hidden rounded-[18px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={post.photo_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    </div>
                    {post.caption && (
                      <div className="display px-1.5 pb-1 text-lg leading-snug text-card-ink">{post.caption}</div>
                    )}
                  </div>
                ) : (
                  <div className="absolute inset-[30px] flex flex-col justify-between text-left">
                    <svg aria-hidden width="30" height="30" viewBox="0 0 24 24" fill="#D7262B">
                      <path d="M4 18v-5c0-4 2-7 6-8l1 2c-2 1-3 2.5-3 4h3v7zm9 0v-5c0-4 2-7 6-8l1 2c-2 1-3 2.5-3 4h3v7z" />
                    </svg>
                    <div
                      className="display min-h-0 overflow-hidden leading-snug text-card-ink"
                      style={{ fontSize: captionSize(post.caption, cover) }}
                    >
                      {post.caption}
                    </div>
                    <div className="text-xs text-card-muted">
                      {who} · {time}
                      {post.place && ` · ${post.place}`}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </button>
          </div>
          )}
          <Singularity size={cover} src={post.artwork_url} target={sinkRef} run={sinking} onDone={sunk} />
          {/* your one redo today, on the bottom left */}
          {!flagging && !sinking && onRedo && <RedoButton error={redoError} onRedo={redo} />}
        </div>
        {/* "Added to core", a moment over the bottom of the cover */}
        {toast > 0 && (
          <div className="pointer-events-none absolute inset-x-0 z-10 flex justify-center" style={{ top: 42 + cover - 54 }}>
            <div
              key={toast}
              role="status"
              className="whitespace-nowrap rounded-full border border-coral/70 bg-white/90 px-4 py-2 text-[14px] font-semibold text-card-ink shadow-[0_10px_26px_-12px_rgba(13,42,63,0.5)] backdrop-blur-none"
              style={{ animation: "toast-blip 1.6s cubic-bezier(.2,.75,.25,1) both" }}
            >
              Added to core
            </div>
          </div>
        )}
        <div ref={card} className="flex flex-col gap-3.5">
          <div className="relative flex flex-col gap-[3px]">
            <div
              ref={titleRef}
              className="display line-clamp-2 break-words leading-tight text-card-ink"
              style={{ fontSize: titleSize }}
            >
              {post.title}
            </div>
            <div className="relative flex items-center gap-2">
              <div className="min-w-0 flex-1 truncate text-[15px] text-muted">
                {[post.artist, post.album].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
          <div className="relative -my-1.5">
            <ReactionButtons
              r={r}
              mine={mine}
              meId={me.id}
              onFeel={feel}
              onLikes={() => setLikesOpen(true)}
              onNotes={() => setNotesOpen(true)}
              onSave={save}
              crown={crown && <CrownButton on={crown.on} onTap={crownTap} />}
            />
            {crownError && (
              <div role="status" className="absolute right-0 z-10 -mt-1 w-[220px] rounded-xl bg-white/95 px-2.5 py-1.5 text-right text-[12px] leading-snug text-accent-deep shadow">
                {crownError}
              </div>
            )}
          </div>
          <div className="relative">
            <SongPlayer
              post={post}
              big
              extra={
                <button
                  type="button"
                  onClick={onCore}
                  aria-label={who === "You" ? "View your core" : `View ${who}'s core`}
                  className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full border border-card-ink/20"
                >
                  <SignalCore className="h-5 w-5 drop-shadow-[0_1px_4px_rgba(60,90,110,0.45)]" />
                </button>
              }
            />
          </div>
        </div>
      </div>
      {notesOpen && (
        <NotesSheet
          api={api}
          post={post}
          r={r}
          setR={setR}
          meId={me.id}
          mine={mine}
          who={who}
          onClose={() => setNotesOpen(false)}
        />
      )}
      {likesOpen && <LikesSheet r={r} meId={me.id} title={post.title} onClose={() => setLikesOpen(false)} />}
      {sharing && (
        <ShareSheet post={post} name={me.display_name} username={me.username} of={story} initialSky={sharing} onClose={() => setSharing(null)} />
      )}
    </div>
  );
}

// The cover's toss, like something flicked up off the water. Each key is
// [ms, lift (px, up is -), toward you (px), tilt forward, turn, easing].
type Toss = [number, number, number, number, number, string?][];
const ROCK = "ease-in-out";
const FLY = 600,
  STEP = 40;
// one toss from the turn `from` to `from + 180`, starting at `t`: a dip, then
// the flight, worked out in small steps so it moves in one smooth arc (up and
// down like a thrown thing, turning at a steady pace the whole way with no
// stall at the top), then a plop and a rock on the water
function toss(t: number, from: number): Toss {
  const k: Toss = [[t, 7, -36, 4, from, "linear"]];
  for (let ms = STEP; ms <= FLY; ms += STEP) {
    const u = Math.min(1, ms / FLY),
      arc = 4 * u * (1 - u), // 0 at take-off and landing, 1 at the top
      spin = 0.65 * u + 0.35 * u * u * (3 - 2 * u); // steady, eased at the ends a touch
    k.push([t + ms, 7 + 2 * u - 72 * arc, -36 + 6 * u + 185 * arc, 4 + 2 * u - 11 * arc, from + 180 * spin, "linear"]);
  }
  k[k.length - 1][5] = ROCK;
  const end = t + FLY;
  return [
    ...k, // plop
    [end + 250, -2, 6, -5, from + 186, ROCK],
    [end + 500, 1, -3, 3, from + 176.5, ROCK],
    [end + 700, 0, 1, -1.5, from + 181.5, ROCK],
    [end + 900, 0, 0, 0, from + 180, ROCK],
  ];
}
function play(el: HTMLElement, keys: Toss, delay: number) {
  const total = keys[keys.length - 1][0];
  return el.animate(
    keys.map(([ms, y, z, x, turn, easing]) => ({
      offset: ms / total,
      transform: `translateY(${y}px) translateZ(${z}px) rotateX(${x}deg) rotateY(${turn}deg)`,
      ...(easing ? { easing } : {}),
    })),
    { duration: total, delay },
  );
}

// The caption on the back of the cover: smaller as it gets longer, and on a
// smaller cover, so all 100 characters fit inside the square.
const captionSize = (text: string, cover: number) =>
  Math.round((text.length > 70 ? 18 : text.length > 40 ? 21 : 25) * Math.min(1, cover / 320));
