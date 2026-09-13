import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import type { ImageQuality } from "@/lib/openai/pipeline";
import { generateColoringPage } from "@/lib/openai/pipeline";
import { isPaperSize, PAPER_SIZES } from "@/lib/paper-sizes";
import { upscaleForPrint } from "@/lib/upscale";

const IMAGE_QUALITIES: readonly ImageQuality[] = ["low", "medium", "high", "xhigh", "max"];
function isImageQuality(value: string): value is ImageQuality {
  return (IMAGE_QUALITIES as readonly string[]).includes(value);
}

export const maxDuration = 180;

// ponytail: nối generate + upscale để test full chain cục bộ (mục 12 bước 3) —
// vẫn CHƯA có moderation/watermark/rate-limit/lưu DB, và vẫn trả ảnh full-res
// qua API (route thật ở bước 4 KHÔNG được làm vậy, xem CLAUDE.md). Lưu file
// ra đĩa (thay vì chỉ trả base64) để dễ mở xem trực tiếp.
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
  const startedAt = Date.now();

  try {
    const generated = await generateColoringPage(sourceImage, paperSizeInput, qualityInput);
    const generateDoneAt = Date.now();
    const upscaled = await upscaleForPrint(generated.lineArtImage, paperSizeInput);
    const upscaleDoneAt = Date.now();

    const outDir = join(process.cwd(), "test-output", String(Date.now()));
    await mkdir(outDir, { recursive: true });
    await Promise.all([
      writeFile(join(outDir, "1-painting.png"), generated.paintingImage),
      writeFile(join(outDir, "2-lineart.png"), generated.lineArtImage),
      writeFile(join(outDir, "3-final-upscaled.png"), upscaled.image),
    ]);

    return NextResponse.json({
      outputDir: outDir,
      elapsedMs: upscaleDoneAt - startedAt,
      generateMs: generateDoneAt - startedAt,
      upscaleMs: upscaleDoneAt - generateDoneAt,
      upscaleEngine: upscaled.engine,
      usage: generated.usage,
      params: generated.params,
      paintingImageBase64: generated.paintingImage.toString("base64"),
      lineArtImageBase64: generated.lineArtImage.toString("base64"),
      finalImageBase64: upscaled.image.toString("base64"),
    });
  } catch (error) {
    console.error("full-pipeline-test failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
