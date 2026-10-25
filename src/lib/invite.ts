// Invite links: /join/<username>. Whoever signs up through one lands on the
// inviter's globe (and the inviter on theirs). The inviter's username waits
// in a cookie until their profile is made.

export const INVITE_COOKIE = "sotd-invite";
export const INVITE_MAX_AGE = 60 * 60 * 24 * 7;

export const cleanInvite = (v: string | null | undefined) => {
  const u = (v ?? "").trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_]{3,20}$/.test(u) ? u : null;
};

export const inviteUrl = (origin: string, username: string) => `${origin}/join/${username}`;
