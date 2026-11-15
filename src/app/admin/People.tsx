"use client";

import { useMemo, useState } from "react";

export type Person = {
  username: string;
  name: string;
  email: string | null;
  joined: string;
  lastActive: string | null;
  lastSignIn: string | null;
  daysPosted: number;
  streak: number;
  longest: number;
  crowns: number;
  followers: number;
  push: string;
  timezone: string;
};

const COLS: { key: keyof Person; label: string; num?: boolean }[] = [
  { key: "name", label: "Name" },
  { key: "joined", label: "Joined" },
  { key: "lastActive", label: "Last active" },
  { key: "daysPosted", label: "Days posted", num: true },
  { key: "streak", label: "Streak", num: true },
  { key: "longest", label: "Best streak", num: true },
  { key: "crowns", label: "Crowns won", num: true },
  { key: "followers", label: "Followers", num: true },
  { key: "push", label: "Notifications" },
];

const short = (d: string | null) =>
  d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" }) : "—";

export function People({ people }: { people: Person[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: keyof Person; desc: boolean }>({ key: "joined", desc: true });
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? people.filter((p) => [p.name, p.username, p.email ?? ""].some((s) => s.toLowerCase().includes(needle)))
      : people;
    return [...list].sort((a, b) => {
      const x = a[sort.key] ?? "";
      const y = b[sort.key] ?? "";
      const c = x < y ? -1 : x > y ? 1 : 0;
      return sort.desc ? -c : c;
    });
  }, [people, q, sort]);
  const shown = showAll ? rows : rows.slice(0, 25);

  const csv = () => {
    const head = ["username", "name", "email", "joined", "last_active", "last_sign_in", "days_posted", "streak", "best_streak", "crowns_won", "followers", "notifications", "timezone"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const body = rows.map((p) =>
      [p.username, p.name, p.email, p.joined, p.lastActive, p.lastSignIn, p.daysPosted, p.streak, p.longest, p.crowns, p.followers, p.push, p.timezone].map(esc).join(","),
    );
    const url = URL.createObjectURL(new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `toptrack-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="table-tools">
        <input type="search" placeholder="Search name, handle or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted">{rows.length.toLocaleString("en-US")} people</span>
        <button onClick={csv}>Download CSV</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className={c.num ? "num" : undefined}
                  aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : undefined}
                >
                  <button onClick={() => setSort((s) => ({ key: c.key, desc: s.key === c.key ? !s.desc : true }))}>
                    {c.label}
                    {sort.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.username}>
                <td>
                  <a href={`/u/${p.username}`} className="who">
                    <b>{p.name}</b>
                    <small>
                      @{p.username}
                      {p.email ? ` · ${p.email}` : ""}
                    </small>
                  </a>
                </td>
                <td>{short(p.joined)}</td>
                <td>{short(p.lastActive)}</td>
                <td className="num">{p.daysPosted}</td>
                <td className="num">{p.streak ? `${p.streak} 🔥` : 0}</td>
                <td className="num">{p.longest}</td>
                <td className="num">{p.crowns}</td>
                <td className="num">{p.followers}</td>
                <td>{p.push || <span className="muted">Off</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 25 && (
        <button className="more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${rows.length.toLocaleString("en-US")}`}
        </button>
      )}
    </div>
  );
}
