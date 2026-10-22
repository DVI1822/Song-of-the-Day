import Link from "next/link";
import { Shell, buttonClass } from "@/components/Shell";

export default function NotFound() {
  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 className="display text-3xl">Nothing here</h1>
        <p className="text-muted">That page or person doesn&apos;t exist.</p>
        <Link href="/" className={buttonClass}>
          Back to the Globe
        </Link>
      </div>
    </Shell>
  );
}
