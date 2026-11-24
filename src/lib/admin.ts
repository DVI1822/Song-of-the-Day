import "server-only";
import { createClient as createAdmin, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./supabase/env";
import { addDays, streak, todayIn } from "./day";

// The numbers behind /admin. Everything is read with the secret key (so it
// sees every row, past the usual privacy rules) and only ever on the server,
// for the people listed in ADMIN_EMAILS. Nothing here writes.
//
// It reads whole tables and counts in JavaScript, which is simple and fine
// for thousands of rows. Past roughly 100k posts, move the counting into SQL.

export const ADMIN_TZ = process.env.ADMIN_TZ || "America/Denver";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.replace(/^["'<]+|[">']+$/g, "").trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: unknown): boolean {
  return typeof email === "string" && adminEmails().includes(email.trim().toLowerCase());
}

function admin(): SupabaseClient | null {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) return null;
  return createAdmin(supabaseUrl, key, { auth: { persistSession: false } });
}

// Every row of a table, 1000 at a time (the most PostgREST hands back at once).
// A table that doesn't exist yet (a migration not run) reads as empty.
async function all<T>(db: SupabaseClient, table: string, cols: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(cols).range(from, from + 999);
    if (error) {
      if (from === 0) console.warn(`admin: couldn't read ${table}: ${error.message}`);
      break;
    }
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function authUsers(db: SupabaseClient) {
  const out: { id: string; email: string | null; created_at: string; last_sign_in_at: string | null }[] = [];
  for (let page = 1; page < 200; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    for (const u of data.users)
      out.push({ id: u.id, email: u.email ?? null, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null });
    if (data.users.length < 1000) break;
  }
  return out;
}

type Row = { user_id: string; created_at: string };
type Profile = { id: string; username: string; display_name: string; timezone: string; created_at: string };
type PostRow = Row & { id: string; day: string; title: string; artist: string; artwork_url: string | null };
type Vote = { voter_id: string; poster_id: string; post_id: string; created_at: string };
type Msg = Row & { to_id: string | null };
type Follow = { follower_id: string; following_id: string; created_at: string };
type Push = { user_id: string; endpoint: string };

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: ADMIN_TZ });
const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: ADMIN_TZ, hour: "numeric", hourCycle: "h23" });
const dayOf = (iso: string) => dayFmt.format(new Date(iso));
const hourOf = (iso: string) => Number(hourFmt.format(new Date(iso))) % 24;

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86_400_000);
}

// Monday of the week a day falls in.
function weekOf(day: string) {
  const d = new Date(day + "T12:00:00Z");
  return addDays(day, -((d.getUTCDay() + 6) % 7));
}

export type Point = { day: string; value: number };
export type Series = { key: string; label: string; points: Point[]; total: number };

export type Stats = Awaited<ReturnType<typeof loadStats>>;

