"use client";

import { useState, useSyncExternalStore } from "react";
import type { ContactMatch } from "@/app/actions";
import { initials } from "@/lib/day";
import { inviteUrl } from "@/lib/invite";
import type { Friend } from "@/lib/types";
import type { GlobeApi } from "./api";

// Top of Find a friend: your invite link, and (where the phone allows it)
// your contacts, split into who's already here and who to invite.
// Browsers only let a site read contacts the person picks, and only Chrome on
// Android does it at all; iPhone gets the share sheet.

type Picked = { name: string; email?: string; tel?: string };
type ContactsApi = {
  select(
    props: string[],
    opts: { multiple: boolean },
  ): Promise<{ name?: string[]; email?: string[]; tel?: string[] }[]>;
};
const contactsApi = () =>
  typeof navigator !== "undefined" ? ((navigator as Navigator & { contacts?: ContactsApi }).contacts ?? null) : null;
const noop = () => () => {};

export function InviteCard({
  api,
  username,
  firstName,
  friends,
  onFollowed,
}: {
  api: GlobeApi;
  username: string;
  firstName: string;
  friends: Friend[];
  onFollowed(f: Friend): void;
}) {
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
  const canPick = useSyncExternalStore(
    noop,
    () => Boolean(contactsApi()),
    () => false,
  );
  const [copied, setCopied] = useState(false);
  const [picked, setPicked] = useState<Picked[] | null>(null);
  const [here, setHere] = useState<ContactMatch[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const link = inviteUrl(origin, username);
  const message = `Share your Song of the Day with the world: ${link}`;

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: "Song of the Day", text: message }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const pick = async () => {
    setError(null);
    const c = contactsApi();
    if (!c) return;
    const rows = await c.select(["name", "email", "tel"], { multiple: true }).catch(() => null);
    if (!rows?.length) return;
    const list: Picked[] = rows.map((r) => ({
      name: r.name?.[0] || r.email?.[0] || r.tel?.[0] || "Friend",
      email: r.email?.[0]?.toLowerCase(),
      tel: r.tel?.[0],
    }));
    setBusy("pick");
    const emails = rows.flatMap((r) => r.email ?? []);
    setHere(emails.length ? await api.matchContacts(emails) : []);
    setBusy(null);
    setPicked(list);
  };

  const add = async (p: ContactMatch) => {
    setBusy(p.id);
    setError(null);
    const r = await api.follow(p.id);
    setBusy(null);
    if (r.friend) {
      onFollowed(r.friend);
      setHere((h) => h.map((x) => (x.id === p.id ? { ...x, following: true } : x)));
    } else setError(r.error ?? "Couldn't add them. Try again.");
  };

  const hereEmails = new Set(here.map((h) => h.email));
  const toInvite = (picked ?? []).filter((p) => !(p.email && hereEmails.has(p.email)) && (p.tel || p.email));
  const inviteHref = (p: Picked) =>
    p.tel
      ? `sms:${p.tel.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(message)}`
      : `mailto:${p.email}?subject=${encodeURIComponent(`${firstName} invited you to Song of the Day`)}&body=${encodeURIComponent(message)}`;

  const pill = "flex h-9 flex-none items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold";

  return (
    <div className="px-3.5 pb-1">
      {/* the ticket: your link, torn off and handed over */}
      <div
        className="relative overflow-hidden rounded-[20px] p-3.5"
        style={{ background: "linear-gradient(135deg, #FFF3E6 0%, #FFE1D6 45%, #DDF2EE 100%)" }}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Bring your people</div>
            <div className="truncate text-[11px] text-muted">
              {origin ? link.replace(/^https?:\/\//, "") : `/join/${username}`}
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2 border-t border-dashed border-card-ink/20 pt-3">
          <button type="button" onClick={share} className={`${pill} bg-accent text-white`}>
            <ShareIcon />
            {copied ? "Link copied" : "Share invite"}
          </button>
          {canPick && (
            <button
              type="button"
              onClick={pick}
              disabled={busy === "pick"}
              className={`${pill} bg-white/70 disabled:opacity-60`}
            >
              <PeopleIcon />
              {busy === "pick" ? "Looking…" : "From contacts"}
            </button>
          )}
        </div>
      </div>

      {picked && (
        <div className="pt-2">
          {here.length > 0 && (
            <div className="px-0.5 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Already here · {here.length}
            </div>
          )}
          {here.map((p) => {
            const on = p.following || friends.some((f) => f.id === p.id);
            return (
              <div key={p.id} className="flex h-[54px] items-center gap-3">
                <Avatar name={p.display_name} />
                <div className="flex min-w-0 flex-1 flex-col gap-px">
                  <div className="truncate text-sm font-semibold">{p.display_name}</div>
                  <div className="truncate text-xs text-muted">@{p.username}</div>
                </div>
                {on ? (
                  <span className="text-xs font-semibold text-muted">On your globe</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => add(p)}
                    disabled={busy === p.id}
                    className={`${pill} bg-accent text-white disabled:opacity-60`}
                  >
                    Add
                  </button>
                )}
              </div>
            );
          })}
          {toInvite.length > 0 && (
            <div className="px-0.5 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Not here yet · {toInvite.length}
            </div>
          )}
          {toInvite.map((p, i) => (
            <div key={`${p.name}-${i}`} className="flex h-[50px] items-center gap-3">
              <div className="box-border flex h-9 w-9 flex-none items-center justify-center rounded-full border border-dashed border-muted text-[10px] font-semibold text-muted">
                {initials(p.name)}
              </div>
              <div className="min-w-0 flex-1 truncate text-sm">{p.name}</div>
              <a href={inviteHref(p)} className={`${pill} border border-card-ink/20`}>
                Invite
              </a>
            </div>
          ))}
          {!here.length && !toInvite.length && (
            <p className="py-3 text-xs text-muted">Those contacts have no email or number to invite.</p>
          )}
          {error && <p className="pt-1 text-xs text-accent-deep">{error}</p>}
        </div>
      )}
    </div>
  );
}

const Avatar = ({ name }: { name: string }) => (
  <div
    className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[11px] font-semibold"
    style={{ background: "linear-gradient(135deg, #DDE3F5, #A9DCD6)", color: "#245866" }}
  >
    {initials(name)}
  </div>
);

const ShareIcon = () => (
  <svg
    aria-hidden
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" />
  </svg>
);
const PeopleIcon = () => (
  <svg
    aria-hidden
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.5 3.5 0 010 6.4M18.5 14.8c1.6.8 2.6 2.5 3 5.2" />
  </svg>
);
