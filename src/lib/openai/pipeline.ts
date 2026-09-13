import { toFile } from "openai";
import { AI_IMAGE_SIZE, type PaperSize } from "@/lib/paper-sizes";
import { getOpenAIClient, IMAGE_MODEL } from "./client";
import { LINE_ART_PROMPT, PAINTING_PROMPT } from "./prompts";

// "max"/"xhigh" cho chất lượng in ấn thật; "low"/"medium"/"high" chạy nhanh
// hơn và rẻ hơn — dùng khi test trên máy yếu để giảm thời gian chờ
// (PROJECT_BRIEF.md mục 5 cho phép "max" hoặc "xhigh", không bắt buộc cố định).
export type ImageQuality = "low" | "medium" | "high" | "xhigh" | "max";

export interface GenerationParams {
  model: string;
  size: string;
  quality: ImageQuality;
  background: "opaque";
  paintingPrompt: string;
  lineArtPrompt: string;
}

// Token usage OpenAI trả về cho mỗi lần gọi images.edit (dùng để tính chi phí
// thật thay vì ước lượng — xem OpenAI Usage dashboard để đối chiếu $ chính xác).
export interface ImageEditUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ColoringPageResult {
  paintingImage: Buffer;
  lineArtImage: Buffer;
  params: GenerationParams;
  usage: {
    painting: ImageEditUsage | null;
    lineArt: ImageEditUsage | null;
  };
}

async function editImage(
  image: Buffer,
  prompt: string,
  size: string,
  quality: ImageQuality,
): Promise<{ image: Buffer; usage: ImageEditUsage | null }> {
  const file = await toFile(image, "input.png", { type: "image/png" });

  // background: "opaque" là BẮT BUỘC — để "auto" model có thể xuất nền trong
  // suốt, gây lỗi nghiêm trọng khi flatten/upscale sau này (CLAUDE.md).
  const response = await getOpenAIClient().images.edit({
    model: IMAGE_MODEL,
    image: file,
    prompt,
    size,
    quality,
    background: "opaque",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI image edit trả về rỗng, không có b64_json");
  }

  const usage = response.usage
    ? {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.total_tokens,
      }
    : null;

  return { image: Buffer.from(b64, "base64"), usage };
}

// Pipeline luôn 2 bước (photo -> painting -> line art) — đã test 1 bước cho
// kết quả kém hơn với ảnh nền phức tạp (PROJECT_BRIEF.md mục 3).
export async function generateColoringPage(
  sourceImage: Buffer,
  paperSize: PaperSize,
  quality: ImageQuality = "max",
): Promise<ColoringPageResult> {
  const size = AI_IMAGE_SIZE[paperSize];

  const painting = await editImage(sourceImage, PAINTING_PROMPT, size, quality);
  const lineArt = await editImage(painting.image, LINE_ART_PROMPT, size, quality);

  return {
    paintingImage: painting.image,
    lineArtImage: lineArt.image,
    params: {
      model: IMAGE_MODEL,
      size,
      quality,
      background: "opaque",
      paintingPrompt: PAINTING_PROMPT,
      lineArtPrompt: LINE_ART_PROMPT,
    },
    usage: { painting: painting.usage, lineArt: lineArt.usage },
  };
}
