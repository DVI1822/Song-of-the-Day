import type { Metadata } from "next";
import { LegalPage } from "@/components/Legal";

export const metadata: Metadata = { title: "Privacy · Song of the Day" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="October 25, 2026">
      <p>
        Song of the Day is a small site for sharing one song a day with friends. This page says what it keeps about you,
        why, and how to get rid of it.
      </p>

      <h2>What we keep</h2>
      <ul>
        <li>
          Your email address, so you can sign in. If you sign in with Spotify instead, that&apos;s the name and email on
          your Spotify account.
        </li>
        <li>Your name, username and timezone. The timezone decides when your day ends at midnight.</li>
        <li>
          Your songs: the link you paste, the song&apos;s title, artist and cover (looked up from public music pages), and
          any caption or photo you add.
        </li>
        <li>Who you follow and who follows you.</li>
      </ul>

      <h2>Spotify</h2>
      <p>
        If you choose to connect Spotify, we ask Spotify for permission to see what&apos;s playing and to start, pause and
        change songs on your Spotify app. That lets the play button play whole songs. We store the key Spotify gives
        us for this and your Spotify display name. We don&apos;t read your playlists, library or listening history, and we
        don&apos;t keep any Spotify content.
      </p>
      <p>
        You can disconnect at any time in <strong>Settings → Disconnect Spotify</strong>, which deletes that key from
        our records straight away. You can also remove the app&apos;s access from your Spotify account at{" "}
        <a href="https://www.spotify.com/account/apps/">spotify.com/account/apps</a>.
      </p>

      <h2>Weather</h2>
      <p>
        The Globe shows the weather where you are. To find it, we use your device&apos;s location if you&apos;ve allowed it,
        or else a rough location from your internet connection. It&apos;s rounded to about 10 km, sent to Open-Meteo to
        look up the weather, and never stored.
      </p>

      <h2>Who sees what</h2>
      <p>
        People who follow you can see your songs, captions and photos. We don&apos;t sell or share your information with
        anyone, and there are no ads or trackers. The site runs on Supabase (accounts and data) and Vercel (hosting),
        which store it on our behalf.
      </p>

      <h2>Deleting your data</h2>
      <p>
        You can delete a post on the day you share it. To delete your whole account and everything in it, ask the
        person who runs the site and it will be removed.
      </p>
    </LegalPage>
  );
}
