"use client";

import { useEffect, useState } from "react";
import { formatDay, formatTime, initials, todayIn } from "@/lib/day";
import type { AddedMe, Friend, Post, Profile } from "@/lib/types";
import type { GlobeApi } from "./api";
import { InviteCard } from "./Invite";
import { SongPlayer } from "./Preview";
import { Cover, SearchIcon, coverRadius } from "./ui";

const Kicker = ({ children }: { children: React.ReactNode }) => (
  <div className="px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{children}</div>
);

// ---------------------------------------------------------------------------
// My friends: who added you, who's posted today, and who hasn't yet.
// ---------------------------------------------------------------------------

export function FriendsPanel({
  friends,
  addedMe,
  onAddBack,
  onOpen,
  onSpin,
  onFind,
}: {
  friends: Friend[];
  addedMe: AddedMe[];
  onAddBack(p: AddedMe): Promise<string | null>;
  onOpen(k: number): void;
  onSpin(k: number): void;
  onFind(): void;
}) {
  const byName = (a: { f: Friend }, b: { f: Friend }) => a.f.display_name.localeCompare(b.f.display_name);
  const all = friends.map((f, k) => ({ f, k }));
  const posted = all.filter((x) => x.f.post).sort(byName);
  const waiting = all.filter((x) => !x.f.post).sort(byName);

  const added = addedMe.length > 0 && <AddedYou people={addedMe} onAddBack={onAddBack} />;

  if (!friends.length)
    return (
      <div className="flex flex-1 flex-col items-start gap-3 overflow-y-auto px-[18px] pt-2">
        {added && <div className="-mx-2 self-stretch">{added}</div>}
        <div className="text-sm text-muted">No one on your globe yet.</div>
        <button type="button" onClick={onFind} className="h-10 rounded-full bg-accent px-4 text-[13px] font-semibold text-white">
          Find a friend
        </button>
      </div>
    );

  return (
    <div className="flex-1 overflow-y-auto px-2.5 pb-4">
      {added}
      <Kicker>Posted today · {posted.length}</Kicker>
      {posted.map(({ f, k }) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onOpen(k)}
          aria-label={`Open ${f.display_name}'s song`}
          className="flex h-[50px] w-full items-center gap-3 rounded-[14px] px-2 text-left hover:bg-card-ink/5"
        >
          <Cover src={f.post!.artwork_url} seed={f.post!.title} size={34} />
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <div className="truncate text-sm font-semibold">{f.display_name}</div>
            <div className="truncate text-[11px] text-muted">
              {f.post!.title}
              {f.post!.artist && ` · ${f.post!.artist}`}
            </div>
          </div>
          <div className="text-[10px] text-muted">{formatTime(f.post!.created_at, f.timezone)}</div>
        </button>
      ))}
      <div className="pt-2.5">
        <Kicker>Not yet · {waiting.length}</Kicker>
      </div>
      {waiting.map(({ f, k }) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onSpin(k)}
          aria-label={`Spin to ${f.display_name}`}
          className="flex h-[46px] w-full items-center gap-3 rounded-[14px] px-2 text-left hover:bg-card-ink/5"
        >
          <div
            className="box-border flex h-[34px] w-[34px] flex-none items-center justify-center border border-dashed border-muted text-[10px] font-semibold text-muted"
            style={{ borderRadius: coverRadius(34) }}
          >
            {initials(f.display_name)}
          </div>
          <div className="min-w-0 flex-1 truncate text-sm text-muted">{f.display_name}</div>
        </button>
      ))}
    </div>
  );
}

