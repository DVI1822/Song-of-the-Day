"use client";

import {
  blockUser,
  createPost,
  deleteTodayPost,
  follow,
  hideSongs,
  loadCore,
  loadNews,
  mayKnow,
  loadReactions,
  feelSong,
  saveSong,
  loadSaved,
  addNote,
  deleteNote,
  matchContacts,
  previewSong,
  reportUser,
  searchPeople,
  type ContactMatch,
  type NewPost,
  type ReportReason,
} from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import type { ResolvedSong } from "@/lib/songs";
import type { News } from "@/lib/data";
import type { Core, Friend, MayKnow, Message, Note, Post, Profile, Reactions, SavedSong, Score, SongFacts } from "@/lib/types";

// Everything the Globe asks the server for. The demo swaps in fakes.
export type GlobeApi = {
  previewSong(url: string): Promise<{ song?: ResolvedSong; error?: string }>;
  setAvatar?(userId: string, photo: Blob): Promise<{ url?: string; error?: string }>;
  uploadPhoto(userId: string, photo: Blob): Promise<{ url?: string; error?: string }>;
  createPost(input: NewPost): Promise<{ post?: Post; error?: string }>;
  deleteTodayPost(postId: string): Promise<{ error?: string } | undefined>;
  searchPeople(q: string): Promise<(Profile & { following: boolean })[]>;
  follow(profileId: string): Promise<{ friend?: Friend; error?: string }>;
  matchContacts(emails: string[]): Promise<ContactMatch[]>;
  // people not on your globe who know someone on it, most shared friends first
  mayKnow?(): Promise<MayKnow[]>;
  loadCore(userId: string): Promise<Core | null>;
  report(input: { reportedId: string; postId?: string | null; reason: ReportReason; note?: string }): Promise<{ error?: string }>;
  block(profileId: string): Promise<{ error?: string }>;
  hideSongs(profileId: string, hide: boolean): Promise<{ error?: string }>;
  reactions(postId: string): Promise<Reactions | null>;
  feel(postId: string, on: boolean): Promise<{ error?: string }>;
  // save someone's song to your core, and the ones you've saved
  save(postId: string, on: boolean): Promise<{ error?: string }>;
  saved(): Promise<SavedSong[]>;
  addNote(postId: string, body: string): Promise<{ note?: Note; error?: string }>;
  deleteNote(noteId: string): Promise<{ error?: string }>;
  chat: ChatApi;
  // your TopTrack pick today, and the month's leaderboard
  ranks?: RankApi;
  // keep this browser's push subscription for the noon and 9 PM nudges
  savePush?(sub: { endpoint: string; p256dh: string; auth: string }): Promise<void>;
  // what's new since the Globe opened; the demo has nothing new
  news?(): Promise<News | null>;
  // a few facts about the song you posted, from Wikipedia
  facts?(postId: string): Promise<SongFacts | null>;
};

// The globe chat and messages to one person. These go straight to the
// database from the browser (its rules decide who sees what), and new ones
// arrive live.
export type ChatApi = {
  load(): Promise<Message[]>;
  send(body: string, toId: string | null): Promise<{ message?: Message; error?: string }>;
  remove(id: string): Promise<{ error?: string }>;
  markRead(fromId: string): Promise<void>;
  people(ids: string[]): Promise<Profile[]>;
  listen(on: { add(m: Message): void; gone(id: string): void }): () => void;
};

// Your TopTrack pick today and the leaderboard. Picks go through
// pick_song(), which checks you've posted and the song is on your globe; you
// can read only your own, and the board is totals only
// (20261113000000_rankings.sql, 20261114000000_toptrack_pick.sql).
export type RankApi = {
  mine(day: string): Promise<string | null>;
  set(postId: string | null): Promise<{ error?: string }>;
  board(): Promise<Score[]>;
};

const supabaseRanks: RankApi = {
  async mine(day) {
    const { data } = await createClient().from("votes").select("post_id").eq("day", day).limit(1);
    return data?.[0]?.post_id ?? null;
  },
  async set(postId) {
    const { error } = await createClient().rpc("pick_song", { p_post: postId });
    if (!error) return {};
    // the database's own words are written for people (pick_song)
    return { error: error.code === "P0001" ? error.message : "Couldn't save that. Try again." };
  },
  async board() {
    const { data } = await createClient().rpc("leaderboard");
    return ((data ?? []) as { who: string; month_points: number; last_points: number }[]).map((r) => ({
      who: r.who,
      month: r.month_points,
      last: r.last_points,
    }));
  },
};

