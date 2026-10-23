"use client";

import {
  createPost,
  deleteTodayPost,
  follow,
  loadCore,
  previewSong,
  searchPeople,
  type NewPost,
} from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import type { ResolvedSong } from "@/lib/songs";
import type { Core, Friend, Post, Profile } from "@/lib/types";

// Everything the Globe asks the server for. The demo swaps in fakes.
export type GlobeApi = {
  previewSong(url: string): Promise<{ song?: ResolvedSong; error?: string }>;
  uploadPhoto(userId: string, photo: Blob): Promise<{ url?: string; error?: string }>;
  createPost(input: NewPost): Promise<{ post?: Post; error?: string }>;
  deleteTodayPost(postId: string): Promise<{ error?: string } | undefined>;
  searchPeople(q: string): Promise<(Profile & { following: boolean })[]>;
  follow(profileId: string): Promise<{ friend?: Friend; error?: string }>;
  loadCore(userId: string): Promise<Core | null>;
};

export const serverApi: GlobeApi = {
  previewSong,
  createPost,
  deleteTodayPost,
  searchPeople,
  follow,
  loadCore,
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
