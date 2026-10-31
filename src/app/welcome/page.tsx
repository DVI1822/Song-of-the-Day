import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { Card, Shell, ghostButtonClass } from "@/components/Shell";
import { getSession } from "@/lib/data";
import { ProfileForm } from "./ProfileForm";

export default async function WelcomePage() {
  const { supabase, userId, profile } = await getSession();
  if (!userId) redirect("/login");
  if (profile) redirect("/");

  const { data: invited } = await supabase.rpc("is_invited");
  if (!invited) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col justify-center gap-6">
          <div>
            <h1 className="display text-3xl">Invite only, for now</h1>
            <p className="mt-2 text-muted">
              Song of the Day is open to a few friends while it&apos;s being tested. Ask whoever sent you the link to
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
          <p className="mt-2 text-muted">Pick a name so your friends can find you.</p>
        </div>
        <Card>
          <ProfileForm submitLabel="Start sharing" />
        </Card>
      </div>
    </Shell>
  );
}
