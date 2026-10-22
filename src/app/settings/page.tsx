import { signOut } from "@/app/actions";
import { ProfileForm } from "@/app/welcome/ProfileForm";
import { Card, Shell, ghostButtonClass } from "@/components/Shell";
import { requireProfile } from "@/lib/data";

export default async function SettingsPage() {
  const { profile } = await requireProfile();
  return (
    <Shell back={{ href: `/u/${profile.username}`, label: "Your core" }}>
      <h1 className="display mb-6 text-3xl">Your profile</h1>
      <Card>
        <ProfileForm submitLabel="Save" initial={profile} />
      </Card>
      <p className="mt-3 text-xs text-muted">
        Saving also updates your timezone to this device&apos;s, which decides when your midnight is.
      </p>
      <form action={signOut} className="mt-8">
        <button className={ghostButtonClass}>Sign out</button>
      </form>
    </Shell>
  );
}
