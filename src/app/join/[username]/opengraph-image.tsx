import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { isConfigured, supabaseKey, supabaseUrl } from "@/lib/supabase/env";

// The preview card a messaging app shows for an invite link: the inviter's
// latest song cover beside their name.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "An invite to Song of the Day";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  let name = `@${username}`;
  let cover: string | null = null;
  if (isConfigured) {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const { data: p } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("username", username.toLowerCase())
      .maybeSingle();
    if (p) {
      name = p.display_name;
      const { data: post } = await supabase
        .from("posts")
        .select("artwork_url")
        .eq("user_id", p.id)
        .order("day", { ascending: false })
        .limit(1)
        .maybeSingle();
      cover = post?.artwork_url ?? null;
    }
  }
  const first = name.split(" ")[0];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 64,
        padding: "0 90px",
        background: "linear-gradient(180deg, #BFE2F5 0%, #E4F3FB 60%, #FFFFFF 100%)",
        color: "#0D2A3F",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          width: 360,
          height: 360,
          flex: "none",
          display: "flex",
          borderRadius: 94,
          overflow: "hidden",
          boxShadow: "0 30px 60px -30px rgba(13,42,63,0.55)",
          background: "radial-gradient(circle at 34% 28%, #FFFFFF 0%, #A9DCD6 24%, #2F6F7E 64%, #173C47 100%)",
        }}
      >
        {cover && <img src={cover} alt="" width={360} height={360} style={{ objectFit: "cover" }} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 30, color: "#6A818C", fontWeight: 600 }}>Song of the Day</div>
        <div
          style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.08 }}
        >{`${first} saved you a spot on their globe`}</div>
        <div style={{ fontSize: 30, color: "#D7262B", fontWeight: 600 }}>Share your Song of the Day with the world</div>
      </div>
    </div>,
    size,
  );
}
