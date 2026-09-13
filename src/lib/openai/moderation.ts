import { getOpenAIClient } from "./client";

export class ContentModerationError extends Error {
  constructor(public readonly categories: string[]) {
    super(`Ảnh vi phạm chính sách nội dung: ${categories.join(", ")}`);
  }
}

// Kiểm duyệt ảnh gốc trước khi đưa vào pipeline AI (PROJECT_BRIEF.md mục 3
// bước 1). Ném ContentModerationError nếu bị flag, để route trả 400 rõ ràng
// thay vì tốn credit gọi tiếp images.edit.
export async function moderateImage(image: Buffer, mimeType: string): Promise<void> {
  const dataUrl = `data:${mimeType};base64,${image.toString("base64")}`;

  const result = await getOpenAIClient().moderations.create({
    model: "omni-moderation-latest",
    input: [{ type: "image_url", image_url: { url: dataUrl } }],
  });

  const flagged = result.results[0];
  if (flagged?.flagged) {
    const categories = Object.entries(flagged.categories)
      .filter(([, isFlagged]) => isFlagged)
      .map(([name]) => name);
    throw new ContentModerationError(categories);
  }
}
