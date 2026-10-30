import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { GlobeApp } from "@/components/globe/GlobeApp";
import { SignalCore } from "@/components/globe/SignalCore";
import { LegalLinks } from "@/components/Legal";
import { Shell, buttonClass } from "@/components/Shell";
import { getGlobe, getSession, sweepPhotos } from "@/lib/data";
import { isConfigured } from "@/lib/supabase/env";

export default async function Home() {
  await connection();
  if (!isConfigured) return <NotConfigured />;

  const { supabase, userId, profile } = await getSession();
  if (!userId) return <Landing />;
  if (!profile) redirect("/welcome");

  const [{ friends, myPost, mySongs, redoUsed, addedMe, activity }, { data: spotify }] = await Promise.all([
    getGlobe(profile),
    supabase.from("spotify_links").select("user_id").eq("user_id", userId).maybeSingle(),
    sweepPhotos(supabase, profile).catch(() => {}),
  ]);
  return (
    <GlobeApp
      me={profile}
      myPost={myPost}
      friends={friends}
      mySongs={mySongs}
      redoUsed={redoUsed}
      addedMe={addedMe}
      activity={activity}
      spotifyLinked={Boolean(spotify)}
    />
  );
}

function Landing() {
  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <SignalCore className="mb-6 h-28 w-28" />
        <h1 className="display text-5xl">Fingerpick</h1>
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
      <LegalLinks />
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
