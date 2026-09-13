import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { moderateImage, ContentModerationError } from "@/lib/openai/moderation";
import { generateColoringPage } from "@/lib/openai/pipeline";
import { isPaperSize, PAPER_SIZES } from "@/lib/paper-sizes";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPreviewPublicUrl,
  uploadPreviewImage,
  uploadSourceImage,
} from "@/lib/supabase/storage";
import { applyWatermark } from "@/lib/watermark";

export const maxDuration = 120;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Flow khách hàng thật (PROJECT_BRIEF.md mục 3 bước 1-3, mục 12 bước 4):
// moderation -> pipeline AI -> watermark -> lưu Storage + DB -> trả preview
// URL. Chưa enforce rate-limit/CAPTCHA (mục 4) — để bước 9, nhưng email/IP đã
// được lưu lại để bước đó dùng.
export async function POST(request: Request) {
  const formData = await request.formData();

  const image = formData.get("image");
  if (!(image instanceof File) || !image.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Thiếu ảnh hợp lệ (field 'image', multipart/form-data)" },
      { status: 400 },
    );
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
  }

  const paperSizeInput = String(formData.get("paperSize") ?? "50x70");
  if (!isPaperSize(paperSizeInput)) {
    return NextResponse.json(
      { error: `paperSize phải là một trong: ${PAPER_SIZES.join(", ")}` },
      { status: 400 },
    );
  }

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const sourceImage = Buffer.from(await image.arrayBuffer());
  const admin = createAdminClient();

  try {
    await moderateImage(sourceImage, image.type);

    const generationId = randomUUID();
    const sourcePath = await uploadSourceImage(
      admin,
      generationId,
      sourceImage,
      image.type,
    );

    const generated = await generateColoringPage(sourceImage, paperSizeInput);
    const watermarked = await applyWatermark(generated.lineArtImage);
    const previewPath = await uploadPreviewImage(admin, generationId, watermarked);

    const { error: insertError } = await admin.from("generations").insert({
      id: generationId,
      email,
      ip_address: ipAddress,
      source_image_path: sourcePath,
      paper_size: paperSizeInput,
      ai_params: generated.params,
      preview_image_path: previewPath,
      status: "completed",
    });
    if (insertError) throw insertError;

    return NextResponse.json({
      generationId,
      previewImageUrl: getPreviewPublicUrl(admin, previewPath),
    });
  } catch (error) {
    if (error instanceof ContentModerationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("generate failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
