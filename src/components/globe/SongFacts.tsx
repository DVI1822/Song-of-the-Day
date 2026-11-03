"use client";

import { useEffect, useState } from "react";
import type { Post, SongFacts as Facts } from "@/lib/types";
import { glass } from "./ui";

// Under the Globe once you've posted: a few facts about your song (how it was
// made, the story behind it, the artist), one at a time. They turn over by
// themselves every few seconds; a tap shows the next one.

const EVERY = 9000;
const FADE = 260;

export function SongFacts({ post, load }: { post: Post | null; load?: (postId: string) => Promise<Facts | null> }) {
  const [got, setGot] = useState<{ id: string; facts: Facts } | null>(null);
  const [i, setI] = useState(0);
  const [fading, setFading] = useState(false);
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
  const source = facts.sources.find((s) => s.about === fact.about) ?? facts.sources[0] ?? null;

  return (
    <div
      className="pointer-events-auto w-[min(300px,calc(100vw-88px))] rise-in rounded-[18px] px-4 pb-2.5 pt-2.5"
      style={glass(false)}
    >
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
        {source && (
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="opacity-45">
            Wikipedia
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={next}
        aria-label={n > 1 ? `${fact.text} Next fact` : fact.text}
        className="block min-h-[56px] w-full text-left text-[13.5px] leading-[1.38] transition-opacity"
        style={{ opacity: fading ? 0 : 1, transitionDuration: `${FADE}ms` }}
      >
        {fact.text}
      </button>
    </div>
  );
}
