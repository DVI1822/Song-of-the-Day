"use client";

import { useState, type ReactNode } from "react";
import { ChatIcon } from "./Chat";
import { OpenIcon } from "./Preview";
import { CoreIcon, LevelsIcon, NoteIcon } from "./Reactions";
import { MoreIcon } from "./Safety";
import { ShareIcon } from "./ShareStory";
import { ShuffleIcon } from "./Shuffle";
import { SignalCore } from "./SignalCore";
import { CompassStar } from "./SongFacts";
import { CloseIcon, glass, RecenterIcon, TabIcon } from "./ui";
import { SCENES } from "./SceneWheel";

// The key: what every button on TopTrack does, drawn with the real icons.
// It opens from the little key at the top left, the twin of the ? at the
// top right (which says what TopTrack is). Four pages, so nothing scrolls far.

type Row = { icon: ReactNode; name: string; text: string };
type Page = { tab: string; title: string; rows: Row[] };

const navy = "#0D2A3F";

// A round glass button, like the Globe's own.
const Round = ({ children, accent }: { children: ReactNode; accent?: boolean }) => (
  <span
    className={`flex h-10 w-10 items-center justify-center rounded-full ${accent ? "bg-accent text-white" : ""}`}
    style={accent ? { boxShadow: "0 0 0 4px rgba(215,38,43,0.12)" } : glass(false)}
  >
    {children}
  </span>
);
// A left (or right) tab, cut short.
const Tab = ({ children, right }: { children: ReactNode; right?: boolean }) => (
  <span
    className={`flex h-11 w-[26px] items-center justify-center ${right ? "rounded-l-[13px] !border-r-0" : "rounded-r-[13px] !border-l-0"}`}
    style={glass(false)}
  >
    {children}
  </span>
);
// The song buttons are big on the card; here they're shown at half size.
const Half = ({ children }: { children: ReactNode }) => (
  <span className="flex h-10 w-10 items-center justify-center text-card-ink">
    <span className="flex scale-50">{children}</span>
  </span>
);
const Plain = ({ children }: { children: ReactNode }) => (
  <span className="flex h-10 w-10 items-center justify-center text-card-ink">{children}</span>
);

const PlusIcon = () => (
  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const PlayIcon = () => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);
const SkyIcon = () => (
  <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="9" cy="9" r="3.4" />
    <path d="M9 2.5v1.6M2.5 9h1.6M4.4 4.4l1.1 1.1M13.6 4.4l-1.1 1.1" />
    <path d="M8 20h9.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.4 1.4A2.8 2.8 0 0 0 8 20z" fill="white" />
  </svg>
);
const CalendarIcon = () => (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <circle cx="12" cy="15.2" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);
const GearIcon = () => (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
  </svg>
);
const PersonIcon = () => (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="9" r="3.6" />
    <path d="M5 20c1.2-3.6 3.8-5.4 7-5.4s5.8 1.8 7 5.4" />
  </svg>
);
const RedoIcon = () => (
  <svg aria-hidden width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 5v5h-5" />
    <path d="M19.5 10A8 8 0 1 0 20 15" />
  </svg>
);
// A tiny cover, mid-flip.
const Tile = ({ flip }: { flip?: boolean }) => (
  <span className="flex h-10 w-10 items-center justify-center" style={{ perspective: 120 }}>
    <span
      className="block h-8 w-8 rounded-[8px]"
      style={{
        background: "linear-gradient(135deg,#ff8a5c 0%,#ff5e57 35%,#6b4cff 100%)",
        boxShadow: "0 6px 14px -6px rgba(13,42,63,0.5)",
        transform: flip ? "rotateY(32deg)" : undefined,
      }}
    />
  </span>
);
// Words that sit on the Globe itself (the song count, the countdown), in its bubble type.
const Words = ({ top, bottom, size }: { top: string; bottom: string; size: number }) => (
  <span className="flex h-10 w-11 flex-col items-center justify-center text-center font-bubble font-semibold leading-[1.05] tabular-nums" style={{ color: navy }}>
    <span style={{ fontSize: size }}>{top}</span>
    <span className="text-[8px] tracking-[0.12em] opacity-60">{bottom}</span>
  </span>
);

