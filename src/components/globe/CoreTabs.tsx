"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addDays, formatDay, monthKey, monthName } from "@/lib/day";
import type { CoreExtras, Post, Profile, SavedSong, Taste } from "@/lib/types";
import { SongPlayer, usePreview } from "./Preview";
import { Cover, Face } from "./ui";

// The three tabs of a core (CoreView): Taste, Songs and People. Drawn like
// the rest of the ink look: paper, a wobbly ink edge, coral, gold and green.

const INK = "#1D2433";
const CORAL = "#FF5E57";
const GOLD = "#F2B632";
const GREEN = "#7CC58F";
const SEA = "#4D86B8";
const PLUM = "#A774C9";
const WASH = "#F4EFE2";
const SLICE = [CORAL, GOLD, GREEN, SEA, PLUM, "#E8E4DA"];

const card = "rounded-[20px] border-2 border-[#1D2433] bg-[#FFFDF6] p-3.5 shadow-[3px_4px_0_rgba(29,36,51,0.16)]";
const hand = "display text-[22px] leading-none";

// --- the shelf of numbers above the tabs ---------------------------------------------

export function Shelf({ items }: { items: { n: string; label: string; icon?: "flame" | "crown" }[] }) {
  return (
    <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" aria-label="Stats">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex flex-none items-center gap-1.5 rounded-[14px] border-2 border-[#1D2433] bg-[#FFFDF6] px-2.5 py-1.5 text-xs shadow-[2px_2px_0_rgba(29,36,51,0.15)]"
        >
          {it.icon === "flame" && <Flame size={13} />}
          {it.icon === "crown" && <Crown size={15} />}
          <b className="display text-[19px] leading-[0.8]">{it.n}</b>
          {it.label}
        </div>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, on, set }: { tabs: [T, string][]; on: T; set(t: T): void }) {
  return (
    <div role="tablist" className="flex gap-1 rounded-[16px] p-1" style={{ background: WASH }}>
      {tabs.map(([k, label]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={on === k}
          onClick={() => set(k)}
          className="flex-1 rounded-[12px] py-2 text-[13px] font-semibold transition-colors"
          style={
            on === k
              ? { background: "#FFFDF6", color: INK, boxShadow: `0 0 0 2px ${INK}, 2px 2px 0 rgba(29,36,51,0.18)` }
              : { color: "#6A7380" }
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// --- a section that folds shut, and stays how you left it ------------------------------

const SHUT = "tt-core-shut";
function shutSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SHUT) ?? "[]"));
  } catch {
    return new Set();
  }
}

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  // the core only opens in the browser, so this is read right away
  const [open, setOpen] = useState(() => !shutSet().has(id));
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      const s = shutSet();
      if (next) s.delete(id);
      else s.add(id);
      localStorage.setItem(SHUT, JSON.stringify([...s]));
    } catch {}
  };
  return (
    <div className={card}>
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-2 text-left">
        <span className={hand}>{title}</span>
        {note && <span className="ml-auto text-[11px] text-muted">{note}</span>}
        <span
          aria-hidden
          className={`${note ? "" : "ml-auto"} mr-0.5 h-[9px] w-[9px] border-b-[2.5px] border-r-[2.5px] border-[#1D2433] transition-transform duration-300`}
          style={{ transform: open ? "translateY(2px) rotate(-135deg)" : "translateY(-2px) rotate(45deg)" }}
        />
      </button>
      {open && <div className="rise-in pt-3">{children}</div>}
    </div>
  );
}

// --- Taste ------------------------------------------------------------------------------

