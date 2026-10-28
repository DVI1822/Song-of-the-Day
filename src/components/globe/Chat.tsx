"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type Ref } from "react";
import { formatTime, initials } from "@/lib/day";
import type { AddedMe, Friend, Message, Profile } from "@/lib/types";
import type { GlobeApi } from "./api";
import { BackIcon, CloseIcon, glass } from "./ui";

// The globe chat: a tab on the right edge that pulls out a live chat with
// your mutual friends: people you've added who have added you back. Only they
// see what you say, and you see only what they say. Messages to one person
// start from their core (mutual friends only) and live here too, under Messages.
// The globe chat starts fresh every midnight, like the songs; messages to one
// person stay.

type View = { kind: "globe" } | { kind: "inbox" } | { kind: "dm"; with: Profile };

// When you last read the globe chat, kept on this device.
const SEEN_KEY = "sotd-chat-seen";
const seenStore = (() => {
  const subs = new Set<() => void>();
  const read = () => {
    try {
      return localStorage.getItem(SEEN_KEY) ?? "";
    } catch {
      return "";
    }
  };
  return {
    get: read,
    set(v: string) {
      try {
        localStorage.setItem(SEEN_KEY, v);
      } catch {}
      subs.forEach((f) => f());
    },
    sub(f: () => void) {
      subs.add(f);
      return () => void subs.delete(f);
    },
  };
})();

