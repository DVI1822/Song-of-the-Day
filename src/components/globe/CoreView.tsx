"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type Ref } from "react";
import { addDays, initials, streak, todayIn } from "@/lib/day";
import type { CoreExtras, Post, Profile, SavedSong, Taste } from "@/lib/types";
import type { GlobeApi } from "./api";
import { ChatIcon } from "./Chat";
import { PeoplePane, Shelf, SongsPane, Tabs, TastePane } from "./CoreTabs";
import { Safety } from "./Safety";
import { CloseIcon, glass, glassThin } from "./ui";

type Tab = "taste" | "songs" | "people";
const TABS: [Tab, string][] = [
  ["taste", "Taste"],
  ["songs", "Songs"],
  ["people", "People"],
];

const FULL_TOP = "max(10px, env(safe-area-inset-top))";

// Someone's profile, shown once the camera has flown into their core.
export function CoreView({
  profile,
  posts,
  saved,
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
  onAvatar,
  onCenter,
  onPerson,
  globe,
}: {
  profile: Profile | null;
  posts: Post[] | null; // null while loading
  saved?: SavedSong[] | null; // your own core: the songs you saved
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
  onAvatar?: (file: File) => Promise<string | { error: string }>; // your own core: change your picture
  onCenter?: (y: number) => void; // where the picture sits, for the core's rings to circle
  onPerson?: (p: Profile) => void; // fly into someone else's core
  globe?: { people: number; posted: number }; // your own globe, as it is right now
}) {
  const [flagging, setFlagging] = useState(false);
  const [tab, setTab] = useState<Tab>("taste");
  // the rest of the core, fetched as you arrive: picks, feels, people, taste
  const id = profile?.id ?? null;
  const [shown, setShown] = useState(id);
  const [extras, setExtras] = useState<CoreExtras | null>(null);
  const [taste, setTaste] = useState<Taste | null>(null);
  const [tasteFailed, setTasteFailed] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
  if (shown !== id) {
    // a different core: start again on its Taste
    setShown(id);
    setExtras(null);
    setTaste(null);
    setTasteFailed(false);
    setRank(null);
    setTab("taste");
  }
  useEffect(() => {
    if (!id) return;
    let on = true;
    api.coreExtras?.(id).then((x) => on && setExtras(x));
    api.ranks?.board().then((b) => {
      if (!on) return;
      const sorted = [...b].sort((x, y) => y.month - x.month);
      const i = sorted.findIndex((x) => x.who === id);
      if (i >= 0 && sorted[i].month > 0) setRank(sorted.filter((x) => x.month > sorted[i].month).length + 1);
    });
    // the taste: songs are looked up a few at a time, so ask again while
    // some are still waiting
    let tries = 0,
      timer: ReturnType<typeof setTimeout> | undefined;
    const ask = () =>
      (api.taste ? api.taste(id) : Promise.resolve(null)).then((t) => {
        if (!on) return;
        if (!t) return setTasteFailed(true);
        setTaste(t);
        if ((t.pending || !t.overview) && t.picks >= 3 && ++tries < 8) timer = setTimeout(ask, 6000 + tries * 2000);
      });
    ask();
    return () => {
      on = false;
      clearTimeout(timer);
    };
  }, [id, api]);
  // the sheet slides up to fill the screen: drag its handle, tap it, or scroll.
  // Dragged down far enough, from the handle or from anywhere while it's
  // scrolled to the top, it lets go of the core and you're back on the globe.
  const [full, setFull] = useState(false);
  const drag = useRef<number | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  // the sheet rests just under the picture and name, the core's rings above
  const who = useRef<HTMLDivElement>(null);
  const pic = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const a = pic.current?.getBoundingClientRect(),
        b = who.current?.getBoundingClientRect();
      if (a) onCenter?.(a.top + a.height / 2);
      if (b) setMeasured(Math.round(b.bottom + 18));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [onCenter]);
  const top = measured ?? sheetTop;
  const low = `translateY(calc(${top}px - ${FULL_TOP}))`; // where it rests until pulled up
  const live = useRef({ full, low, sheetTop: top, onClose });
  useEffect(() => {
    live.current = { full, low, sheetTop: top, onClose };
  });
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    let y0: number | null = null,
      dy = 0;
    const start = (e: TouchEvent) => {
      // the handle has its own drag
      const onHandle = (e.target as Element | null)?.closest?.("[data-handle]");
      y0 = el.scrollTop <= 0 && !onHandle ? e.touches[0].clientY : null;
      dy = 0;
    };
    const move = (e: TouchEvent) => {
      if (y0 === null) return;
      dy = e.touches[0].clientY - y0;
      if (dy <= 0 || el.scrollTop > 0) {
        if (dy < 0) y0 = null; // scrolling up through the songs as usual
        return;
      }
      e.preventDefault();
      const { full, sheetTop } = live.current;
      const base = full ? "0px" : `(${sheetTop}px - ${FULL_TOP})`;
      el.style.transition = "none";
      el.style.transform = `translateY(calc(${base} + ${dy}px))`;
    };
    const end = () => {
      if (y0 === null) return;
      y0 = null;
      el.style.transition = "";
      const { full, low, onClose } = live.current;
      if (dy > (full ? window.innerHeight * 0.3 : 70)) onClose();
      else if (full && dy > 120) setFull(false);
      else el.style.transform = full ? "none" : low;
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, []);
  const tz = profile?.timezone ?? "UTC";
  const today = todayIn(tz);
  const list = posts ?? [];
  const first = profile?.display_name.split(" ")[0];
  const ink = dark ? "#EEF3F8" : "#0D2A3F";
  const muted = dark ? "#93A6B8" : "#6A818C";

  const days = list.map((p) => p.day);
  const crowns = Object.values(extras?.picks ?? {}).reduce((a, n) => a + n, 0);
  const shelf: { n: string; label: string; icon?: "flame" | "crown" }[] = [
    { n: posts ? String(streak(days, today)) : "–", label: "day streak", icon: "flame" },
    { n: extras ? String(crowns) : "–", label: crowns === 1 ? "crown" : "crowns", icon: "crown" },
    ...(rank ? [{ n: `#${rank}`, label: "this month" }] : []),
    { n: posts ? String(list.length) : "–", label: list.length === 1 ? "song" : "songs" },
    { n: posts ? String(bestStreak(days)) : "–", label: "best streak" },
  ];


  return (
    <div ref={rootRef} className="pointer-events-none fixed inset-0 z-[500]" style={{ opacity: 0 }}>
      <div className="pointer-events-auto absolute left-6 right-3 top-[max(30px,env(safe-area-inset-top))] flex items-center gap-2">
        <div className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors" style={{ color: muted }}>
          {mine ? "Your core" : `${first}'s core`}
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

      {/* who it is, at the heart of their core */}
      <div
        ref={who}
        className="pointer-events-auto absolute inset-x-6 top-[calc(max(30px,env(safe-area-inset-top))+52px)] flex flex-col items-center gap-1 text-center"
      >
        <div ref={pic}>
          <Avatar
            url={profile?.avatar_url ?? null}
            name={profile?.display_name ?? ""}
            onPick={mine ? onAvatar : undefined}
          />
        </div>
        <div
          className="display mt-1.5 max-w-full truncate text-[26px] leading-tight transition-colors"
          style={{ color: ink, textShadow: dark ? "0 1px 12px rgba(4,5,12,0.85)" : "none" }}
        >
          {profile?.display_name}
        </div>
        <div className="text-[13px] transition-colors" style={{ color: muted, textShadow: dark ? "0 1px 10px rgba(4,5,12,0.85)" : "none" }}>
          @{profile?.username}
        </div>
      </div>

      {/* the sheet keeps one size and only slides (smooth on phones); the
          globe's frame loop moves this wrapper in when the core opens */}
      <div ref={sheetRef} className="absolute inset-0">
        <div
          ref={sheet}
          onScroll={(e) => !full && e.currentTarget.scrollTop > 40 && setFull(true)}
          className="pointer-events-auto absolute inset-x-0 bottom-0 mx-auto flex max-w-[560px] flex-col gap-5 overflow-y-auto [&>*]:flex-none rounded-t-[28px] px-4 pb-[22px] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ top: FULL_TOP, transform: full ? "none" : low, ...glassThin(dark) }}
        >
          <div
            data-handle
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
              const base = full ? "0px" : `(${top}px - ${FULL_TOP})`;
              el.style.transition = "none";
              el.style.transform = `translateY(max(0px, calc(${base} + ${dy}px)))`;
            }}
            onPointerUp={(e) => {
              const dy = drag.current === null ? 0 : e.clientY - drag.current;
              drag.current = null;
              const el = sheet.current;
              if (el) el.style.transition = "";
              // pulled well down from where it rests: back out to the globe
              if (dy > (full ? window.innerHeight * 0.45 : 70)) onClose();
              else if (dy < -24) setFull(true);
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
              className={`flex w-full items-center gap-2 transition-opacity duration-300 ${
                full ? "pb-1 opacity-100" : "pointer-events-none h-0 overflow-hidden opacity-0"
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
          <Shelf items={shelf} />
          <Tabs<Tab>
            tabs={TABS}
            on={tab}
            set={setTab}
          />
          {tab === "taste" && <TastePane taste={taste} failed={tasteFailed} first={first ?? ""} />}
          {tab === "songs" &&
            (posts ? (
              <SongsPane
                posts={list}
                today={today}
                picks={extras?.picks ?? {}}
                feels={extras?.feels ?? {}}
                saved={saved}
                first={first ?? ""}
                mine={mine}
                onToday={onOpenToday}
              />
            ) : (
              <p className="text-sm text-muted">Loading…</p>
            ))}
          {tab === "people" && (
            <PeoplePane
              extras={extras}
              mine={mine}
              first={first ?? ""}
              globe={globe ?? { people: extras?.following.length ?? 0 }}
              onPerson={onPerson}
            />
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

// Their picture, or their initials. On your own core, tap it to choose one.
function Avatar({
  url,
  name,
  onPick,
}: {
  url: string | null;
  name: string;
  onPick?: (file: File) => Promise<string | { error: string }>;
}) {
  const [shown, setShown] = useState(url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  if (url && url !== shown && !busy) setShown(url);
  const face = (
    <span
      className="relative flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full text-[28px] font-semibold"
      style={{
        background: shown ? `center / cover no-repeat url("${shown}")` : "linear-gradient(135deg, #FFE1D6, #F6A9A0)",
        color: "#8A2A22",
        boxShadow: "0 0 0 3px rgba(255,255,255,0.85), 0 0 34px 6px rgba(255,255,255,0.28)",
      }}
    >
      {!shown && initials(name)}
      {busy && <span className="absolute inset-0 animate-pulse bg-white/40" />}
    </span>
  );
  if (!onPick) return face;
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label={shown ? "Change your picture" : "Add a picture"}
        className="relative"
        disabled={busy}
      >
        {face}
        <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
          <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setError(null);
          const r = await onPick(file);
          setBusy(false);
          if (typeof r === "string") setShown(r);
          else setError(r.error);
        }}
      />
      {error && <p className="text-xs text-red-300">{error}</p>}
    </>
  );
}

// The longest run of days in a row with a song.
function bestStreak(days: string[]) {
  const set = new Set(days);
  let best = 0;
  for (const d of set) {
    if (set.has(addDays(d, -1))) continue; // not the start of a run
    let n = 0,
      c = d;
    while (set.has(c)) {
      n++;
      c = addDays(c, 1);
    }
    best = Math.max(best, n);
  }
  return best;
}
