import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/env";
import { adminEmails, loadStats, type Stats } from "@/lib/admin";
import { BarChart, Columns, HBars, LineChart, Spark } from "./Charts";
import { People } from "./People";
import { ADMIN_CSS } from "./style";

// TopTrack's private numbers: users, growth, engagement, retention, music.
// Only people whose email is in ADMIN_EMAILS (a Vercel environment variable)
// can open it; everyone else gets the ordinary 404, so the page doesn't even
// show it exists. Read-only.

export const metadata: Metadata = {
  title: "TopTrack admin",
  robots: { index: false, follow: false },
};

const RANGES = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "all", label: "All time", days: null },
] as const;

const C = { blue: "var(--s1)", orange: "var(--s2)", aqua: "var(--s3)" };

function Delta({ now, before, suffix = "vs last week" }: { now: number; before: number; suffix?: string }) {
  if (!before && !now) return <span className="delta flat">No change {suffix}</span>;
  if (!before) return <span className="delta up">▲ New {suffix}</span>;
  const pct = ((now - before) / before) * 100;
  const cls = Math.abs(pct) < 0.5 ? "flat" : pct > 0 ? "up" : "down";
  return (
    <span className={`delta ${cls}`}>
      {cls === "up" ? "▲" : cls === "down" ? "▼" : "■"} {Math.abs(pct).toFixed(0)}% {suffix}
    </span>
  );
}

function Kpi({ label, value, children, hint }: { label: string; value: string; children?: React.ReactNode; hint?: string }) {
  return (
    <div className="kpi" title={hint}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {children}
    </div>
  );
}

const n = (v: number) => v.toLocaleString("en-US");
const pct = (v: number) => `${Math.round(v * 100)}%`;
const hourLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);
const weekLabel = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  if (!isConfigured) notFound();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email.toLowerCase() : null;
  if (!email || !adminEmails().includes(email)) notFound();

  const { range: rangeKey } = await searchParams;
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[0];
  const s = await loadStats(range.days);

  return (
    <div className="adm">
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
      <header className="top">
        <div>
          <h1>TopTrack dashboard</h1>
          <p className="muted">
            {s
              ? `Live from the database · updated ${new Date(s.generatedAt).toLocaleTimeString("en-US", { timeZone: s.tz, hour: "numeric", minute: "2-digit" })} · days in ${s.tz.replace("_", " ")}`
              : "Not connected"}
          </p>
        </div>
        <nav className="seg" aria-label="Date range">
          {RANGES.map((r) => (
            <a key={r.key} href={`/admin?range=${r.key}`} aria-current={r.key === range.key ? "page" : undefined}>
              {r.label}
            </a>
          ))}
        </nav>
      </header>
      {s ? <Body s={s} /> : <p className="card">SUPABASE_SECRET_KEY isn&apos;t set in Vercel, so the dashboard can&apos;t read the database.</p>}
    </div>
  );
}

