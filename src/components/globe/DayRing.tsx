"use client";

import { useEffect, useState } from "react";

// "13h left before midnight", with a ring showing how much of the day is gone.
export function DayRing() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <div className="h-[34px]" />;

  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msLeft = midnight.getTime() - now.getTime();
  const hours = Math.floor(msLeft / 3_600_000);
  const minutes = Math.floor(msLeft / 60_000);
  const left = hours >= 1 ? `${hours}h left` : `${minutes}m left`;
  const done = 1 - msLeft / 86_400_000;
  const circumference = 2 * Math.PI * 15;

  return (
    <div className="flex items-center gap-2 text-right text-[11px] leading-[1.35] text-muted">
      <span>
        {left}
        <br />
        before midnight
      </span>
      <svg role="img" aria-label={`Day ${Math.round(done * 100)} percent done`} width="34" height="34" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(233,251,248,0.18)" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="#FF4A4F"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(done * circumference).toFixed(1)} ${circumference.toFixed(1)}`}
          transform="rotate(-90 18 18)"
        />
      </svg>
    </div>
  );
}
