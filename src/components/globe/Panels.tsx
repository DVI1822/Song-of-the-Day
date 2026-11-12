"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatDay, formatTime, todayIn } from "@/lib/day";
import type { Activity, AddedMe, Friend, MayKnow, Post, Profile } from "@/lib/types";
import type { GlobeApi } from "./api";
import { InviteCard } from "./Invite";
import { SignalCore } from "./SignalCore";
import { SongPlayer } from "./Preview";
import { LevelsIcon } from "./Reactions";
import { Cover, Face, SearchIcon, coverRadius } from "./ui";

const Kicker = ({ children }: { children: React.ReactNode }) => (
  <div className="px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{children}</div>
);

// ---------------------------------------------------------------------------
// My friends: everyone on your globe, whoever posted most recently on top,
// then the people who haven't posted yet, by name. When a new song comes in,
// its poster rises to the top and everyone else slides down. Beside each
// one, their streak, their song today (tap to fly to it, or an empty ring if
// they haven't posted) and their core. Anything new since you last looked gets a dot. Above, likes and notes
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
  const byLatest = (a: { f: Friend }, b: { f: Friend }) =>
    a.f.post && b.f.post ? b.f.post.created_at.localeCompare(a.f.post.created_at) : a.f.post ? -1 : b.f.post ? 1 : byName(a, b);
  const shown = all.filter((x) => !x.f.hidden).sort(byLatest);
  const rows = useSlide(shown.map((x) => x.f.id).join(" "));
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
          <div key={f.id} ref={rows(f.id)} data-motion className="relative flex h-[54px] items-center gap-1 pl-2">
            <PersonButton p={f} onCore={onCore}>
              <Avatar p={f} />
              <div className="flex min-w-0 flex-1 flex-col gap-px">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{f.display_name}</span>
                  {Boolean(f.streak) && <Streak days={f.streak!} />}
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

// Slides rows to their new places when the order changes: whoever just posted
// rises to the top (over the others) and everyone above them slides down one.
// Keeps moving with Reduce Motion on, like the song's buttons (data-motion).
function useSlide(order: string) {
  const els = useRef(new Map<string, HTMLElement>());
  const tops = useRef(new Map<string, number>());
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  useLayoutEffect(() => {
    const before = tops.current;
    const after = new Map<string, number>();
    for (const [id, el] of els.current) after.set(id, el.offsetTop);
    tops.current = after;
    if (!before.size) return; // first open: no slide
    for (const [id, el] of els.current) {
      const from = before.get(id);
      const to = after.get(id)!;
      if (from === undefined || from === to) continue;
      const rising = from > to;
      el.style.zIndex = rising ? "2" : "";
      el.animate(
        rising
          ? [
              { transform: `translateY(${from - to}px)`, offset: 0 },
              { transform: `translateY(${(from - to) * 0.35}px) scale(1.03)`, offset: 0.55 },
              { transform: "translateY(0) scale(1)", offset: 1 },
            ]
          : [{ transform: `translateY(${from - to}px)` }, { transform: "translateY(0)" }],
        { duration: rising ? 720 : 560, delay: rising ? 0 : 60, easing: "cubic-bezier(.2,.8,.2,1)" },
      ).onfinish = () => (el.style.zIndex = "");
    }
  }, [order]);
  return (id: string) => {
    let ref = refs.current.get(id);
    if (!ref) {
      ref = (el) => (el ? els.current.set(id, el) : els.current.delete(id));
      refs.current.set(id, ref);
    }
    return ref;
  };
}

