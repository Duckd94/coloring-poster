import type { SupabaseClient } from "@supabase/supabase-js";

// Ảnh gốc khách upload — private, chỉ server đọc (mục 3: file gốc/độ phân
// giải cao không bao giờ lộ ra client).
export const SOURCE_BUCKET = "generation-sources";
// Ảnh preview đã watermark — public, an toàn để lộ vì không dùng để in được.
export const PREVIEW_BUCKET = "generation-previews";

export async function uploadSourceImage(
  admin: SupabaseClient,
  generationId: string,
  image: Buffer,
  contentType: string,
): Promise<string> {
  const path = `${generationId}/source.png`;
  const { error } = await admin.storage
    .from(SOURCE_BUCKET)
    .upload(path, image, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

export async function uploadPreviewImage(
  admin: SupabaseClient,
  generationId: string,
  image: Buffer,
): Promise<string> {
  const path = `${generationId}/preview.png`;
  const { error } = await admin.storage
    .from(PREVIEW_BUCKET)
    .upload(path, image, { contentType: "image/png", upsert: true });
  if (error) throw error;
  return path;
}

export function getPreviewPublicUrl(admin: SupabaseClient, path: string): string {
  return admin.storage.from(PREVIEW_BUCKET).getPublicUrl(path).data.publicUrl;
}
