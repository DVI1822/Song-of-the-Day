import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Globe } from "@/components/globe/Globe";
import { Shell, buttonClass } from "@/components/Shell";
import { getGlobe, getSession } from "@/lib/data";
import { isConfigured } from "@/lib/supabase/env";

export default async function Home() {
  await connection();
  if (!isConfigured) return <NotConfigured />;

  const { userId, profile } = await getSession();
  if (!userId) return <Landing />;
  if (!profile) redirect("/welcome");

  const { friends, myPost } = await getGlobe(profile);
  return <Globe me={profile} myPost={myPost} friends={friends} />;
}

function Landing() {
  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="relative mb-4 h-40 w-40">
          <div className="aura absolute -inset-24" />
          <div
            className="absolute inset-10 rounded-full"
            style={{
              background: "radial-gradient(circle at 40% 36%, #FFFFFF 0%, #D9FFF8 55%, #D9FFF800 100%)",
              animation: "pulse-glow 3.2s ease-in-out infinite",
            }}
          />
        </div>
        <h1 className="display text-5xl">Song of the Day</h1>
        <p className="max-w-xs text-lg text-muted">
          One song a day. The one that hit hardest. See what everyone you follow is feeling.
        </p>
        <Link href="/login" className={buttonClass}>
          Get started
        </Link>
        <Link href="/demo" className="text-sm text-muted underline-offset-4 hover:underline">
          Peek at a demo Globe
        </Link>
      </div>
    </Shell>
  );
}

function NotConfigured() {
  return (
    <Shell>
      <div className="flex flex-1 flex-col justify-center gap-4">
        <h1 className="display text-3xl">Almost there</h1>
        <p className="text-muted">
          The app isn&apos;t connected to Supabase yet. Follow the steps in <code>SETUP.md</code> to add your
          Supabase URL and key, then reload this page.
        </p>
      </div>
    </Shell>
  );
}
