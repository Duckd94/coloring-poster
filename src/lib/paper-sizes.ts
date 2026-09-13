// Khổ giấy, size ảnh AI, và độ phân giải in đích (PROJECT_BRIEF.md mục 5).
export type PaperSize = "30x40" | "50x70" | "70x100";

export const PAPER_SIZES: PaperSize[] = ["30x40", "50x70", "70x100"];

export function isPaperSize(value: string): value is PaperSize {
  return (PAPER_SIZES as string[]).includes(value);
}

// WIDTHxHEIGHT truyền cho gpt-image-2.5-sunburst.
export const AI_IMAGE_SIZE: Record<PaperSize, string> = {
  "30x40": "1536x2048",
  "50x70": "1520x2128",
  "70x100": "1568x2240",
};

// Kích thước cần đạt sau upscale để in 300 DPI.
export const PRINT_TARGET_PX: Record<PaperSize, { width: number; height: number }> = {
  "30x40": { width: 3543, height: 4724 },
  "50x70": { width: 5906, height: 8268 },
  "70x100": { width: 8268, height: 11811 },
};