export function TastePane({ taste, failed, first }: { taste: Taste | null; failed: boolean; first: string }) {
  if (!taste)
    return (
      <div className={`${card} text-sm text-muted`}>
        {failed ? "Couldn't load this taste right now." : "Listening back through the picks…"}
      </div>
    );
  if (taste.picks < 3)
    return (
      <div className={`${card} flex flex-col gap-1.5`}>
        <div className={hand}>Taste Overview</div>
        <p className="text-sm leading-relaxed text-muted">
          It fills in after three songs. {taste.picks ? `${3 - taste.picks} more to go.` : `${first} hasn't picked one yet.`}
        </p>
      </div>
    );
  const o = taste.overview;
  const genres = topWithOther(taste.genres, 5);
  const tagged = taste.genres.reduce((a, g) => a + g.n, 0);
  return (
    <div className="flex flex-col gap-3.5">
      <Section id="overview" title="Taste Overview" note={`from ${taste.picks} picks`}>
        {o ? (
          <div className="flex flex-col gap-2">
            <div className="display text-[28px] leading-[0.95]">{o.name}</div>
            <p className="text-[13.5px] leading-relaxed">{o.blurb}</p>
            {o.words.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {o.words.map((w, i) => (
                  <span
                    key={w}
                    className="rounded-[12px] border-[1.5px] border-[#1D2433] px-2.5 py-0.5 text-xs"
                    style={{ background: ["#FFE1D6", "#DFF2E4", "#FFF0C7", "transparent", "transparent"][i] }}
                  >
                    {w}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">{taste.pending ? "Still listening back through the picks…" : "Writing it up…"}</p>
        )}
      </Section>

      {genres.length > 0 && (
        <Section id="genres" title="What you spin" note="by genre">
          <div className="flex items-center gap-3">
            <Record slices={genres.map((g, i) => ({ n: g.n, color: SLICE[i] }))} />
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
              {genres.map((g, i) => (
                <div key={g.name} className="flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: SLICE[i], boxShadow: `0 0 0 1.2px ${INK}` }} />
                  <span className="min-w-0 flex-1 truncate">{g.name}</span>
                  <span className="tabular-nums text-muted">{Math.round((g.n / tagged) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {taste.decades.length > 0 && (
        <Section id="decades" title="When it's from" note="release year">
          <Decades list={taste.decades} />
        </Section>
      )}

      {taste.artists.length > 0 && (
        <Section id="artists" title="Most picked" note="artists">
          <div className="flex flex-col gap-2">
            {taste.artists.map((a, i) => (
              <div key={a.name} className="flex items-center gap-2.5">
                <span className="display w-4 text-center text-[20px]">{i + 1}</span>
                <Cover src={a.artwork} seed={a.name} size={36} className="!rounded-full" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{a.name}</span>
                <span className="text-[11px] text-muted">
                  {a.n} {a.n === 1 ? "pick" : "picks"}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {o?.month && (
        <Section id="month" title="This month">
          <p className="text-[13.5px] leading-relaxed">{o.month}</p>
        </Section>
      )}
    </div>
  );
}

function topWithOther(list: { name: string; n: number }[], k: number) {
  if (list.length <= k + 1) return list;
  const rest = list.slice(k).reduce((a, g) => a + g.n, 0);
  return [...list.slice(0, k), { name: "Other", n: rest }];
}

// The genres as a record: one slice each, grooves over the top, turning slowly.
function Record({ slices }: { slices: { n: number; color: string }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current,
      g = cv?.getContext("2d");
    if (!cv || !g) return;
    const total = slices.reduce((a, s) => a + s.n, 0) || 1;
    let raf = 0;
    const draw = (now: number) => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, 240, 240);
      g.translate(120, 120);
      g.rotate(now * 0.0006);
      let a = -Math.PI / 2;
      g.lineJoin = "round";
      for (const s of slices) {
        const b = a + (s.n / total) * Math.PI * 2;
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, 112, a, b);
        g.closePath();
        g.fillStyle = s.color;
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.stroke();
        a = b;
      }
      for (let r = 40; r < 108; r += 9) {
        g.beginPath();
        g.arc(0, 0, r, 0, Math.PI * 2);
        g.strokeStyle = "rgba(29,36,51,0.22)";
        g.lineWidth = 1.5;
        g.stroke();
      }
      g.beginPath();
      g.arc(0, 0, 30, 0, Math.PI * 2);
      g.fillStyle = "#FFFDF6";
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = INK;
      g.stroke();
      g.beginPath();
      g.arc(0, 0, 5, 0, Math.PI * 2);
      g.fillStyle = INK;
      g.fill();
      g.beginPath();
      g.arc(0, 0, 112, 0, Math.PI * 2);
      g.lineWidth = 4;
      g.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [slices]);
  return <canvas ref={ref} width={240} height={240} aria-hidden className="h-[112px] w-[112px] flex-none" />;
}

function Decades({ list }: { list: { decade: number; n: number }[] }) {
  // every decade from the oldest to now, so gaps show
  const from = list[0].decade,
    to = Math.max(list[list.length - 1].decade, 2020);
  const all = [];
  for (let d = Math.max(from, to - 90); d <= to; d += 10) all.push({ decade: d, n: list.find((x) => x.decade === d)?.n ?? 0 });
  const max = Math.max(...all.map((x) => x.n), 1);
  return (
    <div>
      <div className="flex h-[78px] items-end gap-1.5">
        {all.map((x) => (
          <div key={x.decade} className="flex flex-1 flex-col items-center gap-0.5 text-[10.5px] text-muted">
            <span className="tabular-nums">{x.n || ""}</span>
            <span
              className="block w-full rounded-t-[6px] border-2 border-b-0 border-[#1D2433]"
              style={{ height: Math.max(x.n ? 6 : 0, Math.round((x.n / max) * 50)), background: x.n === max ? CORAL : WASH, borderWidth: x.n ? undefined : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="h-[2px] rounded bg-[#1D2433]" />
      <div className="flex gap-1.5 pt-1">
        {all.map((x) => (
          <span key={x.decade} className="flex-1 text-center text-[10.5px] text-muted">
            {String(x.decade).slice(2)}s
          </span>
        ))}
      </div>
    </div>
  );
}

// --- Songs ------------------------------------------------------------------------------

type List = { key: string; name: string; songs: Post[]; disc: string };

export function SongsPane({
  posts,
  today,
  picks,
  feels,
  saved,
  first,
  mine,
  onToday,
}: {
  posts: Post[];
  today: string;
  picks: Record<string, number>;
  feels: Record<string, number>;
  saved?: SavedSong[] | null;
  first: string;
  mine: boolean;
  onToday?: () => void; // their song today, opened where it sits on the Globe
}) {
  const months = useMemo(() => [...new Set(posts.map((p) => monthKey(p.day)))], [posts]);
  const [month, setMonth] = useState(monthKey(today));
  const [view, setView] = useState<"cal" | "list">("cal");
  const [open, setOpen] = useState<string | null>(null);
  const [list, setList] = useState<string | null>(null);
  const byDay = useMemo(() => new Map(posts.map((p) => [p.day, p])), [posts]);
  const firstDay = posts.length ? posts[posts.length - 1].day : today;
  const thisYear = today.slice(0, 4);
  // the months to step through: from the first song to now
  const span = useMemo(() => {
    const out: string[] = [];
    let k = monthKey(today);
    const end = monthKey(firstDay);
    while (k >= end && out.length < 240) {
      out.push(k);
      k = monthKey(addDays(k + "-01", -1));
    }
    return out;
  }, [today, firstDay]);
  const at = Math.max(0, span.indexOf(month));
  const inMonth = posts.filter((p) => monthKey(p.day) === month);

  const lists: List[] = useMemo(() => {
    const out: List[] = [];
    const crowned = posts.filter((p) => picks[p.id]);
    if (crowned.length) out.push({ key: "crowned", name: "Crowned", songs: crowned, disc: GOLD });
    const felt = posts.filter((p) => (feels[p.id] ?? 0) > 0).sort((a, b) => (feels[b.id] ?? 0) - (feels[a.id] ?? 0)).slice(0, 25);
    if (felt.length >= 2) out.push({ key: "felt", name: "Most felt", songs: felt, disc: CORAL });
    if (mine && saved?.length) out.push({ key: "saved", name: "Saved from friends", songs: saved, disc: GREEN });
    const fri = posts.filter((p) => new Date(p.day + "T12:00:00Z").getUTCDay() === 5);
    if (fri.length >= 2) out.push({ key: "friday", name: "Friday picks", songs: fri, disc: PLUM });
    for (const k of months)
      out.push({ key: k, name: monthName(k, k.slice(0, 4) !== thisYear), songs: posts.filter((p) => monthKey(p.day) === k), disc: SEA });
    return out;
  }, [posts, picks, feels, saved, mine, months, thisYear]);
  const chosen = lists.find((l) => l.key === list) ?? null;
  const todayPost = byDay.get(today) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {todayPost && (
        <SongRow p={todayPost} label="Today" open={open} setOpen={setOpen} picks={picks} feels={feels} boxed onTap={onToday} />
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Month before"
          disabled={at >= span.length - 1}
          onClick={() => setMonth(span[at + 1])}
          className="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-25"
        >
          <Chevron dir="left" />
        </button>
        <div className={`${hand} min-w-0 flex-1 text-center`}>{monthName(month, month.slice(0, 4) !== thisYear)}</div>
        <button
          type="button"
          aria-label="Month after"
          disabled={at <= 0}
          onClick={() => setMonth(span[at - 1])}
          className="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-25"
        >
          <Chevron dir="right" />
        </button>
        <div className="flex gap-1 rounded-[13px] p-[3px]" style={{ background: WASH }} role="group" aria-label="View">
          {(["cal", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className="rounded-[10px] px-2.5 py-1 text-xs font-semibold"
              style={view === v ? { background: "#FFFDF6", color: INK, boxShadow: `0 0 0 1.5px ${INK}` } : { color: "#6A7380" }}
            >
              {v === "cal" ? "Calendar" : "List"}
            </button>
          ))}
        </div>
      </div>

      {view === "cal" ? (
        <Calendar
          month={month}
          today={today}
          firstDay={firstDay}
          byDay={byDay}
          picks={picks}
          open={open}
          onDay={(p) => setOpen(open === p.id ? null : p.id)}
        />
      ) : inMonth.length ? (
        <div className="flex flex-col">
          {inMonth.map((p, j) => (
            <div key={p.id} className={j ? "border-t border-card-ink/[0.08]" : ""}>
              <SongRow p={p} label={formatDay(p.day)} open={open} setOpen={setOpen} picks={picks} feels={feels} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No songs this month.</p>
      )}
      {view === "cal" && open && inMonth.some((p) => p.id === open) && (
        <SongRow p={inMonth.find((p) => p.id === open)!} label={formatDay(inMonth.find((p) => p.id === open)!.day)} open={open} setOpen={setOpen} picks={picks} feels={feels} boxed />
      )}

      {lists.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className={hand}>Playlists</div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
            {lists.map((l) => (
              <Sleeve key={l.key} l={l} on={list === l.key} onClick={() => setList(list === l.key ? null : l.key)} />
            ))}
          </div>
          {chosen && <Playlist l={chosen} first={first} mine={mine} open={open} setOpen={setOpen} picks={picks} feels={feels} />}
        </div>
      )}
    </div>
  );
}

function Calendar({
  month,
  today,
  firstDay,
  byDay,
  picks,
  open,
  onDay,
}: {
  month: string;
  today: string;
  firstDay: string;
  byDay: Map<string, Post>;
  picks: Record<string, number>;
  open: string | null;
  onDay(p: Post): void;
}) {
  const start = new Date(month + "-01T12:00:00Z");
  const lead = start.getUTCDay();
  const days = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: ReactNode[] = [];
  for (let i = 0; i < lead; i++) cells.push(<span key={`l${i}`} />);
  for (let d = 1; d <= days; d++) {
    const day = `${month}-${String(d).padStart(2, "0")}`;
    const p = byDay.get(day);
    if (p) {
      const won = picks[p.id] ?? 0;
      cells.push(
        <button
          key={day}
          type="button"
          onClick={() => onDay(p)}
          aria-label={`${formatDay(day)}: ${p.title} by ${p.artist}${won ? `, crowned ${won}×` : ""}`}
          className="relative aspect-square w-full"
        >
          <Cover
            src={p.artwork_url}
            seed={p.title}
            size={44}
            className="!h-full !w-full"
            style={{ borderRadius: 8, boxShadow: open === p.id ? `0 0 0 2.5px ${CORAL}` : `0 0 0 1.5px ${INK}` }}
          />
          {won > 0 && (
            <span className="absolute -right-1 -top-2">
              <Crown size={14} />
            </span>
          )}
        </button>,
      );
    } else if (day > today || day < firstDay) {
      cells.push(
        <span key={day} aria-hidden className="flex aspect-square items-center justify-center">
          <i className="h-1 w-1 rounded-full bg-[#1D2433]/20" />
        </span>,
      );
    } else {
      cells.push(<span key={day} aria-label={`${formatDay(day)}: no song`} className="aspect-square rounded-[8px] border-[1.5px] border-dashed border-[#1D2433]/30" />);
    }
  }
  return (
    <div className="grid grid-cols-7 gap-[5px]">
      {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
        <span key={i} className="text-center text-[10px] text-muted">
          {d}
        </span>
      ))}
      {cells}
    </div>
  );
}

function SongRow({
  p,
  label,
  open,
  setOpen,
  picks,
  feels,
  boxed = false,
  by,
  onTap,
}: {
  p: Post;
  label: string;
  open: string | null;
  setOpen(id: string | null): void;
  picks: Record<string, number>;
  feels: Record<string, number>;
  boxed?: boolean;
  by?: string;
  onTap?: () => void; // instead of opening here
}) {
  const on = open === p.id;
  const won = picks[p.id] ?? 0,
    felt = feels[p.id] ?? 0;
  return (
    <div className={boxed ? `${card} !p-2.5` : ""}>
      <button
        type="button"
        onClick={onTap ?? (() => setOpen(on ? null : p.id))}
        aria-expanded={onTap ? undefined : on}
        className={`flex w-full items-center gap-3 text-left ${boxed ? "" : "h-[56px]"}`}
      >
        <Cover src={p.artwork_url} seed={p.title} size={boxed ? 52 : 38} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="text-[11px] text-muted">{by ? `${label} · ${by}` : label}</div>
          <div className="truncate text-[13.5px] font-semibold">{p.title}</div>
          <div className="truncate text-[11px] text-muted">{p.artist}</div>
        </div>
        {(won > 0 || felt > 0) && (
          <div className="flex flex-none flex-col items-end gap-0.5 text-[11px] text-muted">
            {won > 0 && (
              <span className="flex items-center gap-1">
                {won}
                <Crown size={12} />
              </span>
            )}
            {felt > 0 && <span>{felt} felt</span>}
          </div>
        )}
      </button>
      {on && !onTap && (
        <div className="rise-in flex flex-col gap-2.5 px-1 pb-1 pt-2.5">
          {p.caption && <div className="text-sm leading-relaxed">“{p.caption}”</div>}
          <SongPlayer post={p} />
        </div>
      )}
    </div>
  );
}

function Sleeve({ l, on, onClick }: { l: List; on: boolean; onClick(): void }) {
  const top = l.songs[0];
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className="flex min-w-0 flex-col gap-1.5 text-left">
      <div className="relative aspect-square w-full">
        {/* the record peeking out of its sleeve */}
        <span
          className="absolute right-[-8%] top-[6%] aspect-square w-[88%] rounded-full transition-transform duration-500"
          style={{
            background: "repeating-radial-gradient(circle, #1D2433 0 2px, #2C3446 2px 4px)",
            boxShadow: `0 0 0 1.5px ${INK}`,
            transform: on ? "translateX(14%) rotate(90deg)" : "none",
          }}
        >
          <span className="absolute inset-[36%] rounded-full" style={{ background: l.disc, boxShadow: `0 0 0 1.5px ${INK}` }} />
        </span>
        <span className="absolute inset-y-0 left-0 right-[8%]">
          <Cover
            src={top?.artwork_url}
            seed={top?.title ?? l.name}
            size={110}
            className="!h-full !w-full"
            style={{ borderRadius: 9, boxShadow: `0 0 0 2px ${on ? CORAL : INK}, 2px 3px 0 rgba(29,36,51,0.2)` }}
          />
        </span>
        <span className="absolute bottom-1.5 left-1.5 rounded-[8px] border-[1.5px] border-[#1D2433] bg-[#FFFDF6] px-1.5 text-[10px] font-semibold">
          {l.songs.length}
        </span>
      </div>
      <span className="text-xs font-semibold leading-tight">{l.name}</span>
    </button>
  );
}

function Playlist({
  l,
  first,
  mine,
  open,
  setOpen,
  picks,
  feels,
}: {
  l: List;
  first: string;
  mine: boolean;
  open: string | null;
  setOpen(id: string | null): void;
  picks: Record<string, number>;
  feels: Record<string, number>;
}) {
  const pv = usePreview();
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className={`${card} rise-in flex flex-col`}>
      <div className="flex items-center gap-2.5 pb-1">
        <div className="min-w-0 flex-1">
          <div className={hand}>{l.name}</div>
          <div className="text-[11px] text-muted">
            {l.songs.length} {l.songs.length === 1 ? "song" : "songs"}
            {l.key === "saved" ? "" : mine ? "" : ` · ${first}'s picks`}
          </div>
        </div>
        <button
          type="button"
          onClick={async () => setNote(await pv.startShuffle(l.songs, true))}
          aria-label={`Play ${l.name}`}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full border-2 border-[#1D2433] shadow-[2px_3px_0_#1D2433]"
          style={{ background: CORAL }}
        >
          <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden>
            <path d="M2 1.5v13L13 8z" fill={INK} />
          </svg>
        </button>
      </div>
      {note && <p className="pb-1 text-[11px] text-muted">{note}</p>}
      {l.songs.slice(0, 60).map((p, j) => (
        <div key={p.id} className={j ? "border-t border-card-ink/[0.08]" : ""}>
          <SongRow
            p={p}
            label={formatDay(p.day)}
            by={"by" in p ? `${(p as SavedSong).by.display_name.split(" ")[0]}'s song` : undefined}
            open={open}
            setOpen={setOpen}
            picks={picks}
            feels={feels}
          />
        </div>
      ))}
    </div>
  );
}

// --- People -----------------------------------------------------------------------------

type Who = "friends" | "following" | "followers" | "globes";

export function PeoplePane({
  extras,
  mine,
  first,
  globe,
  onPerson,
}: {
  extras: CoreExtras | null;
  mine: boolean;
  first: string;
  globe: { people: number; posted?: number };
  onPerson?: (p: Profile) => void;
}) {
  const [who, setWho] = useState<Who>("friends");
  const ers = extras?.followers ?? [],
    ing = extras?.following ?? [];
  const back = new Set(ers.map((p) => p.id));
  const friends = ing.filter((p) => back.has(p.id));
  const lists: Record<Exclude<Who, "globes">, Profile[]> = { friends, following: ing, followers: ers };
  const sub: Record<Who, string> = {
    friends: mine ? "You both have each other on your globes" : `${first} and they have each other on their globes`,
    following: mine ? "People on your globe" : `People on ${first}'s globe`,
    followers: mine ? "People who have you on their globe" : `People who have ${first} on their globe`,
    globes: mine ? "Globes you're part of" : `Globes ${first} is part of`,
  };
  const counts: [Who, number | string, string][] = [
    ["friends", extras ? friends.length : "–", "friends"],
    ["following", extras ? ing.length : "–", "following"],
    ["followers", extras ? ers.length : "–", "followers"],
    ["globes", 1, "globes"],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Show">
        {counts.map(([k, n, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={who === k}
            onClick={() => setWho(k)}
            className="rounded-[16px] border-2 border-[#1D2433] px-1 py-2 text-center"
            style={who === k ? { background: WASH, boxShadow: `2px 3px 0 ${INK}` } : { background: "#FFFDF6" }}
          >
            <b className="display block text-[26px] leading-[0.9]">{n}</b>
            <span className="text-[10.5px] text-muted">{label}</span>
          </button>
        ))}
      </div>

      <div>
        <div className={hand}>{{ friends: "Friends", following: "Following", followers: "Followers", globes: "Globes" }[who]}</div>
        <div className="pb-1 pt-1 text-xs text-muted">{sub[who]}</div>
        {who === "globes" ? (
          <div className="flex gap-2.5 overflow-x-auto pb-1 pt-1 [scrollbar-width:none]">
            <div className={`${card} flex w-[140px] flex-none flex-col gap-1.5 !p-2.5`}>
              <MiniGlobe />
              <div className="truncate text-[13px] font-semibold">{mine ? "Your globe" : `${first}'s globe`}</div>
              <div className="text-[11px] text-muted">
                {globe.people} {globe.people === 1 ? "person" : "people"}
                {globe.posted != null ? ` · ${globe.posted} posted today` : ""}
              </div>
            </div>
            <div className="flex w-[140px] flex-none flex-col items-center justify-center gap-1 rounded-[20px] border-2 border-dashed border-[#1D2433]/40 p-2.5 text-center text-[11px] text-muted">
              <span className="display text-[28px] leading-[0.8]">+</span>
              Family globe, local globe…
              <b>coming soon</b>
            </div>
          </div>
        ) : !extras ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : lists[who].length === 0 ? (
          <p className="text-sm text-muted">No one yet.</p>
        ) : (
          <div className="flex flex-col">
            {lists[who].map((p, j) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPerson?.(p)}
                disabled={!onPerson}
                className={`flex items-center gap-2.5 py-2 text-left ${j ? "border-t border-card-ink/[0.08]" : ""}`}
              >
                <Face p={p} size={38} tone={j % 2 ? "sea" : "coral"} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13.5px] font-semibold">{p.display_name}</span>
                  <span className="truncate text-[11px] text-muted">@{p.username}</span>
                </div>
                {onPerson && <Chevron dir="right" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- little drawings ----------------------------------------------------------------

export function Flame({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 14 16" aria-hidden>
      <path d="M7 1c1 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 1-8z" fill={CORAL} stroke={INK} strokeWidth="1.4" />
    </svg>
  );
}

export function Crown({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 16 12" aria-hidden>
      <path d="M1 11V3l4 4 3-6 3 6 4-4v8z" fill={GOLD} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="9" height="14" viewBox="0 0 9 14" aria-hidden className="flex-none">
      <path d={dir === "left" ? "M7 1 1.5 7 7 13" : "M2 1l5.5 6L2 13"} fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MiniGlobe() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r="15" fill="#D9E8FF" stroke={INK} strokeWidth="1.8" />
      <ellipse cx="18" cy="18" rx="7" ry="15" fill="none" stroke={INK} strokeWidth="1.6" />
      <path d="M3 18h30" stroke={INK} strokeWidth="1.6" />
    </svg>
  );
}
