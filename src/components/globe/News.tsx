"use client";

import { useEffect, useState } from "react";
import { CoverCrown } from "./Ranks";

// A one-time announcement, shown once per device the first time the app
// opens on or after its day. For now: the TopTrack crown, launched on
// 2026-11-13 with everyone's points starting from zero, shown for a week. To announce
// something else, change KEY (so it shows again), FROM and the words.

const KEY = "tt-news-crown";
const FROM = 20261113; // yyyymmdd, the phone's own date
const UNTIL = 20261120; // after a week it's not news, and new people get the Welcome

function due() {
  try {
    if (localStorage.getItem(KEY) !== null) return false;
  } catch {
    return false;
  }
  const d = new Date();
  const n = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return n >= FROM && n <= UNTIL;
}

export function NewsCard() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!due()) return;
    const t = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
    setShow(false);
  };
  return (
    <div className="fixed inset-0 z-[610] flex items-center justify-center px-5">
      <button type="button" aria-label="Close" onClick={close} className="absolute inset-0 cursor-default bg-[#0D2A3F]/40" />
      <div
        role="dialog"
        aria-label="New: crown your TopTrack"
        className="rise-in relative flex w-full max-w-[380px] flex-col gap-3 rounded-[28px] border border-white/60 bg-white/[0.95] px-6 pb-6 pt-4 text-center text-card-ink backdrop-blur-2xl"
        style={{ boxShadow: "0 30px 80px -30px rgba(13,42,63,0.55)" }}
      >
        {/* the gold crown lands and the confetti rains down the card */}
        <div className="relative h-[58px]">
          <CoverCrown burst={1} fall={420} top={56} />
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">New today</div>
        <h2 className="display text-[28px] leading-tight">Crown your TopTrack</h2>
        <p className="text-[15px] leading-relaxed">
          Once you&apos;ve posted, tap the crown under a friend&apos;s song to make it your TopTrack of the day. You get one
          crown a day, so make it count.
        </p>
        <p className="text-[15px] leading-relaxed">
          Every crown is a point. The <b>Leaderboard</b> on the right keeps score for the month, and everyone starts at
          zero today. Chat moved to the left, under My Core.
        </p>
        <button type="button" onClick={close} className="mt-2 h-12 rounded-full bg-accent text-[15px] font-semibold text-white">
          Let&apos;s go
        </button>
      </div>
    </div>
  );
}