function Body({ s }: { s: Stats & object }) {
  const k = s.kpis;
  const posts = s.engagement[0];
  return (
    <main>
      <section className="kpis">
        <Kpi label="Total users" value={n(k.totalUsers)} hint="People with a finished profile">
          <span className="sub">{k.authOnly ? `+${n(k.authOnly)} signed in but never finished a profile` : "Everyone finished their profile"}</span>
        </Kpi>
        <Kpi label="New users, last 7 days" value={n(k.newThisWeek)}>
          <Delta now={k.newThisWeek} before={k.newLastWeek} />
        </Kpi>
        <Kpi label="Active today" value={n(k.dau)} hint="Posted, liked, noted, chatted, crowned, saved or followed today">
          <Delta now={k.dau} before={k.dauYesterday} suffix="vs yesterday" />
        </Kpi>
        <Kpi label="Active, last 7 days" value={n(k.wau)}>
          <Delta now={k.wau} before={k.wauLastWeek} />
        </Kpi>
        <Kpi label="Active, last 30 days" value={n(k.mau)}>
          <Delta now={k.mau} before={k.mauLastMonth} suffix="vs prior 30 days" />
        </Kpi>
        <Kpi label="Weekly / monthly active" value={pct(k.stickiness)} hint="Share of this month's active people who were active this week. Higher means more of them come back every week.">
          <span className="sub">How sticky TopTrack is</span>
        </Kpi>
        <Kpi label="Songs posted, last 7 days" value={n(k.postsThisWeek)}>
          <Delta now={k.postsThisWeek} before={k.postsLastWeek} />
        </Kpi>
        <Kpi label="Crowns, last 7 days" value={n(k.crownsThisWeek)}>
          <Delta now={k.crownsThisWeek} before={k.crownsLastWeek} />
        </Kpi>
      </section>

      <h2>Growth</h2>
      <section className="grid two">
        <div className="card">
          <h3>Total users</h3>
          <LineChart series={[{ label: "Total users", color: C.blue, points: s.totalUsers }]} area />
        </div>
        <div className="card">
          <h3>
            New users per day <span className="muted">· {n(s.signups.total)} in this range</span>
          </h3>
          <BarChart points={s.signups.points} label="New users" color={C.blue} />
        </div>
      </section>

      <h2>Engagement</h2>
      <section className="card">
        <h3>Active people</h3>
        <p className="muted small">
          Daily = active that day. 7-day and 30-day = anyone active in the window ending that day.
        </p>
        <LineChart
          series={[
            { label: "Daily", color: C.blue, points: s.activity.dau },
            { label: "7-day", color: C.orange, points: s.activity.wau },
            { label: "30-day", color: C.aqua, points: s.activity.mau },
          ]}
          height={240}
        />
      </section>
      <section className="grid two">
        <div className="card">
          <h3>
            Songs posted per day <span className="muted">· {n(posts.total)} in this range</span>
          </h3>
          <BarChart points={posts.points} label="Songs posted" color={C.orange} />
        </div>
        <div className="card">
          <h3>Share of users who post each day</h3>
          <LineChart
            series={[
              {
                label: "Posted that day",
                color: C.orange,
                points: posts.points.map((p, i) => ({
                  day: p.day,
                  value: s.totalUsers[i].value ? Math.round((p.value / s.totalUsers[i].value) * 1000) / 10 : 0,
                })),
              },
            ]}
            area
          />
          <p className="muted small">Percent of all users with a profile by that day.</p>
        </div>
      </section>
      <section className="multiples">
        {s.engagement.map((e) => (
          <div className="card mini" key={e.key}>
            <div className="mini-head">
              <span>{e.label}</span>
              <b>{n(e.total)}</b>
            </div>
            <Spark points={e.points} color={C.blue} />
          </div>
        ))}
      </section>

      <h2>Retention</h2>
      <section className="grid two">
        <div className="card">
          <h3>Weekly cohorts</h3>
          <p className="muted small">People grouped by the week they joined, and the share active in each week after.</p>
          <div className="table-wrap">
            <table className="cohort">
              <thead>
                <tr>
                  <th>Joined week of</th>
                  <th className="num">People</th>
                  {Array.from({ length: 8 }, (_, i) => (
                    <th key={i} className="num">
                      {i === 0 ? "Wk 0" : `+${i}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.cohorts.map((c) => (
                  <tr key={c.week}>
                    <td>{weekLabel(c.week)}</td>
                    <td className="num">{c.size}</td>
                    {c.cells.map((v, i) =>
                      v === null ? (
                        <td key={i} />
                      ) : (
                        <td
                          key={i}
                          className={`num heat${v >= 0.55 ? " on-dark" : ""}`}
                          style={{ ["--v" as string]: v }}
                          title={`${pct(v)} of the ${c.size} who joined the week of ${weekLabel(c.week)} were active ${i ? `${i} week${i > 1 ? "s" : ""} later` : "that week"}`}
                        >
                          {pct(v)}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>Signup funnel</h3>
          <p className="muted small">All time. Each step counts people who ever did it.</p>
          <HBars rows={s.funnel.map((f, i) => ({ label: f.label, value: f.value, sub: i && s.funnel[0].value ? pct(f.value / s.funnel[0].value) : undefined }))} color={C.blue} />
          <div className="facts">
            <span>
              <b>{n(s.dormant)}</b> gone quiet (nothing in 14+ days)
            </span>
            <span>
              <b>{n(s.neverActive)}</b> never did anything after signing up
            </span>
          </div>
        </div>
      </section>

      <h2>Habits</h2>
      <section className="grid three">
        <div className="card">
          <h3>Current streaks</h3>
          <Columns rows={s.streakBuckets} color={C.orange} label="People" />
          <p className="muted small">Days in a row posting, by each person&apos;s own calendar.</p>
        </div>
        <div className="card">
          <h3>When songs get posted</h3>
          <Columns rows={s.hours.map((h, i) => ({ label: hourLabel(i), value: h.value }))} color={C.blue} label="Songs" />
          <p className="muted small">Hour of day, {s.tz.replace("_", " ")} time. All time.</p>
        </div>
        <div className="card">
          <h3>Busiest weekdays</h3>
          <Columns rows={s.weekdays} color={C.blue} label="Songs" />
          <p className="muted small">Songs posted, all time.</p>
        </div>
      </section>
      <section className="grid three">
        <div className="card">
          <h3>Notifications on</h3>
          <HBars
            rows={[
              { label: "iPhone app", value: s.pushUsers.app },
              { label: "Web", value: s.pushUsers.web },
              { label: "Off", value: s.pushUsers.none },
            ]}
            color={C.aqua}
          />
        </div>
        <div className="card">
          <h3>Network</h3>
          <div className="facts big">
            <span>
              <b>{k.avgFollowing.toFixed(1)}</b> friends added per person
            </span>
            <span>
              <b>{n(k.totalPosts)}</b> songs posted ever
            </span>
            <span>
              <b>{n(k.totalCrowns)}</b> crowns given ever
            </span>
          </div>
        </div>
        <div className="card">
          <h3>Likes, last 7 days</h3>
          <div className="kpi-value">{n(k.likesThisWeek)}</div>
          <Delta now={k.likesThisWeek} before={k.likesLastWeek} />
        </div>
      </section>

      <h2>Music</h2>
      <section className="grid three">
        <div className="card">
          <h3>Top artists</h3>
          {s.topArtists.length ? <HBars rows={s.topArtists} color={C.orange} /> : <p className="muted">No songs in this range.</p>}
        </div>
        <div className="card">
          <h3>Most posted songs</h3>
          <SongList rows={s.topSongs.map((t) => ({ ...t, sub: t.artist, value: `${t.value}×` }))} />
        </div>
        <div className="card">
          <h3>Most crowned songs</h3>
          <SongList rows={s.mostCrowned.map((t) => ({ ...t, sub: `${t.artist} · @${t.by}`, value: `${t.value} 👑` }))} />
        </div>
      </section>

      <h2>People</h2>
      <section className="card">
        <People people={s.people} />
      </section>
      <p className="muted small foot">
        &quot;Active&quot; means posted, liked, left a note, chatted, crowned, saved or added a friend. Just opening the app isn&apos;t recorded yet.
      </p>
    </main>
  );
}

function SongList({ rows }: { rows: { title: string; sub: string; artwork: string | null; value: string }[] }) {
  if (!rows.length) return <p className="muted">Nothing in this range yet.</p>;
  return (
    <ol className="songs">
      {rows.map((r, i) => (
        <li key={i}>
          {r.artwork ? <img src={r.artwork} alt="" loading="lazy" /> : <span className="noart" />}
          <span className="song">
            <b>{r.title}</b>
            <small>{r.sub}</small>
          </span>
          <span className="val">{r.value}</span>
        </li>
      ))}
    </ol>
  );
}
