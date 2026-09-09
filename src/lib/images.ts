import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "./supabase/server";

/** Supabase Storage bucket that holds images uploaded from the editor (public read). */
export const IMAGES_BUCKET = process.env.SUPABASE_IMAGES_BUCKET || "hglowe-images";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/** Turn "Heather Portrait (final).JPG" into "heather-portrait-final". */
function slugify(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  const slug = base
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "image";
}

/**
 * Store an uploaded image in Supabase Storage using the signed-in editor's session,
 * so the bucket's row-level policies (editor-only writes) apply. Returns a public URL.
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  const ext = EXTENSIONS[file.type];
  if (!ext) return { ok: false, error: `Unsupported image type "${file.type || "unknown"}". Use JPEG, PNG, GIF, WebP, SVG or AVIF.` };
  if (file.size === 0) return { ok: false, error: "The file is empty." };
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.` };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured on the server, so uploads are unavailable." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Uploads need a Supabase sign-in (they don't work with LOCAL_ADMIN_EMAIL)." };

  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const path = `${folder}/${slugify(file.name)}-${randomUUID().slice(0, 8)}.${ext}`;

  const { error } = await supabase.storage.from(IMAGES_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) return { ok: false, error: `Upload failed: ${error.message}` };

  const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
