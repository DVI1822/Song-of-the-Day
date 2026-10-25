"use client";

import Link from "next/link";
import { useState, type Ref } from "react";
import { formatDay, formatTime, monthKey, monthName, streak, todayIn, usualHour } from "@/lib/day";
import type { Post, Profile } from "@/lib/types";
import type { GlobeApi } from "./api";
import { SongPlayer } from "./Preview";
import { Safety } from "./Safety";
import { Cover, CloseIcon, glass, glassThin } from "./ui";

// Someone's profile, shown once the camera has flown into their core.
export function CoreView({
  profile,
  posts,
  mine,
  dark,
  sheetTop,
  onClose,
  onOpenToday,
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
  onOpenToday(): void;
  api: GlobeApi;
  onBlocked(): void;
  rootRef: Ref<HTMLDivElement>;
  sheetRef: Ref<HTMLDivElement>;
}) {
  const [month, setMonth] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [flagging, setFlagging] = useState(false);
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

      <div
        ref={sheetRef}
        className="pointer-events-auto absolute inset-x-3 bottom-3 mx-auto flex max-w-[520px] flex-col gap-5 overflow-y-auto rounded-[28px] px-4 pb-[22px] pt-4"
        style={{ top: sheetTop, ...glassThin(dark) }}
      >
        <div className="grid grid-cols-3 gap-2">
          {stats.map(([n, label]) => (
            <div key={label} className="flex flex-col gap-0.5 rounded-[18px] bg-card-ink/5 p-3">
              <div className="display text-2xl">{n}</div>
              <div className="text-[11px] text-muted">{label}</div>
            </div>
          ))}
        </div>

        {todayPost && (
          <button type="button" onClick={onOpenToday} className="flex items-center gap-3 rounded-[20px] bg-card-ink/5 p-2.5 text-left">
            <Cover src={todayPost.artwork_url} seed={todayPost.title} size={52} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="text-[11px] text-muted">Today · {formatTime(todayPost.created_at, tz)}</div>
              <div className="truncate text-[15px] font-semibold">{todayPost.title}</div>
              <div className="truncate text-xs text-muted">{todayPost.artist}</div>
            </div>
          </button>
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
  );
}
