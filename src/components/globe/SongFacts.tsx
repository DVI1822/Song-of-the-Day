"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Post, SongFacts as Facts } from "@/lib/types";
import { glass } from "./ui";

// Under the Globe once you've posted: a few facts about your song (how it was
// made, the story behind it, the artist), one at a time. They turn over by
// themselves every few seconds; a tap shows the next one. Beside them, a
// less-seen photo of the artist, which a tap shows big.

const EVERY = 9000;
const FADE = 260;

export function SongFacts({ post, load }: { post: Post | null; load?: (postId: string) => Promise<Facts | null> }) {
  const [got, setGot] = useState<{ id: string; facts: Facts } | null>(null);
  const [i, setI] = useState(0);
  const [fading, setFading] = useState(false);
  const [big, setBig] = useState(false);
  const id = post?.id ?? null;

  useEffect(() => {
    if (!id || !load) return;
    let live = true;
    load(id).then((f) => {
      if (live && f?.facts.length) {
        setGot({ id, facts: f });
        setI(0);
      }
    });
    return () => {
      live = false;
    };
  }, [id, load]);

  const facts = got && got.id === id ? got.facts : null;
  const n = facts?.facts.length ?? 0;

  const next = () => {
    if (n < 2 || fading) return;
    setFading(true);
    setTimeout(() => {
      setI((x) => (x + 1) % n);
      setFading(false);
    }, FADE);
  };

  useEffect(() => {
    if (n < 2) return;
    const t = setTimeout(next, EVERY);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, n]);

  if (!facts || !post) return null;
  const fact = facts.facts[i % n];
  const source = fact.source ?? null;

  const photo = facts.photo ?? null;
  const credit = photo && `Photo: ${photo.credit}${photo.license ? `, ${photo.license}` : ""}`;

  return (
    <>
      <div
        className={`pointer-events-auto rise-in flex gap-3 rounded-[18px] ${photo ? "w-[min(320px,calc(100vw-88px))] p-2 pr-4" : "w-[min(300px,calc(100vw-88px))] px-4 pb-2.5 pt-2.5"}`}
        style={glass(false)}
      >
        {photo && (
          <button
            type="button"
            onClick={() => setBig(true)}
            aria-label={`Photo of ${post.artist}. Show it bigger`}
            className="relative w-[68px] flex-none overflow-hidden rounded-[12px] bg-[#0D2A3F]/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          </button>
        )}
        <div className={`min-w-0 flex-1 ${photo ? "py-0.5" : ""}`}>
          <div className="mb-1 flex items-center gap-2 text-[10px]">
            <span className="min-w-0 flex-1 truncate font-semibold uppercase tracking-[0.14em] text-accent">
              {fact.about === "artist" ? `About ${post.artist.split(/,| feat/i)[0]}` : "Behind the song"}
            </span>
            {n > 1 && (
              <span aria-hidden className="flex gap-1">
                {facts.facts.map((_, k) => (
                  <span key={k} className="h-1 w-1 rounded-full bg-current transition-opacity" style={{ opacity: k === i % n ? 0.7 : 0.18 }} />
                ))}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={next}
            aria-label={n > 1 ? `${fact.text} Next fact` : fact.text}
            className="block min-h-[54px] w-full text-left text-[13px] leading-[1.36] transition-opacity"
            style={{ opacity: fading ? 0 : 1, transitionDuration: `${FADE}ms` }}
          >
            {fact.text}
          </button>
          {(source || photo) && (
            <div className="mt-0.5 flex gap-1 truncate text-[9.5px] opacity-45">
              {source && (
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="flex-none font-semibold">
                  {source.name}
                </a>
              )}
              {source && photo && <span aria-hidden>·</span>}
              {photo && (
                <a href={photo.page} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate">
                  {credit}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
      {big &&
        photo &&
        createPortal(
        <div className="fixed inset-0 z-[950] flex flex-col items-center justify-center gap-3 bg-[#050914]/85 p-6 backdrop-blur-md" onClick={() => setBig(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={`${post.artist}`}
            className="rise-in max-h-[70vh] max-w-full rounded-[20px] object-contain shadow-2xl"
          />
          <a
            href={photo.page}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="max-w-[320px] text-center text-[11px] text-white/60"
          >
            {credit}
          </a>
        </div>,
        document.body,
      )}
    </>
  );
}
