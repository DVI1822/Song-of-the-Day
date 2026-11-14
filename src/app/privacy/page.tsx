import type { Metadata } from "next";
import { LegalPage } from "@/components/Legal";

export const metadata: Metadata = { title: "Privacy · TopTrack" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="November 13, 2026">
      <p>
        TopTrack is a small site and iPhone app for sharing one song a day with friends. This page says what it keeps
        about you, why, and how to get rid of it. It covers the website (www.mytoptrack.io) and the TopTrack app, which
        are the same service.
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
          any caption or photo you add. Photos are deleted when your day ends; the song and caption stay on your profile.
        </li>
        <li>Likes, notes, your daily TopTrack pick, and the messages you send in chat.</li>
        <li>Who you follow and who follows you, and anyone you block.</li>
        <li>Reports you send about a song or a person, which only the site&apos;s team can read.</li>
      </ul>

      <h2>Music</h2>
      <p>
        Songs play as 30-second samples, and whole songs open in your own music app. TopTrack doesn&apos;t connect to your
        Spotify or any other music account, and doesn&apos;t read your playlists, library or listening history.
      </p>

      <h2>Weather</h2>
      <p>
        The Globe shows the weather where you are. To find it, we use your device&apos;s location if you&apos;ve allowed it,
        or else a rough location from your internet connection. It&apos;s rounded to about 10 km, sent to Open-Meteo to
        look up the weather, and never stored.
      </p>

      <h2>Notifications</h2>
      <p>
        If you turn notifications on, we keep an address for your browser or phone (on the iPhone app, the device token
        Apple gives it) so we can tell you when friends post, when someone likes your song or leaves a note, and remind
        you at noon and 9 PM if you haven&apos;t posted, and at 6 PM if you haven&apos;t crowned a song yet. It&apos;s used for nothing else, and it&apos;s deleted when you
        turn notifications off or delete your account. You can turn them off any time in your phone&apos;s Settings.
      </p>

      <h2>Song facts</h2>
      <p>
        After you post, TopTrack can show a few facts about the song. To find them, the song&apos;s title and artist (never
        anything about you) are sent to Anthropic&apos;s Claude, which searches public web pages.
      </p>

      <h2>Who sees what</h2>
      <p>
        People who follow you can see your songs, captions and photos. We don&apos;t sell or share your information with
        anyone, and there are no ads or trackers, in the app or on the site. The site runs on Supabase (accounts and
        data) and Vercel (hosting), which store it on our behalf, and sign-in emails go out through Resend.
      </p>

      <h2>Deleting your data</h2>
      <p>
        You can delete a post on the day you share it. To delete your whole account and everything in it (songs,
        photos, follows and blocks), go to <strong>Settings → Delete my account</strong>. It&apos;s
        erased right away and can&apos;t be undone. This works the same in the app.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about your data, or anything else: email{" "}
        <a href="mailto:hello@mytoptrack.io">hello@mytoptrack.io</a>.
      </p>
    </LegalPage>
  );
}
