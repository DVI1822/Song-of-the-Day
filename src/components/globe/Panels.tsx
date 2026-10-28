"use client";

import { useEffect, useState } from "react";
import { formatDay, formatTime, initials, todayIn } from "@/lib/day";
import type { Activity, AddedMe, Friend, Post, Profile } from "@/lib/types";
import type { GlobeApi } from "./api";
import { InviteCard } from "./Invite";
import { SignalCore } from "./SignalCore";
import { SongPlayer } from "./Preview";
import { LevelsIcon } from "./Reactions";
import { Cover, SearchIcon, coverRadius } from "./ui";

const Kicker = ({ children }: { children: React.ReactNode }) => (
  <div className="px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{children}</div>
);

// ---------------------------------------------------------------------------
// My friends: everyone on your globe, by name. Beside each one, their song
// today (tap to fly to it, or an empty ring if they haven't posted) and their
// core. Anything new since you last looked gets a dot. Above, likes and notes
// on your song; below, whose songs you've hidden.
// ---------------------------------------------------------------------------

export function FriendsPanel({
  friends,
  activity,
  onMine,
  seenBefore,
  onShow,
  onOpen,
  onCore,
  onFind,
}: {
  friends: Friend[];
  activity: Activity[];
  onMine(): void; // open your song
  seenBefore: number; // when you last looked, in ms
  onShow(f: Friend): Promise<string | null>;
  onOpen(k: number): void;
  onCore(p: Profile): void;
  onFind(): void;
}) {
  const isNew = (at: string | null | undefined) => Boolean(at) && Date.parse(at!) > seenBefore;
  const byName = (a: { f: Friend }, b: { f: Friend }) => a.f.display_name.localeCompare(b.f.display_name);
  const all = friends.map((f, k) => ({ f, k }));
  const shown = all.filter((x) => !x.f.hidden).sort(byName);
  const hidden = all.filter((x) => x.f.hidden).sort(byName);
  const posted = shown.filter((x) => x.f.post).length;
  const mine = activity.length > 0 && <OnYourSong activity={activity} isNew={isNew} onMine={onMine} />;

  if (!friends.length)
    return (
      <div className="flex flex-1 flex-col items-start gap-3 overflow-y-auto px-[18px] pt-2">
        {mine && <div className="-mx-2 self-stretch">{mine}</div>}
        <div className="text-sm text-muted">No one on your globe yet.</div>
        <button type="button" onClick={onFind} className="h-10 rounded-full bg-accent px-4 text-[13px] font-semibold text-white">
          Find a friend
        </button>
      </div>
    );

  return (
    <div className="flex-1 overflow-y-auto px-2.5 pb-4">
      {mine}
      <Kicker>
        On your globe · {shown.length} · {posted} posted today
      </Kicker>
      {shown.map(({ f, k }) => {
        const p = f.post;
        const back = isNew(f.followed_back_at);
        return (
          <div key={f.id} className="flex h-[54px] items-center gap-1 pl-2">
            <PersonButton p={f} onCore={onCore}>
              <Avatar name={f.display_name} />
              <div className="flex min-w-0 flex-1 flex-col gap-px">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{f.display_name}</span>
                  {(back || isNew(p?.created_at)) && <NewDot />}
                </div>
                <div className="truncate text-[11px] text-muted">
                  {back
                    ? `added you back · ${formatTime(f.followed_back_at!, localZone())}`
                    : p
                      ? `${p.title}${p.artist ? ` · ${p.artist}` : ""}`
                      : "hasn't posted today"}
                </div>
              </div>
            </PersonButton>
            {p ? (
              <button
                type="button"
                onClick={() => onOpen(k)}
                aria-label={`Open ${f.display_name}'s song, ${p.title}`}
                className="flex h-11 w-11 flex-none items-center justify-center"
              >
                <Cover src={p.artwork_url} seed={p.title} size={30} style={{ boxShadow: "0 3px 8px -3px rgba(13,42,63,0.5)" }} />
              </button>
            ) : (
              <span
                role="img"
                aria-label={`${f.display_name} hasn't posted today`}
                className="flex h-11 w-11 flex-none items-center justify-center"
              >
                <span className="box-border h-[30px] w-[30px] border border-dashed border-muted/70" style={{ borderRadius: coverRadius(30) }} />
              </span>
            )}
            <CoreButton name={f.display_name} onClick={() => onCore(f)} />
          </div>
        );
      })}
      {hidden.length > 0 && <Hidden people={hidden.map((x) => x.f)} onShow={onShow} onCore={onCore} />}
    </div>
  );
}

