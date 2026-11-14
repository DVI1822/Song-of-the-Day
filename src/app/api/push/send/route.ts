import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { sendApns, type ApnsMessage } from "@/lib/apns";

// The database calls this every hour with the people to nudge, and whenever
// someone likes a song or leaves a note on it, and when someone posts their
// song for the friends who have them on their globe (see the push migrations). It's
// signed with PUSH_SECRET, so nobody else can send anything. Browsers get web
// push; the iPhone app saves its Apple device token as "apns:<token>" and
// goes through Apple instead (lib/apns.ts).

type Sub = { endpoint: string; p256dh: string; auth: string } & (
  | { kind: "noon" | "night" }
  | { kind: "reaction" | "post"; title: string; body: string; tag: string }
);

const NUDGE = {
  noon: { title: "What's your top track today?", body: "Pick the song that ran your day and put it on your globe." },
  night: { title: "Still time for your top track", body: "Your globe closes at midnight." },
};

export async function POST(req: Request) {
  const secret = process.env.PUSH_SECRET;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !pub || !priv) return new Response("Push isn't set up", { status: 503 });
  if (req.headers.get("x-push-secret") !== secret) return new Response("Not allowed", { status: 401 });

  const { subs } = (await req.json().catch(() => ({}))) as { subs?: Sub[] };
  if (!Array.isArray(subs)) return new Response("Bad request", { status: 400 });

  webpush.setVapidDetails("https://mysong.day", pub, priv);
  const message = (s: Sub): ApnsMessage =>
    s.kind === "reaction" || s.kind === "post"
      ? { title: s.title, body: s.body, tag: s.tag, url: "/" }
      : { ...(NUDGE[s.kind] ?? NUDGE.noon), tag: "song-nudge", url: "/" };

  const apple = subs.filter((s) => s.endpoint.startsWith("apns:"));
  const appleGone = sendApns(apple.map((s) => ({ token: s.endpoint.slice(5), msg: message(s) })));

  const gone: string[] = [];
  await Promise.all(
    subs.filter((s) => !s.endpoint.startsWith("apns:")).map((s) =>
      webpush
        .sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(message(s)),
          { TTL: 60 * 60 * 3, urgency: "normal" },
        )
        .catch((e: { statusCode?: number }) => {
          if (e.statusCode === 404 || e.statusCode === 410) gone.push(s.endpoint);
        }),
    ),
  );
  for (const t of await appleGone) gone.push(`apns:${t}`);
  if (gone.length) {
    await createClient(supabaseUrl, supabaseKey).rpc("push_gone", { key: secret, endpoints: gone });
  }
  return Response.json({ sent: subs.length - gone.length, gone: gone.length });
}
