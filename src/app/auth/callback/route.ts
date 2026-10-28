import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Sign-in links land here. Older links carry a code; today's carry the
// session after the # (which the server never sees), so anything without a
// code goes on to /auth/done, and the browser keeps the # on the way.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
    return NextResponse.redirect(`${origin}/login?error=link`);
  }
  // the waiting screen's id, if the link came from one (see lib/handoff)
  const h = searchParams.get("h");
  return NextResponse.redirect(`${origin}/auth/done${h && /^[0-9a-f-]{36}$/.test(h) ? `?h=${h}` : ""}`);
}
