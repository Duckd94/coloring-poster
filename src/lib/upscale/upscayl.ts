import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Đường dẫn binary/models Upscayl — mặc định trỏ tới bản cài Windows local
// (winget install Upscayl.Upscayl), override qua env khi deploy server khác.
const BIN_PATH =
  process.env.UPSCAYL_BIN_PATH ??
  "C:\\Program Files\\Upscayl\\resources\\bin\\upscayl-bin.exe";
const MODELS_PATH =
  process.env.UPSCAYL_MODELS_PATH ??
  "C:\\Program Files\\Upscayl\\resources\\models";

// digital-art-4x phù hợp cho line art/illustration hơn model ảnh chụp
// (realesrgan-x4plus) — tranh coloring book không có texture ảnh thật.
const MODEL_NAME = process.env.UPSCAYL_MODEL_NAME ?? "digital-art-4x";

export class UpscaylUnavailableError extends Error {}

export async function upscaleWithUpscayl(
  image: Buffer,
  scale: number,
): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "upscayl-"));
  const inputPath = join(dir, "input.png");
  const outputPath = join(dir, "output.png");

  try {
    await writeFile(inputPath, image);

    await execFileAsync(BIN_PATH, [
      "-i", inputPath,
      "-o", outputPath,
      "-m", MODELS_PATH,
      "-n", MODEL_NAME,
      "-s", String(scale),
      "-f", "png",
    ]);

    return await readFile(outputPath);
  } catch (error) {
    throw new UpscaylUnavailableError(
      `Upscayl binary lỗi hoặc không tìm thấy tại ${BIN_PATH}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
