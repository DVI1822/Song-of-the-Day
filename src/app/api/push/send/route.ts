import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

// The database calls this every hour with the people to nudge, and whenever
// someone likes a song or leaves a note on it (see the push migrations). It's
// signed with PUSH_SECRET, so nobody else can send anything.

type Sub = { endpoint: string; p256dh: string; auth: string } & (
  | { kind: "noon" | "night" }
  | { kind: "reaction"; title: string; body: string; tag: string }
);

const NUDGE = {
  noon: { title: "What's your song today?", body: "Pick the one that hit hardest and put it on your globe." },
  night: { title: "Still time for today's song", body: "Your globe closes at midnight." },
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
  const gone: string[] = [];
  await Promise.all(
    subs.map((s) =>
      webpush
        .sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(
            s.kind === "reaction"
              ? { title: s.title, body: s.body, tag: s.tag, url: "/" }
              : { ...(NUDGE[s.kind] ?? NUDGE.noon), url: "/" },
          ),
          { TTL: 60 * 60 * 3, urgency: "normal" },
        )
        .catch((e: { statusCode?: number }) => {
          if (e.statusCode === 404 || e.statusCode === 410) gone.push(s.endpoint);
        }),
    ),
  );
  if (gone.length) {
    await createClient(supabaseUrl, supabaseKey).rpc("push_gone", { key: secret, endpoints: gone });
  }
  return Response.json({ sent: subs.length - gone.length, gone: gone.length });
}
