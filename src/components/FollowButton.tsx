"use client";

import { useOptimistic, useTransition } from "react";
import { follow, unfollow } from "@/app/actions";

export function FollowButton({ profileId, following, compact }: { profileId: string; following: boolean; compact?: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(following);
  const [, start] = useTransition();
  const toggle = () =>
    start(async () => {
      setOptimistic(!optimistic);
      await (optimistic ? unfollow(profileId) : follow(profileId));
    });

  const size = compact ? "h-9 px-4 text-xs" : "h-11 px-6 text-sm";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={optimistic}
      className={`inline-flex flex-none items-center justify-center rounded-full font-semibold transition ${size} ${
        optimistic
          ? "border border-line text-accent-deep hover:bg-soft"
          : "bg-accent text-white hover:bg-accent-deep"
      }`}
    >
      {optimistic ? "Following" : "Follow"}
    </button>
  );
}
