import Link from "next/link";
import { Shell } from "@/components/Shell";

// The privacy, terms and copyright pages share this plain reading layout.
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <Shell back={{ href: "/", label: "Song of the Day" }}>
      <h1 className="display mb-1 text-3xl">{title}</h1>
      <p className="mb-8 text-xs text-muted">Last updated {updated}</p>
      <div className="flex flex-col gap-5 text-sm leading-relaxed [&_h2]:display [&_h2]:mt-4 [&_h2]:text-lg [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
        {children}
      </div>
    </Shell>
  );
}

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <p className={`flex justify-center gap-4 text-xs text-muted ${className}`}>
      <Link href="/privacy" className="underline-offset-4 hover:underline">
        Privacy
      </Link>
      <Link href="/terms" className="underline-offset-4 hover:underline">
        Terms
      </Link>
      <Link href="/copyright" className="underline-offset-4 hover:underline">
        Copyright
      </Link>
    </p>
  );
}
