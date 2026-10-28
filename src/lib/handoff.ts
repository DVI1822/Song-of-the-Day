// Signing in a home-screen app from an email link (see the sign_in_handoff
// migration). The screen that asks for the link remembers a random id; the
// link carries it; whichever browser opens the link leaves the sign-in under
// it, and the waiting screen picks it up.

const KEY = "sotd-handoff";
const LIFE = 15 * 60_000;

export function newHandoff(): string {
  const id = crypto.randomUUID();
  try {
    localStorage.setItem(KEY, JSON.stringify({ id, at: Date.now() }));
  } catch {}
  return id;
}

// the id this browser is waiting on, if any
export function waitingHandoff(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as { id: string; at: number } | null;
    return v && Date.now() - v.at < LIFE ? v.id : null;
  } catch {
    return null;
  }
}

export function clearHandoff() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
