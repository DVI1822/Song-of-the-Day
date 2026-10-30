import { signOut, unblockUser, unlinkSpotify } from "@/app/actions";
import { ProfileForm } from "@/app/welcome/ProfileForm";
import { LegalLinks } from "@/components/Legal";
import { Card, Shell, buttonClass, ghostButtonClass } from "@/components/Shell";
import { requireProfile } from "@/lib/data";
import { DeleteAccount } from "./DeleteAccount";

const SPOTIFY_NOTES: Record<string, string> = {
  linked: "Spotify is connected. Press play on any song to hear it on your Spotify app.",
  cancelled: "Spotify wasn't connected.",
  failed: "Spotify couldn't be connected. Try again in a minute.",
  unset: "Spotify isn't set up for this site yet.",
};

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { supabase, profile } = await requireProfile();
  const { spotify: result } = await searchParams;
  const [{ data: link }, { data: blocks }] = await Promise.all([
    supabase
      .from("spotify_links")
      .select("spotify_name")
      .eq("user_id", profile.id)
      .maybeSingle<{ spotify_name: string | null }>(),
    supabase.rpc("my_blocks"),
  ]);
  const blocked = (blocks ?? []) as { id: string; username: string; display_name: string }[];
  const note = typeof result === "string" ? SPOTIFY_NOTES[result] : undefined;

  return (
    <Shell back={{ href: `/u/${profile.username}`, label: "Your core" }}>
      <h1 className="display mb-6 text-3xl">Your profile</h1>
      <Card>
        <ProfileForm submitLabel="Save" initial={profile} />
      </Card>
      <p className="mt-3 text-xs text-muted">
        Saving also updates your timezone to this device&apos;s, which decides when your midnight is.
      </p>

      <h2 className="display mb-3 mt-10 text-xl">Spotify</h2>
      <Card>
        {link ? (
          <form action={unlinkSpotify} className="flex flex-col gap-3">
            <p className="text-sm">
              Connected{link.spotify_name ? ` as ${link.spotify_name}` : ""}. Play starts songs on whichever Spotify app
              you have open, whole if you have Premium. Disconnecting deletes your Spotify link from Fingerpick.
            </p>
            <button className={ghostButtonClass}>Disconnect Spotify</button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Connect Spotify to hear whole songs. Play will start them on your Spotify app, on your phone, computer or
              speaker. Needs Spotify Premium.
            </p>
            <a href="/spotify/connect" className={buttonClass}>
              Connect Spotify
            </a>
          </div>
        )}
        {note && <p className="mt-3 text-xs text-card-muted">{note}</p>}
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
