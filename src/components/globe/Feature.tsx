"use client";

import { useState, type Ref } from "react";
import { formatTime } from "@/lib/day";
import type { Post, Profile } from "@/lib/types";
import { Magma } from "./Magma";
import type { GlobeApi } from "./api";
import { SongPlayer } from "./Preview";
import { ShareIcon, ShareSheet, type StoryOf } from "./ShareStory";
import type { StorySky } from "./storyVideo";
import { NotesSheet, ReactionButtons, useReactions } from "./Reactions";
import { MoreIcon, Safety } from "./Safety";
import { Cover, CloseIcon } from "./ui";

// A song, big, after the camera flies to it. Tap the cover to flip it over
// for the comment and photo. On someone else's song, ⋯ turns the cover into
// a place to report the song or block them. Beside the title: like it, and
// the notes people left.
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
  onCore,
  api,
  onBlocked,
  onHide,
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
  onCore(): void;
  api: GlobeApi;
  onBlocked(): void;
  onHide?: () => Promise<string | null>;
  story: StoryOf;
  rootRef: Ref<HTMLDivElement>;
  backdropRef: Ref<HTMLDivElement>;
  cardRef: Ref<HTMLDivElement>;
}) {
  const time = formatTime(post.created_at, timeZone);
  // big enough to see the whole cover: only a slight rounding, so no corner
  // of the artwork is cut off
  const radius = Math.round(0.03 * cover);
  const face = "absolute inset-0 overflow-hidden backface-hidden";
  const [flagging, setFlagging] = useState(false);
  const mine = who === "You";
  const [r, setR] = useReactions(api, post.id);
  const [notesOpen, setNotesOpen] = useState(false);
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

  return (
    <div ref={rootRef} className="fixed inset-0 z-[480]">
      <div ref={backdropRef} className="absolute inset-0" />
      <button
        type="button"
        onClick={onClose}
        aria-label="Back to the globe"
        className="absolute inset-0 cursor-default"
      />
      <div ref={cardRef} className="absolute flex flex-col gap-3.5" style={{ left, top, width: cover, opacity: 0 }}>
        <div
          aria-hidden
          className={`absolute -inset-x-3.5 -bottom-4 -top-2 rounded-[30px] border border-white/50 backdrop-blur-2xl ${dark ? "bg-white/85" : "bg-white/60"}`}
          style={{ boxShadow: "0 30px 80px -30px rgba(13,42,63,0.45)" }}
        />
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
          <button
            type="button"
            onClick={onFlip}
            aria-label={flipped ? "Flip back to the cover" : "Flip the cover"}
            className="relative block"
            style={{ width: cover, height: cover, perspective: 1400 }}
          >
            <div
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
                    <div className="display text-[25px] leading-snug text-card-ink">{post.caption}</div>
                    <div className="text-xs text-card-muted">
                      {who} · {time}
                      {post.place && ` · ${post.place}`}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </button>
        )}
        <div className="relative flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <div className="display text-[26px] leading-tight text-card-ink">{post.title}</div>
            <div className="text-[15px] text-muted">{[post.artist, post.album].filter(Boolean).join(" · ")}</div>
          </div>
          <ReactionButtons r={r} mine={mine} meId={me.id} onFeel={feel} onNotes={() => setNotesOpen(true)} />
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
                <Magma className="h-5 w-5 drop-shadow-[0_1px_4px_rgba(60,90,110,0.45)]" />
              </button>
            }
          />
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
      {sharing && (
        <ShareSheet post={post} name={me.display_name} username={me.username} of={story} initialSky={sharing} onClose={() => setSharing(null)} />
      )}
    </div>
  );
}
