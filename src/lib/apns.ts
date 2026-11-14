import "server-only";
import { createPrivateKey, sign } from "node:crypto";
import { connect, type ClientHttp2Session } from "node:http2";

// Push notifications to the TopTrack iPhone app, straight through Apple
// (APNs). Needs, in Vercel:
//   APNS_KEY        the .p8 key from developer.apple.com → Keys (Apple Push
//                   Notifications service), pasted whole, BEGIN/END lines too
//   APNS_KEY_ID     that key's 10-character Key ID
//   APNS_TEAM_ID    the 10-character Team ID (top right of the developer site)
//   APNS_BUNDLE_ID  io.mytoptrack.app (the default)
//   APNS_SANDBOX    "1" only for builds run straight from Xcode; TestFlight
//                   and App Store builds use Apple's production servers.

export type ApnsMessage = { title: string; body: string; tag: string; url: string };

export const apnsReady = () => !!(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);

// Apple wants a fresh signed token at most once every 20 minutes and at
// least once an hour.
let token: { jwt: string; at: number } | null = null;
function bearer() {
  if (token && Date.now() - token.at < 40 * 60 * 1000) return token.jwt;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "ES256", kid: process.env.APNS_KEY_ID });
  const iat = Math.floor(Date.now() / 1000);
  const claims = b64({ iss: process.env.APNS_TEAM_ID, iat });
  const key = createPrivateKey((process.env.APNS_KEY ?? "").replace(/\\n/g, "\n"));
  const sig = sign("sha256", Buffer.from(`${head}.${claims}`), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  token = { jwt: `${head}.${claims}.${sig}`, at: Date.now() };
  return token.jwt;
}

// Sends to every device token; returns the ones Apple says are gone
// (app deleted, notifications turned off for good).
export async function sendApns(items: { token: string; msg: ApnsMessage }[]): Promise<string[]> {
  if (!items.length || !apnsReady()) return [];
  const host = process.env.APNS_SANDBOX === "1" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const topic = process.env.APNS_BUNDLE_ID || "io.mytoptrack.app";
  const gone: string[] = [];
  let session: ClientHttp2Session;
  try {
    session = connect(host);
  } catch {
    return [];
  }
  session.on("error", () => {});
  const auth = `bearer ${bearer()}`;
  await Promise.all(
    items.map(
      ({ token: device, msg }) =>
        new Promise<void>((done) => {
          const req = session.request({
            ":method": "POST",
            ":path": `/3/device/${device}`,
            authorization: auth,
            "apns-topic": topic,
            "apns-push-type": "alert",
            "apns-priority": "10",
            "apns-expiration": String(Math.floor(Date.now() / 1000) + 3 * 60 * 60),
            "apns-collapse-id": msg.tag.slice(0, 64),
            "content-type": "application/json",
          });
          let status = 0;
          let reply = "";
          req.setEncoding("utf8");
          req.on("response", (h) => void (status = Number(h[":status"])));
          req.on("data", (c) => void (reply += c));
          req.on("end", () => {
            if (status === 410 || (status === 400 && /BadDeviceToken|DeviceTokenNotForTopic/.test(reply))) gone.push(device);
            done();
          });
          req.on("error", () => done());
          req.setTimeout(10_000, () => {
            req.close();
            done();
          });
          req.end(
            JSON.stringify({
              aps: { alert: { title: msg.title, body: msg.body }, sound: "default", "thread-id": msg.tag },
              url: msg.url,
            }),
          );
        }),
    ),
  );
  session.close();
  return gone;
}
