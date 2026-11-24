import type { Metadata } from "next";
import { LegalPage } from "@/components/Legal";

export const metadata: Metadata = { title: "Terms · TopTrack" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="November 24, 2026">
      <p>TopTrack is a small, free site for friends. By using it you agree to these few things.</p>
      <ul>
        <li>
          Share songs, captions, photos and messages you&apos;re allowed to share, and be kind. There&apos;s no tolerance for
          objectionable content or abusive people: nothing hateful, sexual, violent, harassing or illegal. Breaking this
          gets the content removed and the account closed.
        </li>
        <li>Keep your sign-in to yourself. You&apos;re responsible for what&apos;s posted from your account.</li>
        <li>
          Songs play as short samples from the services they come from, like Spotify and Apple Music, under their own terms, and open in your own music app. We don&apos;t host or
          sell any music. Song details and covers belong to their owners.
        </li>
        <li>
          Spotify is a trademark of Spotify AB. TopTrack isn&apos;t made or endorsed by Spotify, and Spotify
          isn&apos;t responsible for it.
        </li>
        <li>
          If a song, a message or a person bothers you, use <strong>⋯</strong> on their song, Report on their chat message,
          or &ldquo;Report or block&rdquo; on their core. Blocking hides them from you straight away. We read every report
          within 24 hours and remove what breaks these terms. You can also email{" "}
          <a href="mailto:hello@mytoptrack.io">hello@mytoptrack.io</a>.
        </li>
        <li>
          If you own the rights to something shared here and want it taken down, send a{" "}
          <a href="/copyright">copyright takedown</a>. Accounts that repeatedly share things they don&apos;t have the
          rights to will be closed.
        </li>
        <li>
          The site is offered as it is, without guarantees. It may change, pause or close, and posts or accounts that
          break these terms may be removed.
        </li>
      </ul>
      <p>
        See the <a href="/privacy">privacy policy</a> for what we keep about you and how to delete it.
      </p>
    </LegalPage>
  );
}
