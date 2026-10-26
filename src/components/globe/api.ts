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
import type { Core, Friend, Note, Post, Profile, Reactions } from "@/lib/types";

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
  addNote(postId: string, body: string): Promise<{ note?: Note; error?: string }>;
  deleteNote(noteId: string): Promise<{ error?: string }>;
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
  addNote,
  deleteNote,
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
