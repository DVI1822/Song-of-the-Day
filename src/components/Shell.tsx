import Link from "next/link";

// The white room with its faint glow, used by every page except the Globe
// (which draws its own).
export function Shell({
  children,
  narrow = true,
  back,
}: {
  children: React.ReactNode;
  narrow?: boolean;
  back?: { href: string; label: string };
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="aura fixed left-1/2 top-[30%] h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2" />
      <div
        className={`relative mx-auto flex min-h-dvh flex-col px-5 pb-16 pt-6 ${narrow ? "max-w-md" : "max-w-2xl"}`}
      >
        {back && (
          <Link
            href={back.href}
            className="mb-6 inline-flex h-11 items-center gap-2 self-start text-sm text-muted hover:text-ink"
          >
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            {back.label}
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-line bg-card p-5 text-card-ink shadow-[0_16px_40px_-24px_rgba(13,42,63,0.35)] ${className}`}>
      {children}
    </div>
  );
}

export const inputClass =
  "h-12 w-full rounded-2xl border border-line bg-white px-4 text-base text-card-ink outline-none placeholder:text-card-muted/70 focus:border-accent";

export const buttonClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-white transition hover:bg-accent-deep disabled:opacity-50";

export const ghostButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-muted px-5 text-sm font-semibold text-ink transition hover:bg-card-ink/5";