export function Chat({
  api,
  me,
  friends,
  addedMe,
  dark,
  open,
  onOpen,
  onClose,
  dmWith,
  onCore,
  tabTop,
  top,
  width,
  height,
  tabRef,
}: {
  api: GlobeApi;
  me: Profile;
  friends: Friend[];
  addedMe: AddedMe[];
  dark: boolean;
  open: boolean;
  onOpen(): void;
  onClose(): void;
  // set from someone's core: open straight to a conversation with them
  dmWith: { p: Profile; n: number } | null;
  onCore(p: Profile): void;
  tabTop: number;
  top: number;
  width: number;
  height: number;
  tabRef: Ref<HTMLButtonElement>;
}) {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [extra, setExtra] = useState<Profile[]>([]);
  const [view, setView] = useState<View>({ kind: "globe" });
  const seen = useSyncExternalStore(seenStore.sub, seenStore.get, () => "");

  const people = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of [...extra, ...addedMe, ...friends, me]) m.set(p.id, p);
    return m;
  }, [extra, addedMe, friends, me]);

  // everything once, then live
  useEffect(() => {
    let on = true;
    api.chat.load().then((list) => {
      if (!on) return;
      setMsgs((cur) => merge(list, cur));
      setLoaded(true);
    });
    const stop = api.chat.listen({
      add: (m) => setMsgs((cur) => merge(cur, [m])),
      gone: (id) => setMsgs((cur) => cur.filter((m) => m.id !== id)),
    });
    return () => {
      on = false;
      stop();
    };
  }, [api]);

  // look up anyone who wrote but isn't on either list (rare: an old message
  // from someone you've since removed)
  const missing = useMemo(
    () => [...new Set(msgs.flatMap((m) => [m.user_id, m.to_id ?? m.user_id]))].filter((id) => !people.has(id)),
    [msgs, people],
  );
  useEffect(() => {
    if (!missing.length) return;
    let on = true;
    api.chat.people(missing).then((ps) => on && ps.length && setExtra((e) => [...e, ...ps]));
    return () => {
      on = false;
    };
  }, [missing, api]);

  // a Message tap on someone's core
  const [lastDm, setLastDm] = useState(dmWith);
  if (dmWith !== lastDm) {
    setLastDm(dmWith);
    if (dmWith) setView({ kind: "dm", with: dmWith.p });
  }

  const since = useMidnight();
  const globe = useMemo(() => msgs.filter((m) => m.to_id === null && Date.parse(m.created_at) >= since), [msgs, since]);
  const globeNew = globe.filter((m) => m.user_id !== me.id && m.created_at > seen).length;
  const dmNew = msgs.filter((m) => m.to_id === me.id && !m.read_at).length;
  const count = globeNew + dmNew;

  // reading marks things read
  const dmId = view.kind === "dm" ? view.with.id : null;
  const lastGlobe = globe[globe.length - 1]?.created_at ?? "";
  useEffect(() => {
    if (!open) return;
    if (view.kind === "globe" && lastGlobe > seenStore.get()) seenStore.set(lastGlobe);
  }, [open, view.kind, lastGlobe]);
  const unreadFromDm = msgs.some((m) => m.to_id === me.id && m.user_id === dmId && !m.read_at);
  useEffect(() => {
    if (!open || !dmId || !unreadFromDm) return;
    const at = new Date().toISOString();
    api.chat
      .markRead(dmId)
      .then(() => setMsgs((cur) => cur.map((m) => (m.to_id === me.id && m.user_id === dmId && !m.read_at ? { ...m, read_at: at } : m))));
  }, [open, dmId, unreadFromDm, me.id, api]);

  const send = async (body: string) => {
    const res = await api.chat.send(body, dmId);
    if (res.message) setMsgs((cur) => merge(cur, [res.message!]));
    return res.error ?? null;
  };
  const remove = async (m: Message) => {
    const res = await api.chat.remove(m.id);
    if (!res.error) setMsgs((cur) => cur.filter((x) => x.id !== m.id));
    return res.error ?? null;
  };
  const report = async (m: Message) => {
    const res = await api.report({ reportedId: m.user_id, reason: "offensive", note: `Chat: ${m.body}` });
    return res.error ?? null;
  };

  const shown = view.kind === "dm" ? msgs.filter((m) => m.to_id !== null && pair(m, me.id) === dmId) : globe;

  return (
    <>
      <button
        ref={tabRef}
        type="button"
        onClick={open ? onClose : onOpen}
        aria-label="Globe chat"
        aria-expanded={open}
        className="absolute right-0 z-[430] box-border flex h-[124px] w-[38px] flex-col items-center justify-center gap-2 rounded-l-[18px] !border-r-0 transition-shadow"
        style={{
          top: tabTop,
          ...glass(dark),
          ...(open ? { background: "#FFFFFF", boxShadow: "inset -3px 0 0 #D7262B, 0 8px 30px -14px rgba(13,42,63,0.3)" } : {}),
        }}
      >
        <ChatIcon />
        {count > 0 && (
          <span
            aria-label={`${count} new`}
            className="absolute left-[3px] top-[6px] flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold leading-none text-white"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
        <span className="whitespace-nowrap text-[11px] font-semibold tracking-[0.06em] [writing-mode:vertical-rl]">Globe chat</span>
      </button>

      <div
        role="dialog"
        aria-label="Globe chat"
        inert={!open}
        className="absolute right-[46px] z-[425] box-border flex flex-col overflow-hidden rounded-[26px] transition-[opacity,transform] duration-[260ms] ease-out"
        style={{
          top,
          width,
          height,
          ...glass(dark),
          boxShadow: "-18px 0 50px -28px rgba(0,0,0,0.7)",
          opacity: open ? 1 : 0,
          transform: `translateX(${open ? 0 : 60}px)`,
          pointerEvents: open ? undefined : "none",
        }}
      >
        {view.kind === "dm" ? (
          <div className="flex items-center gap-1 py-1.5 pl-1.5 pr-1.5 pt-3">
            <button
              type="button"
              onClick={() => setView({ kind: "inbox" })}
              aria-label="Back to messages"
              className="flex h-11 w-11 flex-none items-center justify-center"
            >
              <BackIcon />
            </button>
            <button
              type="button"
              onClick={() => onCore(view.with)}
              aria-label={`Open ${view.with.display_name}'s core`}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <Avatar name={view.with.display_name} />
              <span className="display truncate text-lg">{view.with.display_name}</span>
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 flex-none items-center justify-center">
              <CloseIcon />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-2 pl-[18px] pr-1.5 pt-3">
            <div className="flex items-center">
              <h2 className="display text-lg">{view.kind === "globe" ? "Globe chat" : "Messages"}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="ml-auto flex h-11 w-11 items-center justify-center">
                <CloseIcon />
              </button>
            </div>
            <div className="mr-3 flex rounded-full bg-card-ink/[0.06] p-[3px] text-xs font-semibold">
              {(
                [
                  ["globe", "Globe", globeNew],
                  ["inbox", "Messages", dmNew],
                ] as const
              ).map(([kind, label, n]) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setView({ kind })}
                  aria-pressed={view.kind === kind}
                  className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full transition-colors ${
                    view.kind === kind ? "bg-white shadow-[0_2px_8px_-3px_rgba(13,42,63,0.3)]" : "text-muted"
                  }`}
                >
                  {label}
                  {n > 0 && view.kind !== kind && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] text-white">{n}</span>
                  )}
                </button>
              ))}
            </div>
            {view.kind === "globe" && (
              <div className="pr-3 text-[11px] leading-snug text-muted">
                You see the people on your globe. They see you if you&apos;re on theirs.
              </div>
            )}
          </div>
        )}

        {view.kind === "inbox" ? (
          <Inbox msgs={msgs} me={me} people={people} onOpen={(p) => setView({ kind: "dm", with: p })} />
        ) : (
          <>
            <Thread
              key={view.kind === "dm" ? view.with.id : "globe"}
              msgs={shown}
              me={me}
              people={people}
              group={view.kind === "globe"}
              loaded={loaded}
              empty={
                view.kind === "globe"
                  ? "Say hi to your globe. Only people you've added who added you back will see it, and it starts fresh at midnight."
                  : `Start a conversation with ${view.with.display_name.split(" ")[0]}.`
              }
              onCore={onCore}
              onDelete={remove}
              onReport={report}
            />
            <Composer
              key={`say-${view.kind === "dm" ? view.with.id : "globe"}`}
              placeholder={view.kind === "globe" ? "Talk to your globe" : `Message ${view.with.display_name.split(" ")[0]}`}
              onSend={send}
            />
          </>
        )}
      </div>
    </>
  );
}

// Newest wins on a repeat, and the list stays in time order.
function merge(a: Message[], b: Message[]) {
  const byId = new Map<string, Message>();
  for (const m of [...a, ...b]) byId.set(m.id, m);
  return [...byId.values()].sort((x, y) => x.created_at.localeCompare(y.created_at));
}

// Who the other person in a direct message is.
const pair = (m: Message, meId: string) => (m.user_id === meId ? m.to_id : m.user_id);

function Thread({
  msgs,
  me,
  people,
  group,
  loaded,
  empty,
  onCore,
  onDelete,
  onReport,
}: {
  msgs: Message[];
  me: Profile;
  people: Map<string, Profile>;
  group: boolean;
  loaded: boolean;
  empty: string;
  onCore(p: Profile): void;
  onDelete(m: Message): Promise<string | null>;
  onReport(m: Message): Promise<string | null>;
}) {
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const tz = me.timezone;

  // stay at the bottom as new ones come in, unless you've scrolled up to read
  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight });
  }, [msgs.length]);

  const act = useCallback(async (m: Message, own: boolean) => {
    const err = await (own ? onDelete(m) : onReport(m));
    setDone((d) => ({ ...d, [m.id]: err ?? (own ? "" : "Reported") }));
  }, [onDelete, onReport]);

  return (
    <div
      ref={list}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
      className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto border-t border-card-ink/[0.07] px-3.5 py-3"
    >
      {!loaded && <div className="py-2 text-sm text-muted">Loading…</div>}
      {loaded && !msgs.length && <div className="px-1 py-3 text-sm leading-snug text-muted">{empty}</div>}
      {msgs.map((m, i) => {
        const own = m.user_id === me.id;
        const who = people.get(m.user_id);
        const prev = msgs[i - 1];
        const first = !prev || prev.user_id !== m.user_id || Date.parse(m.created_at) - Date.parse(prev.created_at) > 10 * 60e3;
        return (
          <div key={m.id} className={`flex flex-col ${own ? "items-end" : "items-start"} ${first && i ? "mt-2.5" : ""}`}>
            {first && group && !own && (
              <button
                type="button"
                onClick={() => who && onCore(who)}
                className="mb-1 flex items-center gap-1.5 pl-0.5 text-[11px] font-semibold text-muted"
              >
                <Avatar name={who?.display_name ?? "?"} small />
                {who?.display_name.split(" ")[0] ?? "Someone"}
                <span className="font-normal">· {formatTime(m.created_at, tz)}</span>
              </button>
            )}
            {first && (own || !group) && (
              <div className="mb-1 px-1 text-[10px] text-muted">{formatTime(m.created_at, tz)}</div>
            )}
            <button
              type="button"
              onClick={() => setPicked((p) => (p === m.id ? null : m.id))}
              className={`max-w-[86%] whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 text-left text-sm leading-snug ${
                own ? "rounded-br-[6px] bg-accent text-white" : "rounded-bl-[6px] bg-card-ink/[0.06]"
              } ${group && !own ? "ml-[26px]" : ""}`}
            >
              {m.body}
            </button>
            {picked === m.id && (
              <div className={`flex gap-3 px-1 pt-1 text-[11px] font-semibold text-muted ${group && !own ? "ml-[26px]" : ""}`}>
                {m.id in done ? (
                  <span>{done[m.id]}</span>
                ) : (
                  <button type="button" onClick={() => act(m, own)} className="underline-offset-2 hover:underline">
                    {own ? "Delete" : "Report"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Composer({ placeholder, onSend }: { placeholder: string; onSend(body: string): Promise<string | null> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const err = await onSend(text);
    setBusy(false);
    if (err) setError(err);
    else setText("");
  };
  return (
    <div className="border-t border-card-ink/[0.07]">
      {error && <p className="px-4 pt-2 text-xs text-accent-deep">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 px-3 py-2.5"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-11 min-w-0 flex-1 rounded-full bg-card-ink/[0.05] px-4 text-base outline-none placeholder:text-muted/80"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label="Send"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-accent text-white disabled:opacity-40"
        >
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
}

// Everyone you've messaged with, latest first.
function Inbox({
  msgs,
  me,
  people,
  onOpen,
}: {
  msgs: Message[];
  me: Profile;
  people: Map<string, Profile>;
  onOpen(p: Profile): void;
}) {
  const rows = useMemo(() => {
    const last = new Map<string, { m: Message; unread: number }>();
    for (const m of msgs) {
      if (m.to_id === null) continue;
      const other = pair(m, me.id)!;
      const row = last.get(other) ?? { m, unread: 0 };
      row.m = m;
      if (m.to_id === me.id && !m.read_at) row.unread++;
      last.set(other, row);
    }
    return [...last.entries()].sort((a, b) => b[1].m.created_at.localeCompare(a[1].m.created_at));
  }, [msgs, me.id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-card-ink/[0.07] py-1.5">
      {!rows.length && (
        <div className="px-[18px] py-3 text-sm leading-snug text-muted">
          No messages yet. To message someone, open their core and tap Message.
        </div>
      )}
      {rows.map(([id, { m, unread }]) => {
        const p = people.get(id);
        if (!p) return null;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onOpen(p)}
            className="flex items-center gap-3 px-[18px] py-2.5 text-left hover:bg-card-ink/[0.04]"
          >
            <Avatar name={p.display_name} />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-baseline gap-2">
                <span className={`truncate text-sm ${unread ? "font-bold" : "font-semibold"}`}>{p.display_name}</span>
                <span className="ml-auto flex-none text-[10px] text-muted">{formatTime(m.created_at, me.timezone)}</span>
              </div>
              <div className={`truncate text-xs ${unread ? "text-card-ink" : "text-muted"}`}>
                {m.user_id === me.id ? "You: " : ""}
                {m.body}
              </div>
            </div>
            {unread > 0 && (
              <span className="flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const Avatar = ({ name, small = false }: { name: string; small?: boolean }) => (
  <span
    className={`flex flex-none items-center justify-center rounded-full font-semibold ${small ? "h-5 w-5 text-[8px]" : "h-[34px] w-[34px] text-[11px]"}`}
    style={{ background: "linear-gradient(135deg, #FFE1D6, #F6A9A0)", color: "#8A2A22" }}
  >
    {initials(name)}
  </span>
);

export const ChatIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    aria-hidden
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12a8 8 0 01-11.6 7.1L4 20.5l1.5-4.8A8 8 0 1121 12z" />
    <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeWidth="2.6" />
  </svg>
);

// The start of today on this device, moving on when midnight passes.
function useMidnight() {
  const start = () => new Date().setHours(0, 0, 0, 0);
  const [at, setAt] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setAt(start()), 30_000);
    return () => clearInterval(id);
  }, []);
  return at;
}
