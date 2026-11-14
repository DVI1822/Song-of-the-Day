import { NextResponse, type NextRequest } from "next/server";
import { tasteFor } from "@/lib/taste";
import { createClient } from "@/lib/supabase/server";

// Someone's taste, for their core. Signed-in people only, since looking songs
// up and writing the overview costs something.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("user");
  if (!id) return NextResponse.json({ error: "No one" }, { status: 400 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  try {
    const taste = await tasteFor(id);
    if (!taste) return NextResponse.json({ error: "No such person" }, { status: 404 });
    return NextResponse.json(taste, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("taste", e);
    return NextResponse.json({ error: "Couldn't work out the taste right now" }, { status: 502 });
  }
}
