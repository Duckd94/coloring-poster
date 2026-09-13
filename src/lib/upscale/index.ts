import sharp from "sharp";
import type { PaperSize } from "@/lib/paper-sizes";
import { PRINT_TARGET_PX } from "@/lib/paper-sizes";
import { upscaleWithFalAi } from "./falai";
import { UpscaylUnavailableError, upscaleWithUpscayl } from "./upscayl";

export interface UpscaleResult {
  image: Buffer;
  // "upscayl" chạy local, miễn phí. "falai" là fallback trả phí theo request
  // (chỉ dùng khi Upscayl không khả dụng trên máy chủ).
  engine: "upscayl" | "falai";
}

// Model AI upscale (cả Upscayl lẫn fal.ai) chỉ nhận scale nguyên 2x/3x/4x.
// Tính đúng mức cần theo khổ giấy thay vì luôn chạy full 4x — khổ nhỏ (vd.
// 30x40 chỉ cần ~2.3x) chạy nhanh hơn và fal.ai (trả phí) tính tiền theo
// scale nên cũng rẻ hơn. Khổ cần >4x (vd. 70x100 cần ~5.3x) bị clamp về 4x,
// phần thiếu được bù ở bước resize cuối — đánh đổi chất lượng nhỏ, chưa làm
// upscale 2 lần.
function computeScale(sourceWidth: number, targetWidth: number): number {
  const ratio = Math.ceil(targetWidth / sourceWidth);
  return Math.min(4, Math.max(2, ratio));
}

// Upscayl chạy local (GPU/Vulkan) là đường chính; fal.ai là fallback khi máy
// chủ không có Upscayl khả dụng (PROJECT_BRIEF.md mục 2).
export async function upscaleForPrint(
  image: Buffer,
  paperSize: PaperSize,
): Promise<UpscaleResult> {
  const target = PRINT_TARGET_PX[paperSize];
  const metadata = await sharp(image).metadata();
  const scale = computeScale(metadata.width ?? target.width, target.width);

  let upscaled: Buffer;
  let engine: UpscaleResult["engine"];
  try {
    upscaled = await upscaleWithUpscayl(image, scale);
    engine = "upscayl";
  } catch (error) {
    if (!(error instanceof UpscaylUnavailableError)) throw error;
    upscaled = await upscaleWithFalAi(image, scale);
    engine = "falai";
  }

  // Resize chính xác về đúng kích thước in 300 DPI, bất kể upscaler nào tạo
  // ra ảnh trung gian (tỉ lệ AI sinh ra có thể lệch vài px so với target).
  const finalImage = await sharp(upscaled)
    .resize(target.width, target.height, { fit: "fill" })
    .png()
    .toBuffer();

  return { image: finalImage, engine };
}
