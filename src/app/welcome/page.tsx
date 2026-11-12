import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { Card, Shell, ghostButtonClass } from "@/components/Shell";
import { getSession } from "@/lib/data";
import { needsFullName } from "@/lib/types";
import { ProfileForm } from "./ProfileForm";

export default async function WelcomePage() {
  const { supabase, userId, profile } = await getSession();
  if (!userId) redirect("/login");
  if (profile && !needsFullName(profile)) redirect("/");

  // Joined before full names were required: ask once, then back to the Globe.
  if (profile) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col justify-center gap-8">
          <div>
            <h1 className="display text-3xl">One quick thing</h1>
            <p className="mt-2 text-muted">
              TopTrack now uses first and last names, so friends know exactly who they&apos;re adding. Check
              yours and you&apos;re back in.
            </p>
          </div>
          <Card>
            <ProfileForm submitLabel="Save and continue" initial={profile} />
          </Card>
        </div>
      </Shell>
    );
  }

  const { data: invited } = await supabase.rpc("is_invited");
  if (!invited) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col justify-center gap-6">
          <div>
            <h1 className="display text-3xl">Invite only, for now</h1>
            <p className="mt-2 text-muted">
              TopTrack is open to a few friends while it&apos;s being tested. Ask whoever sent you the link to
              add your email, then sign in again.
            </p>
          </div>
          <form action={signOut}>
            <button className={ghostButtonClass}>Sign out</button>
          </form>
        </div>
      </Shell>
    );
  }
  return (
    <Shell>
      <div className="flex flex-1 flex-col justify-center gap-8">
        <div>
          <h1 className="display text-3xl">Welcome in</h1>
          <p className="mt-2 text-muted">Add your first and last name and pick a username so your friends can find you.</p>
        </div>
        <Card>
          <ProfileForm submitLabel="Start sharing" />
        </Card>
      </div>
    </Shell>
  );
}
