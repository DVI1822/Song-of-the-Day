"use client";

import { useTransition } from "react";
import { deleteTodayPost } from "@/app/actions";
import { FlipCover } from "@/components/FlipCover";
import { ghostButtonClass } from "@/components/Shell";
import { formatTime } from "@/lib/day";
import type { Post, Profile } from "@/lib/types";

export function AlreadyPosted({ post, profile }: { post: Post; profile: Profile }) {
  const [pending, start] = useTransition();
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
      <button
        className={`${ghostButtonClass} self-start`}
        disabled={pending}
        onClick={() => {
          if (confirm("Take back today's song so you can pick a different one?"))
            start(() => deleteTodayPost(post.id));
        }}
      >
        {pending ? "Removing…" : "Change my song"}
      </button>
    </div>
  );
}
