import { connection } from "next/server";
import { redirect } from "next/navigation";
import { GlobeApp } from "@/components/globe/GlobeApp";
import { Shell } from "@/components/Shell";
import { getGlobe, getSession, sweepPhotos } from "@/lib/data";
import { isConfigured } from "@/lib/supabase/env";
import { needsFullName } from "@/lib/types";
import { Landing } from "./Landing";

export default async function Home() {
  await connection();
  if (!isConfigured) return <NotConfigured />;

  const { supabase, userId, profile } = await getSession();
  if (!userId) return <Landing />;
  if (!profile || needsFullName(profile)) redirect("/welcome");

  const [{ friends, myPost, mySongs, redoUsed, addedMe, activity }] = await Promise.all([
    getGlobe(profile),
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
    />
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
