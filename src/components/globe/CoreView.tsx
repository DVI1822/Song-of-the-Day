"use client";

import Link from "next/link";
import { useRef, useState, type Ref } from "react";
import { formatDay, formatTime, monthKey, monthName, streak, todayIn, usualHour } from "@/lib/day";
import type { Post, Profile } from "@/lib/types";
import type { GlobeApi } from "./api";
import { ChatIcon } from "./Chat";
import { SongPlayer } from "./Preview";
import { Safety } from "./Safety";
import { Cover, CloseIcon, glass, glassThin } from "./ui";

const FULL_TOP = "max(10px, env(safe-area-inset-top))";

// Someone's profile, shown once the camera has flown into their core.
export function CoreView({
  profile,
  posts,
  mine,
  dark,
  sheetTop,
  onClose,
  onOpenToday,
  onAdd,
  onMessage,
  api,
  onBlocked,
  rootRef,
  sheetRef,
}: {
  profile: Profile | null;
  posts: Post[] | null; // null while loading
  mine: boolean;
  dark: boolean;
  sheetTop: number;
  onClose(): void;
  onOpenToday?: () => void; // their tile on the globe; without one, today opens here
  onAdd?: () => Promise<string | null>; // for someone not on your globe yet
  onMessage?: () => void; // for someone you can message
  api: GlobeApi;
  onBlocked(): void;
  rootRef: Ref<HTMLDivElement>;
  sheetRef: Ref<HTMLDivElement>;
}) {
  const [month, setMonth] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [flagging, setFlagging] = useState(false);
  // the sheet slides up to fill the screen: drag its handle, tap it, or scroll
  const [full, setFull] = useState(false);
  const drag = useRef<number | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const low = `translateY(calc(${sheetTop}px - ${FULL_TOP}))`; // where it rests until pulled up
  const tz = profile?.timezone ?? "UTC";
  const today = todayIn(tz);
  const list = posts ?? [];
  const todayPost = list.find((p) => p.day === today) ?? null;
  const past = list.filter((p) => p.day !== today);
  const months = [...new Set(list.map((p) => monthKey(p.day)))];
  const thisYear = today.slice(0, 4);
  const archive = month ? list.filter((p) => monthKey(p.day) === month) : past;
  const first = profile?.display_name.split(" ")[0];
  const ink = dark ? "#EEF3F8" : "#0D2A3F";
  const muted = dark ? "#93A6B8" : "#6A818C";

  const stats = [
    [posts ? String(streak(list.map((p) => p.day), today)) : "–", "day streak"],
    [posts ? String(list.length) : "–", "songs shared"],
    [(posts && usualHour(list.map((p) => p.created_at), tz)) || "–", "usual post time"],
  ];


  return (
    <div ref={rootRef} className="pointer-events-none fixed inset-0 z-[500]" style={{ opacity: 0 }}>
      <div className="pointer-events-auto absolute left-6 right-3 top-[max(30px,env(safe-area-inset-top))] flex items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors" style={{ color: muted }}>
            {mine ? "Your core" : `${first}'s core`}
          </div>
          <div className="display truncate text-[30px] leading-tight transition-colors" style={{ color: ink }}>
            {profile?.display_name}
          </div>
          <div className="text-[13px] transition-colors" style={{ color: muted }}>
            @{profile?.username}
          </div>
        </div>
        {onAdd && <AddPill name={first ?? ""} onAdd={onAdd} />}
        {onMessage && <MessagePill name={first ?? ""} onMessage={onMessage} />}
        <button
          type="button"
          onClick={onClose}
          aria-label="Leave the core"
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={glass(dark)}
        >
          <CloseIcon />
        </button>
      </div>

      {/* the sheet keeps one size and only slides (smooth on phones); the
          globe's frame loop moves this wrapper in when the core opens */}
      <div ref={sheetRef} className="absolute inset-0">
        <div
          ref={sheet}
          onScroll={(e) => !full && e.currentTarget.scrollTop > 40 && setFull(true)}
          className="pointer-events-auto absolute inset-x-0 bottom-0 mx-auto flex max-w-[560px] flex-col gap-5 overflow-y-auto rounded-t-[28px] px-4 pb-[22px] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ top: FULL_TOP, transform: full ? "none" : low, ...glassThin(dark) }}
        >
          <div
            className="sticky top-0 z-10 -mx-4 flex flex-none touch-none flex-col items-center px-4 pb-1 pt-2 backdrop-blur-xl"
            onPointerDown={(e) => {
              drag.current = e.clientY;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const el = sheet.current;
              if (drag.current === null || !el) return;
              // follow the finger, never above the top
              const dy = e.clientY - drag.current;
              const base = full ? "0px" : `(${sheetTop}px - ${FULL_TOP})`;
              el.style.transition = "none";
              el.style.transform = `translateY(max(0px, calc(${base} + ${dy}px)))`;
            }}
            onPointerUp={(e) => {
              const dy = drag.current === null ? 0 : e.clientY - drag.current;
              drag.current = null;
              const el = sheet.current;
              if (el) el.style.transition = "";
              if (dy < -24) setFull(true);
              else if (dy > 24) setFull(false);
              else if (el) el.style.transform = full ? "none" : low;
            }}
          >
            <button
              type="button"
              onClick={() => setFull((f) => !f)}
              aria-label={full ? "Shrink the sheet" : "Fill the screen"}
              aria-expanded={full}
              className="flex h-6 w-24 items-center justify-center"
            >
              <span className="h-[5px] w-10 rounded-full bg-card-ink/20" />
            </button>
            <div
              aria-hidden={!full}
              className={`flex w-full items-center gap-2 pb-1 transition-opacity duration-300 ${
                full ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="display truncate text-[22px] leading-tight">{profile?.display_name}</div>
                <div className="truncate text-xs text-muted">@{profile?.username}</div>
              </div>
              {onAdd && <AddPill name={first ?? ""} onAdd={onAdd} />}
              {onMessage && <MessagePill name={first ?? ""} onMessage={onMessage} />}
              <button
                type="button"
                onClick={onClose}
                aria-label="Leave the core"
                className="flex h-11 w-11 items-center justify-center"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {stats.map(([n, label]) => (
              <div key={label} className="flex flex-col gap-0.5 rounded-[18px] bg-card-ink/5 p-3">
                <div className="display text-2xl">{n}</div>
                <div className="text-[11px] text-muted">{label}</div>
              </div>
            ))}
          </div>

          {todayPost && (
            <div className="flex flex-col gap-2.5 rounded-[20px] bg-card-ink/5 p-2.5">
              <button
                type="button"
                onClick={onOpenToday ?? (() => setOpen(open === todayPost.id ? null : todayPost.id))}
                aria-expanded={onOpenToday ? undefined : open === todayPost.id}
                className="flex items-center gap-3 text-left"
              >
                <Cover src={todayPost.artwork_url} seed={todayPost.title} size={52} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="text-[11px] text-muted">Today · {formatTime(todayPost.created_at, tz)}</div>
                  <div className="truncate text-[15px] font-semibold">{todayPost.title}</div>
                  <div className="truncate text-xs text-muted">{todayPost.artist}</div>
                </div>
              </button>
              {!onOpenToday && open === todayPost.id && (
                <div className="rise-in flex flex-col gap-2.5 px-1 pb-1">
                  {todayPost.caption && <div className="text-sm leading-relaxed">“{todayPost.caption}”</div>}
                  <SongPlayer post={todayPost} />
                </div>
              )}
            </div>
          )}

          {months.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="display text-[17px]">Playlists</div>
              <div className="grid grid-cols-3 gap-2.5">
                {months.map((key) => {
                  const songs = list.filter((p) => monthKey(p.day) === key);
                  const on = month === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMonth(on ? null : key)}
                      aria-pressed={on}
                      className="flex flex-col gap-1.5 text-left"
                    >
                      <div className="relative aspect-square w-full">
                        <Cover
                          src={songs[0].artwork_url}
                          seed={songs[0].title}
                          size={120}
                          className="!h-full !w-full"
                          style={on ? { boxShadow: "0 0 0 3px #D7262B" } : undefined}
                        />
                        <div className="absolute bottom-1.5 right-1.5 flex h-5 items-center rounded-[10px] bg-white/[0.88] px-[7px] text-[10px] font-semibold">
                          {songs.length}
                        </div>
                      </div>
                      <div className="text-xs font-semibold">{monthName(key, key.slice(0, 4) !== thisYear)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {archive.length > 0 && (
            <div className="flex flex-col">
              <div className="display pb-1.5 text-[17px]">{month ? monthName(month, month.slice(0, 4) !== thisYear) : "Archive"}</div>
              {archive.map((p, j) => (
                <div key={p.id} className={j ? "border-t border-card-ink/[0.08]" : ""}>
                  <button
                    type="button"
                    onClick={() => setOpen(open === p.id ? null : p.id)}
                    aria-expanded={open === p.id}
                    className="flex h-[54px] w-full items-center gap-3 text-left"
                  >
                    <div className="w-11 flex-none text-[11px] font-semibold">{formatDay(p.day)}</div>
                    <Cover src={p.artwork_url} seed={p.title} size={38} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="truncate text-[13px] font-semibold">{p.title}</div>
                      <div className="truncate text-[11px] text-muted">{p.artist}</div>
                    </div>
                  </button>
                  {open === p.id && (
                    <div className="rise-in flex flex-col gap-2.5 pb-3">
                      {p.caption && <div className="text-sm leading-relaxed">“{p.caption}”</div>}
                      <SongPlayer post={p} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!mine && profile && !flagging && (
            <button
              type="button"
              onClick={() => setFlagging(true)}
              className="self-start text-xs font-semibold text-muted underline-offset-4 hover:underline"
            >
              Report or block {first}
            </button>
          )}
          {!mine && profile && flagging && (
            <div className="min-h-[250px] rounded-[22px] bg-card-ink/[0.03] p-4">
              <Safety
                api={api}
                who={profile.display_name}
                userId={profile.id}
                onBlocked={onBlocked}
                onDone={() => setFlagging(false)}
              />
            </div>
          )}

          {mine && (
            <Link href="/settings" className="self-start text-xs font-semibold text-muted underline-offset-4 hover:underline">
              Settings
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// Add someone to your globe from their core.
function AddPill({ name, onAdd }: { name: string; onAdd(): Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    setBusy(true);
    setError(null);
    const e = await onAdd();
    setBusy(false);
    if (e) setError(e);
  };
  return (
    <button
      type="button"
      onClick={add}
      disabled={busy}
      aria-label={`Add ${name} to your globe`}
      title={error ?? undefined}
      className="mr-1.5 flex h-[34px] flex-none items-center gap-1.5 self-center rounded-[17px] bg-accent px-3.5 text-xs font-semibold text-white disabled:opacity-60"
    >
      <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {error ? "Try again" : "Add"}
    </button>
  );
}

// Message someone from their core; the conversation opens in the globe chat.
function MessagePill({ name, onMessage }: { name: string; onMessage(): void }) {
  return (
    <button
      type="button"
      onClick={onMessage}
      aria-label={`Message ${name}`}
      className="mr-1.5 flex h-[34px] flex-none items-center gap-1.5 self-center rounded-[17px] bg-card-ink px-3.5 text-xs font-semibold text-white"
    >
      <ChatIcon size={13} />
      Message
    </button>
  );
}
