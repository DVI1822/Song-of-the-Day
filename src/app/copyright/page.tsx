import type { Metadata } from "next";
import { LegalPage } from "@/components/Legal";
import { TakedownForm } from "./TakedownForm";

export const metadata: Metadata = { title: "Copyright · Fingerpick" };

export default function CopyrightPage() {
  return (
    <LegalPage title="Copyright takedowns" updated="October 25, 2026">
      <p>
        Fingerpick doesn&apos;t host music. Songs play through the services they come from, like Spotify. What
        people do post here is a link, the song&apos;s details and cover, and their own caption and photo.
      </p>
      <p>
        If you own the rights to something shared here, or act for someone who does, and want it removed, fill in the
        notice below (it follows the US Digital Millennium Copyright Act). We&apos;ll take down what it names, usually
        within a few days, and let the person who posted it know.
      </p>
      <p>
        If your post was taken down and you believe that was a mistake, reply to the email we send you with a counter
        notice, and we&apos;ll look at it again.
      </p>
      <h2>Takedown notice</h2>
      <TakedownForm />
    </LegalPage>
  );
}