// Days in a row someone has posted, counting today.
function Streak({ days }: { days: number }) {
  return (
    <span
      title={`${days}-day streak`}
      aria-label={`${days}-day streak`}
      className="flex flex-none items-center gap-0.5 text-[11px] font-semibold tabular-nums text-accent"
    >
      <svg width="10" height="12" viewBox="0 0 10 12" fill="none" aria-hidden>
        <path
          d="M5 11.2c2.2 0 3.8-1.5 3.8-3.6 0-2.4-2-3.6-2.4-6.1C5 2.6 4.4 4 4.6 5.3 3.8 4.9 3.4 4.1 3.3 3.3 1.9 4.5 1.2 6 1.2 7.6c0 2.1 1.6 3.6 3.8 3.6Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
      {days}
    </span>
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
            <Avatar p={a.user} />
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
            <Avatar p={f} muted />
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

const Avatar = ({ p, muted = false }: { p: Profile; muted?: boolean }) => (
  <Face p={p} className={muted ? "opacity-50" : ""} />
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

const PlusIcon = () => (
  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    aria-hidden
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    className={`flex-none transition-transform duration-200 ${open ? "rotate-180" : ""}`}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const mutualText = (n: number) => `${n} mutual friend${n === 1 ? "" : "s"}`;

// One person you could add. Their picture and the core beside them open their
// core (anyone's core can be opened, friend or not). If you share friends,
// tapping their name shows who.
function PersonRow({
  p,
  sub,
  mutuals = [],
  dot = false,
  addLabel,
  busy,
  onAdd,
  onCore,
}: {
  p: Profile;
  sub: string;
  mutuals?: Profile[];
  dot?: boolean;
  addLabel: string;
  busy: boolean;
  onAdd(): void;
  onCore(p: Profile): void;
}) {
  const [open, setOpen] = useState(false);
  const has = mutuals.length > 0;
  return (
    <div className={`rounded-[18px] transition-colors ${open ? "bg-card-ink/[0.045]" : ""}`}>
      <div className="flex h-[54px] items-center gap-2.5 px-2">
        <button
          type="button"
          onClick={() => onCore(p)}
          aria-label={`Open ${p.display_name}'s core`}
          className="relative flex-none"
        >
          <Avatar p={p} />
          {/* the little core says: tap for their core */}
          <span className="absolute -bottom-0.5 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-card shadow-[0_1px_4px_rgba(13,42,63,0.25)]">
            <SignalCore className="h-3 w-3" />
          </span>
        </button>
        <button
          type="button"
          onClick={() => (has ? setOpen(!open) : onCore(p))}
          aria-expanded={has ? open : undefined}
          aria-label={has ? `${p.display_name}, ${mutualText(mutuals.length)}. Show who` : `Open ${p.display_name}'s core`}
          className="flex min-w-0 flex-1 flex-col gap-px self-stretch justify-center pl-1 text-left"
        >
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{p.display_name}</span>
            {dot && <NewDot />}
          </span>
          <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted">
            <span className="truncate">{sub}</span>
            {has && <Chevron open={open} />}
          </span>
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={busy}
          aria-label={`${addLabel} ${p.display_name}`}
          className="flex h-[34px] flex-none items-center gap-1.5 rounded-[17px] bg-accent px-3.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          <PlusIcon />
          {addLabel}
        </button>
      </div>
      {open && (
        <div className="rise-in px-3 pb-3 pt-0.5">
          <div className="pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Friends with you both
          </div>
          <div className="flex flex-wrap gap-1.5">
            {mutuals.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onCore(m)}
                aria-label={`Open ${m.display_name}'s core`}
                className="flex h-8 items-center gap-1.5 rounded-full border border-card-ink/10 bg-card-ink/[0.03] pl-1 pr-3 text-xs font-medium"
              >
                <Face p={m} size={24} />
                {m.display_name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onCore(p)}
            className="mt-2.5 flex h-9 items-center gap-2 rounded-full pr-2 text-xs font-semibold text-accent"
          >
            <SignalCore className="h-4 w-4" />
            See {p.display_name.split(" ")[0]}&apos;s core
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Find a friend. On top, "Added you": people who want to be your friend.
// Below, "You may know": people who know someone on your globe, most shared
// friends first; tap a name to see who you share. Then your invite link.
// Searching by username swaps all of that for the results.
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
  const [known, setKnown] = useState<MayKnow[] | null>(api.mayKnow ? null : []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isNew = (at: string) => Date.parse(at) > seenBefore;
  const searching = Boolean(q.trim());

  useEffect(() => {
    let live = true;
    api.mayKnow?.().then((r) => live && setKnown(r)).catch(() => live && setKnown([]));
    return () => {
      live = false;
    };
  }, [api]);

  useEffect(() => {
    if (!searching) return;
    let live = true;
    const t = setTimeout(() => {
      api.searchPeople(q).then((r) => live && setFound(r));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, searching, api]);

  const onGlobe = new Set(friends.map((f) => f.id));
  const asked = new Map(addedMe.map((p) => [p.id, p]));
  const shared = new Map((known ?? []).map((p) => [p.id, p.mutuals]));
  // people who added you are listed above, so "You may know" skips them
  const mayKnow = (known ?? []).filter((p) => !onGlobe.has(p.id) && !asked.has(p.id));
  const results = found?.filter((p) => !p.following && !onGlobe.has(p.id));

  const add = async (p: Profile) => {
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

  const row = (p: Profile, sub: string) => (
    <PersonRow
      key={p.id}
      p={p}
      sub={sub}
      mutuals={shared.get(p.id)}
      dot={asked.has(p.id) && isNew(asked.get(p.id)!.added_at)}
      addLabel={asked.has(p.id) ? "Add back" : "Add"}
      busy={busy === p.id}
      onAdd={() => add(p)}
      onCore={onCore}
    />
  );
  const withMutuals = (first: string, id: string) => {
    const n = shared.get(id)?.length ?? 0;
    return n ? `${first} · ${mutualText(n)}` : first;
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
        {searching ? (
          <>
            {results?.map((p) =>
              row(p, withMutuals(asked.has(p.id) ? `@${p.username} · added you` : `@${p.username}`, p.id)),
            )}
            {results && !results.length && (
              <div className="px-2.5 py-[18px] text-[13px] text-muted">
                {found?.length ? "They're already on your globe" : "No one by that name yet"}
              </div>
            )}
          </>
        ) : (
          <>
            {addedMe.length > 0 && (
              <div className="pb-2.5">
                <Kicker>Added you · {addedMe.length}</Kicker>
                {addedMe.map((p) => {
                  // the header already says they added you, so the line says who you share
                  const n = shared.get(p.id)?.length ?? 0;
                  return row(p, n ? mutualText(n) : `added you ${formatDay(p.added_at.slice(0, 10))}`);
                })}
              </div>
            )}
            <div className="pb-2.5">
              <Kicker>You may know{mayKnow.length ? ` · ${mayKnow.length}` : ""}</Kicker>
              {known === null ? (
                <div className="px-2 py-3 text-[13px] text-muted">Looking…</div>
              ) : mayKnow.length ? (
                mayKnow.map((p) => row(p, mutualText(p.mutuals.length)))
              ) : (
                <div className="px-2 pb-2 pt-1 text-[13px] leading-snug text-muted">
                  {friends.length
                    ? "No one yet. When your friends add people, they'll show up here."
                    : "Add a friend, and the people they know show up here."}
                </div>
              )}
            </div>
            <div className="-mx-2.5 pb-2">
              <InviteCard
                api={api}
                username={me.username}
                firstName={me.display_name.split(" ")[0]}
                friends={friends}
                onFollowed={onFollowed}
              />
            </div>
          </>
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
  width,
}: {
  me: Profile;
  songs: Post[];
  width: number;
}) {
  const [open, setOpen] = useState<string | null>(null);
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