const PAGES: Page[] = [
  {
    tab: "Globe",
    title: "On the Globe",
    rows: [
      { icon: <Round accent><PlusIcon /></Round>, name: "Add today's song", text: "Copy a song's link in your music app, tap +, and paste it. Add a comment or photo if you like. They go on the back of the cover." },
      { icon: <Tile />, name: "Songs", text: "Each square is a friend's song today. Tap one to open it. Drag anywhere to spin the globe." },
      { icon: <Round><RecenterIcon /></Round>, name: "Bring songs to the front", text: "Turns every song round to face you for a few seconds." },
      { icon: <Round><CompassStar /></Round>, name: "Your song's facts", text: "Once you post, a few facts about your song land here, each from a real source." },
      { icon: <Round><ShuffleIcon /></Round>, name: "Shuffle all", text: "Plays every song on your globe in a row. The little pill shows what's playing and who picked it. Tap it to fly there." },
      { icon: <Words top="12" bottom="SONGS" size={17} />, name: "Songs today", text: "How many songs are on your globe right now." },
      { icon: <Words top="4:12" bottom="NEXT SONG" size={14} />, name: "Countdown", text: "Time until midnight. Then everyone picks a new song, and today's goes into your core." },
      { icon: <Round>{SCENES[1].icon}</Round>, name: "Backdrop wheel", text: "The dial on the right-hand side picks the scene behind your Globe. Tap it for the next one, or spin it. The pin means where you really are." },
      { icon: <Plain><SkyIcon /></Plain>, name: "Your sky", text: "The sky follows the real sun, weather and season where you are." },
      { icon: <Round><span className="text-sm font-semibold">?</span></Round>, name: "About TopTrack", text: "What TopTrack is, and how to put it on your home screen." },
    ],
  },
  {
    tab: "A song",
    title: "When you open a song",
    rows: [
      { icon: <Tile flip />, name: "Tap the cover", text: "Flips it over to the comment and photo on the back." },
      { icon: <Round accent><PlayIcon /></Round>, name: "Play", text: "Hear the song right here. It keeps playing when you close the card." },
      { icon: <Plain><OpenIcon /></Plain>, name: "Open in your app", text: "Hear the whole song in Spotify or your own music app." },
      { icon: <Half><CoreIcon /></Half>, name: "Save to your core", text: "Keeps the song in your core for good. Once saved it lights up and spins." },
      { icon: <Half><LevelsIcon size={46} stroke={1.4} /></Half>, name: "Like", text: "The bars dance when you like a song. Tap the number to see who liked it." },
      { icon: <Half><NoteIcon ring={0} /></Half>, name: "Notes", text: "Leave a note on the song and read everyone else's." },
      { icon: <Round><CompassStar /></Round>, name: "Facts", text: "Facts about the song open over the cover. Swipe for the next one." },
      { icon: <Plain><ShareIcon size={19} /></Plain>, name: "Share to your Story", text: "On your own song: turns it into an Instagram Story." },
      { icon: <Plain><MoreIcon /></Plain>, name: "More", text: "On a friend's song: report it, hide their songs, or block them." },
      { icon: <Round><PersonIcon /></Round>, name: "Their name", text: "Tap the name under a song to visit that person's core." },
    ],
  },
  {
    tab: "Friends",
    title: "Friends and chat",
    rows: [
      { icon: <Tab><TabIcon name="friends" /></Tab>, name: "My friends", text: "Who has posted today, newest on top, then who hasn't yet. The flame is their streak: days in a row they've posted. Tap a song to fly to it. A red number means new songs." },
      { icon: <Tab><TabIcon name="find" /></Tab>, name: "Find a friend", text: "Search by username. “Added you” shows who added you, “You may know” shows friends of your friends." },
      {
        icon: <span className="flex h-10 w-10 items-center justify-center"><span className="rounded-full bg-accent px-2 py-1 text-[10px] font-semibold text-white">Add</span></span>,
        name: "Add",
        text: "Puts their songs on your globe. When they add you back, you're mutual friends.",
      },
      { icon: <Tab right><ChatIcon size={15} /></Tab>, name: "Globe chat", text: "The tab on the right. Talk with your mutual friends. It starts fresh every midnight, like the songs." },
      {
        icon: <span className="flex h-10 w-10 items-center justify-center"><span className="rounded-full px-1.5 py-1 text-[9px] font-semibold" style={glass(false)}>Message</span></span>,
        name: "Message",
        text: "In a mutual friend's core, talk one on one. Those messages stay, under Messages in the chat.",
      },
    ],
  },
  {
    tab: "Core",
    title: "Your core",
    rows: [
      { icon: <Tab><SignalCore className="h-3.5 w-3.5" /></Tab>, name: "Core", text: "Flies into the middle of your globe, where your profile lives." },
      { icon: <Tab><TabIcon name="songs" /></Tab>, name: "My songs", text: "Every song you've ever picked, newest first." },
      { icon: <Round><RedoIcon /></Round>, name: "One redo a day", text: "Changed your mind? Redo today's song from My songs, once a day." },
      { icon: <Round><CalendarIcon /></Round>, name: "Your archive", text: "At midnight your song moves into your core, sorted into a playlist for each month." },
      { icon: <Half><CoreIcon on /></Half>, name: "Saved", text: "Songs you saved from friends, kept in your core." },
      { icon: <Round><PersonIcon /></Round>, name: "Your picture", text: "Tap your picture in your core to add or change it." },
      { icon: <Round><GearIcon /></Round>, name: "Settings", text: "At the bottom of your core: people you've blocked, sign out, or delete your account." },
    ],
  },
];

