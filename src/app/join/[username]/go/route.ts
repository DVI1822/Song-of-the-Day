import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { INVITE_COOKIE, INVITE_MAX_AGE, cleanInvite } from "@/lib/invite";

// "Join" on an invite page. Signed in already: add the inviter and go to the
// Globe. Otherwise remember who invited you, then sign in.
export async function GET(request: Request, { params }: RouteContext<"/join/[username]/go">) {
  const { origin } = new URL(request.url);
  const inviter = cleanInvite((await params).username);
  if (!inviter) return NextResponse.redirect(`${origin}/`);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  let to = `${origin}/login`;
  if (userId) {
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (profile) {
      await supabase.rpc("accept_invite", { inviter });
      return NextResponse.redirect(`${origin}/`);
    }
    to = `${origin}/welcome`;
  }
  const res = NextResponse.redirect(to);
  res.cookies.set(INVITE_COOKIE, inviter, { maxAge: INVITE_MAX_AGE, path: "/", sameSite: "lax", httpOnly: true });
  return res;
}