// People who added you and you haven't added back, each with an "Add back".
function AddedYou({ people, onAddBack }: { people: AddedMe[]; onAddBack(p: AddedMe): Promise<string | null> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const add = async (p: AddedMe) => {
    setBusy(p.id);
    setError(null);
    const e = await onAddBack(p);
    setBusy(null);
    if (e) setError(e);
  };
  return (
    <div className="pb-2.5">
      <Kicker>Added you · {people.length}</Kicker>
      {people.map((p) => (
        <div key={p.id} className="flex h-[54px] items-center gap-3 px-2">
          <div
            className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[11px] font-semibold"
            style={{ background: "linear-gradient(135deg, #FFE1D6, #F6A9A0)", color: "#8A2A22" }}
          >
            {initials(p.display_name)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <div className="truncate text-sm font-semibold">{p.display_name}</div>
            <div className="truncate text-[11px] text-muted">added you · {formatDay(p.added_at.slice(0, 10))}</div>
          </div>
          <button
            type="button"
            onClick={() => add(p)}
            disabled={busy === p.id}
            aria-label={`Add ${p.display_name} back`}
            className="flex h-[34px] flex-none items-center gap-1.5 rounded-[17px] bg-accent px-3.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add back
          </button>
        </div>
      ))}
      {error && <p className="px-2 pt-1 text-xs text-accent-deep">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Find a friend, by username.
// ---------------------------------------------------------------------------

type Found = Profile & { following: boolean };

export function FindPanel({
  api,
  me,
  friends,
  onFollowed,
  onSpin,
}: {
  api: GlobeApi;
  me: Profile;
  friends: Friend[];
  onFollowed(f: Friend): void;
  onSpin(k: number): void;
}) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      api.searchPeople(q).then((r) => live && setFound(r));
    }, q ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, api]);

  const add = async (p: Found) => {
    setBusy(p.id);
    setError(null);
    const r = await api.follow(p.id);
    setBusy(null);
    if (r.friend) onFollowed(r.friend);
    else setError(r.error ?? "Couldn't add them. Try again.");
  };

  return (
    <>
      <div className="px-3.5 pb-2.5 pt-1">
        <label className="flex h-[46px] items-center gap-2 rounded-[23px] border border-card-ink/12 bg-card-ink/[0.04] px-3.5">
          <SearchIcon />
          <span className="text-[15px] text-muted">@</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="username"
            aria-label="Search by username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70"
          />
        </label>
        {error && <p className="px-2 pt-2 text-xs text-accent-deep">{error}</p>}
      </div>
      <div className="flex-1 overflow-y-auto px-2.5 pb-4">
        {!q.trim() && (
          <div className="-mx-2.5 pb-2">
            <InviteCard
              api={api}
              username={me.username}
              firstName={me.display_name.split(" ")[0]}
              friends={friends}
              onFollowed={onFollowed}
            />
          </div>
        )}
        {found?.map((p) => {
          const k = friends.findIndex((f) => f.id === p.id);
          const on = p.following || k >= 0;
          return (
            <div key={p.id} className="flex h-[54px] items-center gap-3 px-2">
              <div
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[11px] font-semibold"
                style={{ background: "linear-gradient(135deg, #DDE3F5, #A9DCD6)", color: "#245866" }}
              >
                {initials(p.display_name)}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-px">
                <div className="truncate text-sm font-semibold">{p.display_name}</div>
                <div className="truncate text-xs text-muted">@{p.username}</div>
              </div>
              {on ? (
                <button
                  type="button"
                  onClick={() => k >= 0 && onSpin(k)}
                  className="h-[34px] rounded-[17px] border border-card-ink/20 px-3.5 text-xs font-semibold"
                >
                  On your globe
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => add(p)}
                  disabled={busy === p.id}
                  aria-label={`Add ${p.display_name} to your globe`}
                  className="flex h-[34px] items-center gap-1.5 rounded-[17px] bg-accent px-3.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add
                </button>
              )}
            </div>
          );
        })}
        {found && !found.length && q.trim() && (
          <div className="px-2.5 py-[18px] text-[13px] text-muted">No one by that name yet</div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// My songs: everything you've shared, newest first.
// ---------------------------------------------------------------------------

export function SongsPanel({
  me,
  songs,
  canRedo,
  onRedo,
  width,
}: {
  me: Profile;
  songs: Post[];
  canRedo: boolean;
  onRedo(post: Post): Promise<string | undefined>;
  width: number;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = todayIn(me.timezone);
  const big = Math.min(248, width - 48);

  if (!songs.length) return <div className="px-[18px] pt-2 text-sm text-muted">Your songs land here, one a day.</div>;

  return (
    <div className="flex-1 overflow-y-auto px-2.5 pb-4">
      {songs.map((p) => {
        const isOpen = open === p.id;
        const isToday = p.day === today;
        const date = isToday ? "Today" : formatDay(p.day);
        return (
          <div key={p.id} className={`rounded-[18px] ${isOpen ? "bg-card-ink/[0.04]" : ""}`}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : p.id)}
              aria-expanded={isOpen}
              aria-label={`${p.title} by ${p.artist}, ${date}`}
              className="flex h-[58px] w-full items-center gap-3 px-2 text-left"
            >
              <Cover src={p.artwork_url} seed={p.title} size={42} />
              <div className="flex min-w-0 flex-1 flex-col gap-px">
                <div className="truncate text-sm font-semibold">{p.title}</div>
                <div className="truncate text-xs text-muted">{p.artist}</div>
              </div>
              <div className={`text-[11px] font-semibold ${isToday ? "text-accent" : "text-muted"}`}>{date}</div>
            </button>
            {isOpen && (
              <div className="rise-in flex flex-col gap-3 px-3 pb-3.5 pt-1">
                <Cover
                  src={p.artwork_url}
                  seed={p.title}
                  size={big}
                  style={{ boxShadow: "0 20px 40px -20px rgba(13,42,63,0.55)" }}
                />
                <div className="flex flex-col gap-0.5">
                  <div className="display text-[19px] leading-tight">{p.title}</div>
                  <div className="text-[13px] text-muted">
                    {[p.artist, p.album].filter(Boolean).join(" · ")}
                  </div>
                  <div className="pt-0.5 text-[11px] text-muted">
                    {date} at {formatTime(p.created_at, me.timezone)}
                  </div>
                </div>
                {p.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo_url} alt="" className="h-[150px] w-full rounded-2xl object-cover" loading="lazy" />
                )}
                {p.caption && <div className="text-sm leading-relaxed">“{p.caption}”</div>}
                <SongPlayer post={p} />
                {isToday && canRedo && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError(await onRedo(p) ?? null);
                      setBusy(false);
                    }}
                    className="h-10 rounded-full border border-card-ink/20 text-xs font-semibold disabled:opacity-60"
                  >
                    Redo today&apos;s song · 1 left
                  </button>
                )}
                {isToday && error && <p className="text-xs text-accent-deep">{error}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
