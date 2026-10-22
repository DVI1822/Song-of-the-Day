"use client";

import { useState } from "react";
import { Artwork } from "@/components/Artwork";
import { FlipCover } from "@/components/FlipCover";
import { Player } from "@/components/Player";
import { formatTime } from "@/lib/day";
import type { Post } from "@/lib/types";

export function TodayCard({ post, who, timezone }: { post: Post; who: string; timezone: string }) {
  const [open, setOpen] = useState(false);
  const time = formatTime(post.created_at, timezone);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-[20px] border border-line p-2.5 text-left"
      >
        <Artwork src={post.artwork_url} alt="" className="h-[52px] w-[52px] flex-none rounded-[14px]" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] text-card-muted">Today · {time}</span>
          <span className="truncate text-[15px] font-semibold">{post.title}</span>
          <span className="truncate text-xs text-card-muted">{post.artist}</span>
        </div>
        <span className="pr-1.5 text-[11px] font-semibold text-accent-deep">Flip it</span>
      </button>
    );
  }
  return (
    <div className="rise-in flex flex-col gap-4 rounded-[24px] bg-void p-4 text-ink">
      <FlipCover artwork={post.artwork_url} title={post.title} caption={post.caption} footer={`${who} · ${time}`} />
      <div>
        <div className="display text-2xl leading-tight">{post.title}</div>
        <div className="text-muted">{post.artist}</div>
      </div>
      <Player links={post.platform_links} songUrl={post.song_url} pageUrl={post.page_url} />
    </div>
  );
}