// Likes and notes on your song today, newest first.
function OnYourSong({ activity, isNew, onMine }: { activity: Activity[]; isNew(at: string): boolean; onMine(): void }) {
  const feels = activity.filter((a) => a.kind === "feel").length,
    notes = activity.length - feels;
  return (
    <div className="pb-2.5">
      <Kicker>
        On your song · {feels} {feels === 1 ? "like" : "likes"}
        {notes > 0 && `, ${notes} ${notes === 1 ? "note" : "notes"}`}
      </Kicker>
      {activity.slice(0, 12).map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={onMine}
          className="flex min-h-[50px] w-full items-center gap-3 rounded-[14px] px-2 py-1.5 text-left hover:bg-card-ink/5"
        >
          <span className="relative flex-none">
            <Avatar name={a.user.display_name} />
            {a.kind === "feel" && (
              <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white text-accent shadow-[0_1px_3px_rgba(13,42,63,0.25)]">
                <LevelsIcon on size={11} />
              </span>
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <div className="truncate text-sm">
              <span className="font-semibold">{a.user.display_name}</span>
              {a.kind === "feel" ? " liked it" : " left a note"}
            </div>
            {a.body && <div className="line-clamp-2 text-[12px] leading-snug text-muted">“{a.body}”</div>}
          </div>
          <div className="flex-none text-[10px] text-muted">{formatTime(a.at, localZone())}</div>
          {isNew(a.at) && <NewDot />}
        </button>
      ))}
    </div>
  );
}

