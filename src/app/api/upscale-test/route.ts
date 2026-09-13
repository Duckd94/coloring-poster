import { NextResponse } from "next/server";
import { isPaperSize, PAPER_SIZES } from "@/lib/paper-sizes";
import { upscaleForPrint } from "@/lib/upscale";

export const maxDuration = 120;

// ponytail: test độc lập cho module upscale (PROJECT_BRIEF.md mục 12 bước 3)
// — trả file full-res qua API chỉ để test cục bộ; route thật KHÔNG bao giờ
// được trả ảnh full-res cho client (CLAUDE.md).
export async function POST(request: Request) {
  const formData = await request.formData();

  const image = formData.get("image");
  if (!(image instanceof File)) {
    return NextResponse.json(
      { error: "Thiếu field 'image' (multipart/form-data)" },
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

  const sourceImage = Buffer.from(await image.arrayBuffer());

  try {
    const upscaled = await upscaleForPrint(sourceImage, paperSizeInput);
    return NextResponse.json({
      imageBase64: upscaled.image.toString("base64"),
      sizeBytes: upscaled.image.length,
      engine: upscaled.engine,
    });
  } catch (error) {
    console.error("upscale-test failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
