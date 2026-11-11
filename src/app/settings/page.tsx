import { signOut, unblockUser } from "@/app/actions";
import { ProfileForm } from "@/app/welcome/ProfileForm";
import { LegalLinks } from "@/components/Legal";
import { Card, Shell, ghostButtonClass } from "@/components/Shell";
import { requireProfile } from "@/lib/data";
import { DeleteAccount } from "./DeleteAccount";
import { ScenePicker } from "./ScenePicker";

export default async function SettingsPage() {
  const { supabase, profile } = await requireProfile();
  const { data: blocks } = await supabase.rpc("my_blocks");
  const blocked = (blocks ?? []) as { id: string; username: string; display_name: string }[];

  return (
    <Shell back={{ href: `/u/${profile.username}`, label: "Your core" }}>
      <h1 className="display mb-6 text-3xl">Your profile</h1>
      <Card>
        <ProfileForm submitLabel="Save" initial={profile} />
      </Card>
      <p className="mt-3 text-xs text-muted">
        Saving also updates your timezone to this device&apos;s, which decides when your midnight is.
      </p>

      <h2 className="display mb-3 mt-10 text-xl">Your scene</h2>
      <Card>
        <ScenePicker />
      </Card>

      {blocked.length > 0 && (
        <>
          <h2 className="display mb-3 mt-10 text-xl">Blocked</h2>
          <Card className="flex flex-col gap-1">
            {blocked.map((b) => (
              <form key={b.id} action={unblockUser.bind(null, b.id)} className="flex h-11 items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">{b.display_name}</span>
                  <span className="truncate text-xs text-card-muted">@{b.username}</span>
                </span>
                <button className="text-xs font-semibold text-accent-deep">Unblock</button>
              </form>
            ))}
          </Card>
        </>
      )}

      <h2 className="display mb-3 mt-10 text-xl">Leave</h2>
      <Card>
        <DeleteAccount username={profile.username} />
      </Card>

      <form action={signOut} className="mt-8">
        <button className={ghostButtonClass}>Sign out</button>
      </form>
      <LegalLinks className="mt-10" />
    </Shell>
  );
}