export async function loadStats(rangeDays: number | null) {
  const db = admin();
  if (!db) return null;

  const [users, profiles, posts, feels, notes, messages, votes, saves, follows, redos, pushes] = await Promise.all([
    authUsers(db),
    all<Profile>(db, "profiles", "id, username, display_name, timezone, created_at"),
    all<PostRow>(db, "posts", "id, user_id, day, created_at, title, artist, artwork_url"),
    all<Row>(db, "feels", "user_id, created_at"),
    all<Row>(db, "notes", "user_id, created_at"),
    all<Msg>(db, "messages", "user_id, to_id, created_at"),
    all<Vote>(db, "votes", "voter_id, poster_id, post_id, created_at"),
    all<Row>(db, "saves", "user_id, created_at"),
    all<Follow>(db, "follows", "follower_id, following_id, created_at"),
    all<Row>(db, "post_redos", "user_id, created_at"),
    all<Push>(db, "push_subs", "user_id, endpoint"),
  ]);

  const today = todayIn(ADMIN_TZ);
  const profileOf = new Map(profiles.map((p) => [p.id, p]));
  const firstDay = profiles.reduce((m, p) => (dayOf(p.created_at) < m ? dayOf(p.created_at) : m), today);
  const start = rangeDays ? addDays(today, -(rangeDays - 1)) : firstDay;
  const days: string[] = [];
  for (let d = start; d <= today; d = addDays(d, 1)) days.push(d);

  // --- who did anything, on which day -----------------------------------------
  // "Active" = posted, liked, left a note, chatted, crowned, saved or followed.
  const active = new Map<string, Set<string>>(); // day -> user ids
  const touch = (user: string, iso: string) => {
    const d = dayOf(iso);
    let s = active.get(d);
    if (!s) active.set(d, (s = new Set()));
    s.add(user);
  };
  for (const r of posts) touch(r.user_id, r.created_at);
  for (const r of feels) touch(r.user_id, r.created_at);
  for (const r of notes) touch(r.user_id, r.created_at);
  for (const r of messages) touch(r.user_id, r.created_at);
  for (const r of votes) touch(r.voter_id, r.created_at);
  for (const r of saves) touch(r.user_id, r.created_at);
  for (const r of follows) touch(r.follower_id, r.created_at);

  const activeIn = (from: string, to: string) => {
    const s = new Set<string>();
    for (let d = from; d <= to; d = addDays(d, 1)) for (const u of active.get(d) ?? []) s.add(u);
    return s.size;
  };
  const dau = (d: string) => active.get(d)?.size ?? 0;
  const wau = (d: string) => activeIn(addDays(d, -6), d);
  const mau = (d: string) => activeIn(addDays(d, -29), d);

  // --- per day counts ------------------------------------------------------------
  const perDay = (rows: { created_at: string }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const d = dayOf(r.created_at);
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  };
  const series = (key: string, label: string, rows: { created_at: string }[]): Series => {
    const m = perDay(rows);
    const points = days.map((day) => ({ day, value: m.get(day) ?? 0 }));
    return { key, label, points, total: points.reduce((a, p) => a + p.value, 0) };
  };

  const signups = series("signups", "New users", profiles);
  let running = profiles.filter((p) => dayOf(p.created_at) < start).length;
  const totalUsers = signups.points.map((p) => ({ day: p.day, value: (running += p.value) }));

  const activity = {
    dau: days.map((day) => ({ day, value: dau(day) })),
    wau: days.map((day) => ({ day, value: wau(day) })),
    mau: days.map((day) => ({ day, value: mau(day) })),
  };

  const engagement: Series[] = [
    series("posts", "Songs posted", posts),
    series("votes", "Crowns given", votes),
    series("feels", "Likes", feels),
    series("notes", "Notes on songs", notes),
    series("messages", "Chat messages", messages),
    series("saves", "Songs saved", saves),
    series("follows", "Follows", follows),
    series("redos", "Redos", redos),
  ];

  // --- headline numbers, with the same span just before for comparison -------------
  const countIn = (rows: { created_at: string }[], from: string, to: string) =>
    rows.reduce((n, r) => {
      const d = dayOf(r.created_at);
      return d >= from && d <= to ? n + 1 : n;
    }, 0);
  const wkFrom = addDays(today, -6);
  const prevFrom = addDays(today, -13);
  const prevTo = addDays(today, -7);
  const mauNow = mau(today);
  const kpis = {
    totalUsers: profiles.length,
    authOnly: users.filter((u) => !profileOf.has(u.id)).length,
    newThisWeek: countIn(profiles, wkFrom, today),
    newLastWeek: countIn(profiles, prevFrom, prevTo),
    dau: dau(today),
    dauYesterday: dau(addDays(today, -1)),
    wau: wau(today),
    wauLastWeek: wau(prevTo),
    mau: mauNow,
    mauLastMonth: mau(addDays(today, -30)),
    stickiness: mauNow ? wau(today) / mauNow : 0,
    postsToday: posts.filter((p) => dayOf(p.created_at) === today).length,
    postsThisWeek: countIn(posts, wkFrom, today),
    postsLastWeek: countIn(posts, prevFrom, prevTo),
    crownsThisWeek: countIn(votes, wkFrom, today),
    crownsLastWeek: countIn(votes, prevFrom, prevTo),
    likesThisWeek: countIn(feels, wkFrom, today),
    likesLastWeek: countIn(feels, prevFrom, prevTo),
    totalPosts: posts.length,
    totalCrowns: votes.length,
    avgFollowing: profiles.length ? follows.length / profiles.length : 0,
  };

  // --- streaks (each person's own calendar) -------------------------------------------
  const postDays = new Map<string, string[]>();
  for (const p of posts) {
    const a = postDays.get(p.user_id);
    if (a) a.push(p.day);
    else postDays.set(p.user_id, [p.day]);
  }
  const longest = (ds: string[]) => {
    const sorted = [...new Set(ds)].sort();
    let best = 0, run = 0;
    sorted.forEach((d, i) => {
      run = i > 0 && daysBetween(sorted[i - 1], d) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
    });
    return best;
  };
  const streakRows = profiles.map((p) => {
    const ds = postDays.get(p.id) ?? [];
    return { id: p.id, current: streak(ds, todayIn(p.timezone)), longest: longest(ds), daysPosted: new Set(ds).size };
  });
  const streakBuckets = [
    { label: "0", test: (n: number) => n === 0 },
    { label: "1", test: (n: number) => n === 1 },
    { label: "2–3", test: (n: number) => n >= 2 && n <= 3 },
    { label: "4–6", test: (n: number) => n >= 4 && n <= 6 },
    { label: "7–13", test: (n: number) => n >= 7 && n <= 13 },
    { label: "14–29", test: (n: number) => n >= 14 && n <= 29 },
    { label: "30+", test: (n: number) => n >= 30 },
  ].map((b) => ({ label: b.label, value: streakRows.filter((r) => b.test(r.current)).length }));

  // --- funnel -----------------------------------------------------------------------
  const posters = new Set(posts.map((p) => p.user_id));
  const followers = new Set(follows.map((f) => f.follower_id));
  const crowners = new Set(votes.map((v) => v.voter_id));
  const funnel = [
    { label: "Signed up (email confirmed)", value: users.length },
    { label: "Finished their profile", value: profiles.length },
    { label: "Added a friend", value: profiles.filter((p) => followers.has(p.id)).length },
    { label: "Posted a song", value: profiles.filter((p) => posters.has(p.id)).length },
    { label: "Crowned a song", value: profiles.filter((p) => crowners.has(p.id)).length },
    { label: "Posted on 3+ days", value: streakRows.filter((r) => r.daysPosted >= 3).length },
    { label: "Posted on 7+ days", value: streakRows.filter((r) => r.daysPosted >= 7).length },
  ];

  // --- weekly retention: of the people who joined in a week, the share active N weeks later
  const activeWeeks = new Map<string, Set<string>>(); // user -> week starts
  for (const [d, us] of active)
    for (const u of us) {
      let s = activeWeeks.get(u);
      if (!s) activeWeeks.set(u, (s = new Set()));
      s.add(weekOf(d));
    }
  const thisWeek = weekOf(today);
  const cohortMap = new Map<string, string[]>();
  for (const p of profiles) {
    const w = weekOf(dayOf(p.created_at));
    const a = cohortMap.get(w);
    if (a) a.push(p.id);
    else cohortMap.set(w, [p.id]);
  }
  const WEEKS = 8;
  const cohorts = [...cohortMap.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 10)
    .map(([week, ids]) => {
      const cells: (number | null)[] = [];
      for (let n = 0; n < WEEKS; n++) {
        const w = addDays(week, 7 * n);
        if (w > thisWeek) cells.push(null);
        else cells.push(ids.filter((id) => activeWeeks.get(id)?.has(w)).length / ids.length);
      }
      return { week, size: ids.length, cells };
    });

  // --- when people post (Derek's clock) and which weekday ---------------------------------
  const hours = Array.from({ length: 24 }, (_, h) => ({ label: String(h), value: 0 }));
  for (const p of posts) hours[hourOf(p.created_at)].value++;
  const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekdays = WD.map((label) => ({ label, value: 0 }));
  for (const p of posts) weekdays[(new Date(p.day + "T12:00:00Z").getUTCDay() + 6) % 7].value++;

  // --- music ---------------------------------------------------------------------------
  const rangePosts = posts.filter((p) => p.day >= start);
  const tally = <K,>(items: K[], key: (k: K) => string) => {
    const m = new Map<string, { n: number; item: K }>();
    for (const it of items) {
      const k = key(it);
      const e = m.get(k);
      if (e) e.n++;
      else m.set(k, { n: 1, item: it });
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  };
  const norm = (s: string) => s.toLowerCase().trim();
  const topArtists = tally(rangePosts, (p) => norm(p.artist)).slice(0, 10).map((e) => ({ label: e.item.artist, value: e.n }));
  const topSongs = tally(rangePosts, (p) => norm(p.title) + "|" + norm(p.artist))
    .slice(0, 10)
    .map((e) => ({ title: e.item.title, artist: e.item.artist, artwork: e.item.artwork_url, value: e.n }));
  const crownsByPost = tally(votes.filter((v) => dayOf(v.created_at) >= start), (v) => v.post_id).slice(0, 10);
  const postById = new Map(posts.map((p) => [p.id, p]));
  const mostCrowned = crownsByPost
    .map((e) => ({ post: postById.get(e.item.post_id), value: e.n }))
    .filter((e) => e.post)
    .map((e) => ({ title: e.post!.title, artist: e.post!.artist, artwork: e.post!.artwork_url, by: profileOf.get(e.post!.user_id)?.username ?? "?", day: e.post!.day, value: e.value }));

  // --- people ----------------------------------------------------------------------------
  const lastActive = new Map<string, string>();
  for (const [d, us] of active) for (const u of us) if ((lastActive.get(u) ?? "") < d) lastActive.set(u, d);
  const crownsGot = new Map<string, number>();
  for (const v of votes) crownsGot.set(v.poster_id, (crownsGot.get(v.poster_id) ?? 0) + 1);
  const followerCount = new Map<string, number>();
  for (const f of follows) followerCount.set(f.following_id, (followerCount.get(f.following_id) ?? 0) + 1);
  const streakOf = new Map(streakRows.map((r) => [r.id, r]));
  const emailOf = new Map(users.map((u) => [u.id, u.email]));
  const lastSignIn = new Map(users.map((u) => [u.id, u.last_sign_in_at]));
  const pushOf = new Map<string, Set<string>>();
  for (const s of pushes) {
    let set = pushOf.get(s.user_id);
    if (!set) pushOf.set(s.user_id, (set = new Set()));
    set.add(s.endpoint.startsWith("apns:") ? "iPhone app" : "Web");
  }
  const people = profiles
    .map((p) => {
      const s = streakOf.get(p.id)!;
      return {
        username: p.username,
        name: p.display_name,
        email: emailOf.get(p.id) ?? null,
        joined: dayOf(p.created_at),
        lastActive: lastActive.get(p.id) ?? null,
        lastSignIn: lastSignIn.get(p.id) ? dayOf(lastSignIn.get(p.id)!) : null,
        daysPosted: s.daysPosted,
        streak: s.current,
        longest: s.longest,
        crowns: crownsGot.get(p.id) ?? 0,
        followers: followerCount.get(p.id) ?? 0,
        push: [...(pushOf.get(p.id) ?? [])].join(", "),
        timezone: p.timezone,
      };
    })
    .sort((a, b) => (a.joined < b.joined ? 1 : -1));

  const pushUsers = {
    app: [...pushOf.values()].filter((s) => s.has("iPhone app")).length,
    web: [...pushOf.values()].filter((s) => s.has("Web")).length,
    none: profiles.length - pushOf.size,
  };

  // dormant: active before, nothing in the last 14 days
  const dormant = people.filter((p) => p.lastActive && daysBetween(p.lastActive, today) > 14).length;
  const neverActive = people.filter((p) => !p.lastActive).length;

  return {
    generatedAt: new Date().toISOString(),
    tz: ADMIN_TZ,
    today,
    start,
    kpis,
    totalUsers,
    signups,
    activity,
    engagement,
    streakBuckets,
    funnel,
    cohorts,
    hours,
    weekdays,
    topArtists,
    topSongs,
    mostCrowned,
    people,
    pushUsers,
    dormant,
    neverActive,
  };
}
