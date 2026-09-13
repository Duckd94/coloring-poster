import { fal } from "@fal-ai/client";

// Fallback khi máy chủ không có Upscayl (không GPU/Vulkan) — dùng model
// Real-ESRGAN tương đương qua fal.ai. Cần FAL_KEY trong env.
export async function upscaleWithFalAi(
  image: Buffer,
  scale: number,
): Promise<Buffer> {
  const imageUrl = await fal.storage.upload(
    new Blob([new Uint8Array(image)], { type: "image/png" }),
  );

  const result = await fal.subscribe("fal-ai/esrgan", {
    input: {
      image_url: imageUrl,
      model: "RealESRGAN_x4plus",
      scale,
      output_format: "png",
    },
  });

  const response = await fetch(result.data.image.url);
  return Buffer.from(await response.arrayBuffer());
}