export function Key({ onClose }: { onClose(): void }) {
  const [page, setPage] = useState(0);
  const p = PAGES[page];
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center px-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-[#0D2A3F]/30" />
      <div
        role="dialog"
        aria-label="Key: what every button does"
        className="rise-in relative flex max-h-[min(720px,88dvh)] w-full max-w-[400px] flex-col rounded-[28px] border border-white/60 bg-white/[0.95] text-card-ink backdrop-blur-2xl"
        style={{ boxShadow: "0 30px 80px -30px rgba(13,42,63,0.55)" }}
      >
        <div className="flex items-start px-6 pb-3 pt-5">
          <div>
            <h2 className="display text-[26px] leading-tight">Key</h2>
            <p className="text-[13px] text-muted">What every button does</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-3 -mt-1 ml-auto flex h-11 w-11 items-center justify-center">
            <CloseIcon size={20} />
          </button>
        </div>
        <div role="tablist" className="mx-5 grid grid-cols-4 gap-1 rounded-full p-1" style={{ background: "rgba(13,42,63,0.06)" }}>
          {PAGES.map((x, i) => (
            <button
              key={x.tab}
              type="button"
              role="tab"
              aria-selected={i === page}
              onClick={() => setPage(i)}
              className={`h-8 rounded-full text-[13px] font-semibold transition-colors ${i === page ? "bg-white shadow-[0_4px_14px_-6px_rgba(13,42,63,0.35)]" : "text-muted"}`}
            >
              {x.tab}
            </button>
          ))}
        </div>
        <div key={page} role="tabpanel" aria-label={p.title} className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">
          <ul className="flex flex-col">
            {p.rows.map((r) => (
              <li key={r.name} className="flex items-start gap-3.5 border-b border-[#0D2A3F]/[0.07] py-2.5 last:border-0">
                <span className="flex w-11 flex-none justify-center">{r.icon}</span>
                <span className="min-w-0 pt-0.5">
                  <span className="block text-[14px] font-semibold leading-snug">{r.name}</span>
                  <span className="block text-[13px] leading-snug text-muted">{r.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// The little key at the top left that opens it, the ?'s twin.
type KeyProps = { dark: boolean; onClick(): void; buttonRef: (el: HTMLButtonElement | null) => void };
export function KeyButton({ dark, onClick, buttonRef }: KeyProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label="Key: what every button does"
      className="absolute left-3 top-[max(14px,env(safe-area-inset-top))] z-[430] flex h-8 w-8 items-center justify-center rounded-full"
      style={glass(dark)}
    >
      <svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="15.5" r="4.5" />
        <path d="M11.3 12.2 20 3.5M16.5 7l2.5 2.5M14 9.5l2 2" />
      </svg>
    </button>
  );
}
