"use client";

import { useState } from "react";
import { Artwork } from "@/components/Artwork";
import { Player } from "@/components/Player";
import type { Post } from "@/lib/types";

export function ArchiveRow({ post, date, time, divider }: { post: Post; date: string; time: string; divider: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={divider ? "border-t border-line" : ""}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-[58px] w-full items-center gap-3 text-left"
      >
        <span className="w-12 flex-none text-[11px] font-semibold">{date}</span>
        <Artwork src={post.artwork_url} alt="" className="h-[38px] w-[38px] flex-none rounded-[10px]" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-semibold">{post.title}</span>
          <span className="truncate text-[11px] text-card-muted">{post.artist}</span>
        </span>
      </button>
      {open && (
        <div className="rise-in mb-3 flex flex-col gap-3 rounded-[18px] bg-void p-3 text-ink">
          {post.caption && <p className="display text-base leading-snug">“{post.caption}”</p>}
          <p className="text-[11px] text-muted">Posted at {time}</p>
          <Player links={post.platform_links} songUrl={post.song_url} pageUrl={post.page_url} size={44} />
        </div>
      )}
    </div>
  );
}
