"use client";

import { useState, useTransition } from "react";
import { deleteTodayPost } from "@/app/actions";
import { FlipCover } from "@/components/FlipCover";
import { ghostButtonClass } from "@/components/Shell";
import { formatTime } from "@/lib/day";
import type { Post, Profile } from "@/lib/types";

export function AlreadyPosted({ post, profile, redoUsed }: { post: Post; profile: Profile; redoUsed: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">You already shared today. It moves to your archive at midnight.</p>
      <FlipCover
        artwork={post.artwork_url}
        title={post.title}
        caption={post.caption}
        footer={`${profile.display_name} · ${formatTime(post.created_at, profile.timezone)}`}
      />
      <div>
        <div className="display text-2xl">{post.title}</div>
        <div className="text-muted">{post.artist}</div>
      </div>
      {redoUsed ? (
        <p className="text-sm text-muted">You&apos;ve used today&apos;s redo, so this one&apos;s locked in.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            className={`${ghostButtonClass} self-start`}
            disabled={pending}
            onClick={() => {
              if (confirm("Take back today's song? You get one redo a day, so the next one is final."))
                start(async () => setError((await deleteTodayPost(post.id))?.error));
            }}
          >
            {pending ? "Removing…" : "Use my redo"}
          </button>
          <p className="text-xs text-muted">You get one redo a day.</p>
          {error && <p className="text-sm text-ring">{error}</p>}
        </div>
      )}
    </div>
  );
}
