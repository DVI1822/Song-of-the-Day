import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isConfigured, supabaseKey, supabaseUrl } from "@/lib/supabase/env";

// Keeps the Supabase login session fresh on every page load.
export async function proxy(request: NextRequest) {
  // A sign-in link Supabase sent to the home page instead of /auth/callback
  // (it does that when the callback isn't on its allowed list).
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/" && searchParams.has("code")) {
    const to = request.nextUrl.clone();
    to.pathname = "/auth/callback";
    return NextResponse.redirect(to);
  }

  let response = NextResponse.next({ request });
  let refreshed = false;
  if (!isConfigured) return response;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        refreshed = true;
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const { data } = await supabase.auth.getClaims();

  // Keep you signed in: the sign-in cookies get written by the page's own
  // script too, and Safari lets those lapse after 7 days. Sent back from here
  // on each visit, they last the full 400 days instead. Not in a session's
  // last few minutes, when the page may be swapping in a new one itself
  // (sending the old one back then would undo that).
  const exp = typeof data?.claims?.exp === "number" ? data.claims.exp : 0;
  if (!refreshed && exp * 1000 - Date.now() > 5 * 60_000 && request.headers.get("sec-fetch-dest") === "document") {
    const secure = request.nextUrl.protocol === "https:";
    for (const c of request.cookies.getAll())
      if (/^sb-.+-auth-token(\.\d+)?$/.test(c.name))
        response.cookies.set(c.name, c.value, { path: "/", sameSite: "lax", secure, maxAge: 400 * 24 * 60 * 60 });
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