// People whose songs you've hidden: still friends, just off your globe.
function Hidden({
  people,
  onShow,
  onCore,
}: {
  people: Friend[];
  onShow(f: Friend): Promise<string | null>;
  onCore(p: Profile): void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const show = async (f: Friend) => {
    setBusy(f.id);
    setError(null);
    const e = await onShow(f);
    setBusy(null);
    if (e) setError(e);
  };
  return (
    <div className="pt-2.5">
      <Kicker>Hidden from your globe · {people.length}</Kicker>
      {people.map((f) => (
        <div key={f.id} className="flex h-[50px] items-center gap-3 px-2">
          <PersonButton p={f} onCore={onCore}>
            <Avatar name={f.display_name} muted />
            <div className="min-w-0 flex-1 truncate text-sm text-muted">{f.display_name}</div>
          </PersonButton>
          <button
            type="button"
            onClick={() => show(f)}
            disabled={busy === f.id}
            aria-label={`Show ${f.display_name}'s songs again`}
            className="h-[30px] flex-none rounded-[15px] bg-card-ink/[0.06] px-3 text-xs font-semibold disabled:opacity-60"
          >
            Show
          </button>
        </div>
      ))}
      {error && <p className="px-2 pt-1 text-xs text-accent-deep">{error}</p>}
    </div>
  );
}

const Avatar = ({ name, muted = false }: { name: string; muted?: boolean }) => (
  <div
    className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[11px] font-semibold ${muted ? "opacity-50" : ""}`}
    style={{ background: "linear-gradient(135deg, #FFE1D6, #F6A9A0)", color: "#8A2A22" }}
  >
    {initials(name)}
  </div>
);

// Tapping a person opens their core: every song they've shared, by month.
const PersonButton = ({ p, onCore, children }: { p: Profile; onCore(p: Profile): void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={() => onCore(p)}
    aria-label={`Open ${p.display_name}'s core`}
    className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-left"
  >
    {children}
  </button>
);

const CoreButton = ({ name, onClick }: { name: string; onClick(): void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Open ${name}'s core`}
    className="flex h-11 w-11 flex-none items-center justify-center rounded-full"
  >
    <SignalCore className="h-[18px] w-[18px] drop-shadow-[0_1px_4px_rgba(60,90,110,0.45)]" />
  </button>
);

// times of things done to you read in your own clock
const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const NewDot = () => <span aria-hidden className="h-2 w-2 flex-none rounded-full bg-accent" />;

// People who added you and you haven't added back, each with an "Add back".
function AddedYou({
  people,
  isNew,
  onAddBack,
  onCore,
}: {
  people: AddedMe[];
  isNew(at: string): boolean;
  onAddBack(p: AddedMe): Promise<string | null>;
  onCore(p: Profile): void;
}) {
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
          <PersonButton p={p} onCore={onCore}>
            <Avatar name={p.display_name} />
            <div className="flex min-w-0 flex-1 flex-col gap-px">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{p.display_name}</span>
                {isNew(p.added_at) && <NewDot />}
              </div>
              <div className="truncate text-[11px] text-muted">added you · {formatDay(p.added_at.slice(0, 10))}</div>
            </div>
          </PersonButton>
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
// Find a friend: people who added you, your invite link, and new people to
// add, newest first, or search by username. Anyone already on your globe
// lives in My friends instead.
// ---------------------------------------------------------------------------

type Found = Profile & { following: boolean };

export function FindPanel({
  api,
  me,
  friends,
  addedMe,
  seenBefore,
  onAddBack,
  onFollowed,
  onCore,
}: {
  api: GlobeApi;
  me: Profile;
  friends: Friend[];
  addedMe: AddedMe[];
  seenBefore: number;
  onAddBack(p: AddedMe): Promise<string | null>;
  onFollowed(f: Friend): void;
  onCore(p: Profile): void;
}) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isNew = (at: string) => Date.parse(at) > seenBefore;

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

  const searching = Boolean(q.trim());
  const onGlobe = new Set(friends.map((f) => f.id));
  const asked = new Map(addedMe.map((p) => [p.id, p]));
  // people who added you are listed above, so the newest-people list skips them
  const people = found?.filter((p) => !p.following && !onGlobe.has(p.id) && (searching || !asked.has(p.id)));

  const add = async (p: Found) => {
    setBusy(p.id);
    setError(null);
    const them = asked.get(p.id);
    if (them) {
      const e = await onAddBack(them);
      setBusy(null);
      if (e) setError(e);
      return;
    }
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
        {!searching && (
          <>
            {addedMe.length > 0 && <AddedYou people={addedMe} isNew={isNew} onAddBack={onAddBack} onCore={onCore} />}
            <div className="-mx-2.5 pb-2">
              <InviteCard
                api={api}
                username={me.username}
                firstName={me.display_name.split(" ")[0]}
                friends={friends}
                onFollowed={onFollowed}
              />
            </div>
            {people && people.length > 0 && <Kicker>New people</Kicker>}
          </>
        )}
        {people?.map((p) => (
          <div key={p.id} className="flex h-[54px] items-center gap-3 px-2">
            <PersonButton p={p} onCore={onCore}>
              <div
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[11px] font-semibold"
                style={{ background: "linear-gradient(135deg, #DDE3F5, #A9DCD6)", color: "#245866" }}
              >
                {initials(p.display_name)}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-px">
                <div className="truncate text-sm font-semibold">{p.display_name}</div>
                <div className="truncate text-xs text-muted">
                  @{p.username}
                  {asked.has(p.id) && " · added you"}
                </div>
              </div>
            </PersonButton>
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
              {asked.has(p.id) ? "Add back" : "Add"}
            </button>
          </div>
        ))}
        {people && !people.length && searching && (
          <div className="px-2.5 py-[18px] text-[13px] text-muted">
            {found?.length ? "They're already on your globe" : "No one by that name yet"}
          </div>
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
                {/* photos last one day */}
                {isToday && p.photo_url && (
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
