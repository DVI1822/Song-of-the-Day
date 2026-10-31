import type { Metadata } from "next";
import { LegalPage } from "@/components/Legal";

export const metadata: Metadata = { title: "Terms · Song of the Day" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="October 25, 2026">
      <p>Song of the Day is a small, free site for friends. By using it you agree to these few things.</p>
      <ul>
        <li>Share songs, captions and photos you&apos;re allowed to share, and be kind. Nothing hateful or illegal.</li>
        <li>Keep your sign-in to yourself. You&apos;re responsible for what&apos;s posted from your account.</li>
        <li>
          Music plays through the services it comes from, like Spotify, under their own terms. We don&apos;t host or
          sell any music. Song details and covers belong to their owners.
        </li>
        <li>
          Spotify is a trademark of Spotify AB. Song of the Day isn&apos;t made or endorsed by Spotify, and Spotify
          isn&apos;t responsible for it.
        </li>
        <li>
          If a song or a person bothers you, use <strong>⋯</strong> on their song (or &ldquo;Report or block&rdquo; on
          their core) to report them or block them. We read every report and remove what breaks these terms.
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
