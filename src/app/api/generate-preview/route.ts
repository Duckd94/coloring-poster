import { NextResponse } from "next/server";
import type { ImageQuality } from "@/lib/openai/pipeline";
import { generateColoringPage } from "@/lib/openai/pipeline";
import { isPaperSize, PAPER_SIZES } from "@/lib/paper-sizes";

const IMAGE_QUALITIES: readonly ImageQuality[] = ["low", "medium", "high", "xhigh", "max"];
function isImageQuality(value: string): value is ImageQuality {
  return (IMAGE_QUALITIES as readonly string[]).includes(value);
}

export const maxDuration = 60;

// ponytail: bản test độc lập cho module OpenAI (PROJECT_BRIEF.md mục 12
// bước 2) — chưa có content moderation, watermark, rate-limit, hay lưu DB.
// Thêm khi build flow thật (mục 12 bước 4 và 9).
export async function POST(request: Request) {
  const formData = await request.formData();

  const image = formData.get("image");
  if (!(image instanceof File)) {
    return NextResponse.json(
      { error: "Thiếu field 'image' (multipart/form-data)" },
      { status: 400 },
    );
  }
  if (!image.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "File phải là ảnh (image/*)" },
      { status: 400 },
    );
  }

  const paperSizeInput = String(formData.get("paperSize") ?? "50x70");
  if (!isPaperSize(paperSizeInput)) {
    return NextResponse.json(
      { error: `paperSize phải là một trong: ${PAPER_SIZES.join(", ")}` },
      { status: 400 },
    );
  }

  const qualityInput = String(formData.get("quality") ?? "max");
  if (!isImageQuality(qualityInput)) {
    return NextResponse.json(
      { error: `quality phải là một trong: ${IMAGE_QUALITIES.join(", ")}` },
      { status: 400 },
    );
  }

  const sourceImage = Buffer.from(await image.arrayBuffer());

  try {
    const result = await generateColoringPage(sourceImage, paperSizeInput, qualityInput);
    return NextResponse.json({
      paintingImageBase64: result.paintingImage.toString("base64"),
      lineArtImageBase64: result.lineArtImage.toString("base64"),
      params: result.params,
      usage: result.usage,
    });
  } catch (error) {
    console.error("generate-preview failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
