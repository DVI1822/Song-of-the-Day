import { NextResponse, type NextRequest } from "next/server";
import { factsFor } from "@/lib/facts";
import { createClient } from "@/lib/supabase/server";

// Facts about a song on the Globe: only for a post you can see, so nobody can
// use this to look up (and spend on) any song they like.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("post");
  if (!id) return NextResponse.json({ error: "No song" }, { status: 400 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { data: post } = await supabase.from("posts").select("title, artist").eq("id", id).maybeSingle();
  if (!post) return NextResponse.json({ error: "No such song" }, { status: 404 });
  try {
    const facts = await factsFor(post.title, post.artist);
    return NextResponse.json(facts, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    console.error("song facts", e);
    return NextResponse.json({ error: "Couldn't find facts right now" }, { status: 502 });
  }
}
