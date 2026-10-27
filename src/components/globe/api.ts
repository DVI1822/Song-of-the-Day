"use client";

import {
  blockUser,
  createPost,
  deleteTodayPost,
  follow,
  hideSongs,
  loadCore,
  loadNews,
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
  spotifyNext,
  spotifyNow,
  spotifyPause,
  spotifyPlay,
  spotifyPlayAll,
  spotifyResume,
  type ContactMatch,
  type NewPost,
  type ReportReason,
  type SpotifyNow,
  type SpotifyPlay,
} from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import type { ResolvedSong } from "@/lib/songs";
import type { News } from "@/lib/data";
import type { Core, Friend, Message, Note, Post, Profile, Reactions, SavedSong } from "@/lib/types";

// Everything the Globe asks the server for. The demo swaps in fakes.
export type GlobeApi = {
  previewSong(url: string): Promise<{ song?: ResolvedSong; error?: string }>;
  uploadPhoto(userId: string, photo: Blob): Promise<{ url?: string; error?: string }>;
  createPost(input: NewPost): Promise<{ post?: Post; error?: string }>;
  deleteTodayPost(postId: string): Promise<{ error?: string } | undefined>;
  searchPeople(q: string): Promise<(Profile & { following: boolean })[]>;
  follow(profileId: string): Promise<{ friend?: Friend; error?: string }>;
  matchContacts(emails: string[]): Promise<ContactMatch[]>;
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
  // keep this browser's push subscription for the noon and 9 PM nudges
  savePush?(sub: { endpoint: string; p256dh: string; auth: string }): Promise<void>;
  // what's new since the Globe opened; the demo has nothing new
  news?(): Promise<News | null>;
  // Spotify Connect, for people who linked Spotify. The demo has none.
  spotify?: SpotifyConnect;
};

export type SpotifyConnect = {
  play(uri: string, positionMs?: number): Promise<SpotifyPlay>;
  playAll(uris: string[]): Promise<SpotifyPlay>;
  next(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<SpotifyPlay>;
  now(): Promise<SpotifyNow>;
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
    const { data } = await createClient().from("profiles").select("id, username, display_name, timezone, created_at").in("id", ids);
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
  async savePush(sub) {
    await createClient().rpc("save_push", { sub_endpoint: sub.endpoint, sub_p256dh: sub.p256dh, sub_auth: sub.auth });
  },
  spotify: { play: spotifyPlay, playAll: spotifyPlayAll, next: spotifyNext, pause: spotifyPause, resume: spotifyResume, now: spotifyNow },
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