const MSG = "id, user_id, to_id, body, created_at, read_at";

const supabaseChat: ChatApi = {
  async load() {
    const supabase = createClient();
    const [globe, direct] = await Promise.all([
      supabase.from("messages").select(MSG).is("to_id", null).order("created_at", { ascending: false }).limit(150),
      supabase.from("messages").select(MSG).not("to_id", "is", null).order("created_at", { ascending: false }).limit(400),
    ]);
    return [...(globe.data ?? []), ...(direct.data ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  async send(body, toId) {
    const text = body.trim().slice(0, 500);
    if (!text) return { error: "Say something first." };
    const { data, error } = await createClient().from("messages").insert({ body: text, to_id: toId }).select(MSG).single();
    if (error || !data) return { error: toId ? "Couldn't send that. Try again." : "Couldn't post that. Try again." };
    return { message: data };
  },
  async remove(id) {
    const { error } = await createClient().from("messages").delete().eq("id", id);
    return error ? { error: "Couldn't delete that. Try again." } : {};
  },
  async markRead(fromId) {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", fromId)
      .eq("to_id", data.user.id)
      .is("read_at", null);
  },
  async people(ids) {
    if (!ids.length) return [];
    const { data } = await createClient().from("profiles").select("id, username, display_name, timezone, created_at, avatar_url").in("id", ids);
    return data ?? [];
  },
  listen(on) {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`chat-${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => on.add(p.new as Message))
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p) => {
          const id = (p.old as { id?: string }).id;
          if (id) on.gone(id);
        })
        .subscribe();
    });
    return () => {
      live = false;
      if (channel) supabase.removeChannel(channel);
    };
  },
};

export const serverApi: GlobeApi = {
  previewSong,
  createPost,
  deleteTodayPost,
  searchPeople,
  follow,
  matchContacts,
  mayKnow,
  loadCore,
  report: reportUser,
  block: blockUser,
  hideSongs,
  news: loadNews,
  reactions: loadReactions,
  feel: feelSong,
  save: saveSong,
  saved: loadSaved,
  addNote,
  deleteNote,
  chat: supabaseChat,
  ranks: supabaseRanks,
  // A route, not a server action: making a song's facts the first time can
  // take a few seconds, and server actions wait in line behind each other.
  async facts(postId) {
    // never from the phone's cache: the server keeps each song's facts, and an
    // old empty answer kept here would hide them
    const res = await fetch(`/api/facts?post=${encodeURIComponent(postId)}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return null;
    return res.json();
  },
  async savePush(sub) {
    await createClient().rpc("save_push", { sub_endpoint: sub.endpoint, sub_p256dh: sub.p256dh, sub_auth: sub.auth });
  },
  // Your picture lives in its own folder beside your one-day photos, so the
  // daily sweep (data.ts) leaves it be; the one before it is removed.
  async setAvatar(userId, photo) {
    const supabase = createClient();
    const path = `${userId}/avatar/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from("photos")
      .upload(path, photo, { contentType: "image/jpeg", cacheControl: "31536000" });
    if (error) return { error: "Couldn't upload your picture. Try again." };
    const url = supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
    const { error: saveError } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
    if (saveError) {
      await supabase.storage.from("photos").remove([path]);
      return { error: "Couldn't save your picture. Try again." };
    }
    const { data: old } = await supabase.storage.from("photos").list(`${userId}/avatar`, { limit: 100 });
    const stale = (old ?? []).map((f) => `${userId}/avatar/${f.name}`).filter((f) => f !== path);
    if (stale.length) await supabase.storage.from("photos").remove(stale);
    return { url };
  },
  async uploadPhoto(userId, photo) {
    const supabase = createClient();
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from("photos")
      .upload(path, photo, { contentType: "image/jpeg", cacheControl: "31536000" });
    if (error) return { error: "Couldn't upload the photo. Try again, or post without it." };
    return { url: supabase.storage.from("photos").getPublicUrl(path).data.publicUrl };
  },
};

// Shrink a photo on the phone before it's uploaded: long side 1600px, JPEG.
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
}
