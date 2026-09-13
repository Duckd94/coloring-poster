import sharp from "sharp";

const WATERMARK_TEXT = "PREVIEW – coloringposter.com";

// Watermark mờ, lặp lại nhiều vị trí xuyên chéo ảnh — không đặt góc vì dễ bị
// crop bỏ (PROJECT_BRIEF.md mục 3 bước 3). Dùng SVG <pattern> tile lại toàn
// bộ khung ảnh thay vì 1 lần overlay duy nhất.
export async function applyWatermark(image: Buffer): Promise<Buffer> {
  const metadata = await sharp(image).metadata();
  const width = metadata.width ?? 1024;
  const height = metadata.height ?? 1024;
  const tileSize = Math.round(Math.max(width, height) / 4);

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="watermark" width="${tileSize}" height="${tileSize}"
                 patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
          <text x="0" y="${tileSize / 2}" font-family="sans-serif"
                font-size="${Math.round(tileSize / 8)}" fill="rgba(0,0,0,0.18)">
            ${WATERMARK_TEXT}
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#watermark)" />
    </svg>
  `;

  return sharp(image)
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer();
}
