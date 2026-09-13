"use client";

import { useState } from "react";
import { PAPER_SIZES, type PaperSize } from "@/lib/paper-sizes";

interface ImageUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface PipelineResult {
  outputDir: string;
  elapsedMs: number;
  generateMs: number;
  upscaleMs: number;
  upscaleEngine: "upscayl" | "falai";
  usage: { painting: ImageUsage | null; lineArt: ImageUsage | null };
  paintingImageBase64: string;
  lineArtImageBase64: string;
  finalImageBase64: string;
}

// ponytail: trang test nội bộ cho pipeline generate+upscale (mục 12 bước 3),
// không phải UI khách hàng thật — không cần đạt chuẩn design-quality sản phẩm.
const IMAGE_QUALITIES = ["low", "medium", "high", "xhigh", "max"] as const;
type ImageQuality = (typeof IMAGE_QUALITIES)[number];

export default function TestPipelinePage() {
  const [file, setFile] = useState<File | null>(null);
  const [paperSize, setPaperSize] = useState<PaperSize>("30x40");
  const [quality, setQuality] = useState<ImageQuality>("max");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("paperSize", paperSize);
    formData.append("quality", quality);

    try {
      const res = await fetch("/api/full-pipeline-test", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const totalTokens =
    (result?.usage.painting?.totalTokens ?? 0) +
    (result?.usage.lineArt?.totalTokens ?? 0);

  return (
    <main className="mx-auto max-w-4xl p-8 font-sans">
      <h1 className="text-2xl font-bold">Test pipeline: generate + upscale</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Trang test nội bộ — không phải UI khách hàng. Gọi thật OpenAI + upscale,
        sẽ tốn credit OpenAI mỗi lần submit.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium">Ảnh gốc</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Khổ giấy</label>
          <select
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value as PaperSize)}
            className="mt-1 block rounded border px-2 py-1"
          >
            {PAPER_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Chất lượng AI</label>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as ImageQuality)}
            className="mt-1 block rounded border px-2 py-1"
          >
            {IMAGE_QUALITIES.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!file || loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-40"
        >
          {loading ? "Đang xử lý (~vài phút)..." : "Chạy pipeline"}
        </button>
      </form>

      {error && <p className="mt-4 text-red-600">Lỗi: {error}</p>}

      {result && (
        <div className="mt-8">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <dt className="text-neutral-500">Tổng thời gian</dt>
            <dd>{(result.elapsedMs / 1000).toFixed(1)}s</dd>
            <dt className="text-neutral-500">Thời gian generate</dt>
            <dd>{(result.generateMs / 1000).toFixed(1)}s</dd>
            <dt className="text-neutral-500">Thời gian upscale</dt>
            <dd>{(result.upscaleMs / 1000).toFixed(1)}s</dd>
            <dt className="text-neutral-500">Upscale engine</dt>
            <dd>{result.upscaleEngine}</dd>
            <dt className="text-neutral-500">Token (painting)</dt>
            <dd>{result.usage.painting?.totalTokens ?? "n/a"}</dd>
            <dt className="text-neutral-500">Token (line art)</dt>
            <dd>{result.usage.lineArt?.totalTokens ?? "n/a"}</dd>
            <dt className="text-neutral-500">Tổng token</dt>
            <dd>{totalTokens || "n/a"}</dd>
            <dt className="text-neutral-500">Lưu tại</dt>
            <dd className="col-span-3 break-all">{result.outputDir}</dd>
          </dl>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <figure>
              <img
                src={`data:image/png;base64,${result.paintingImageBase64}`}
                alt="Painting (bước 1)"
                className="w-full rounded border"
              />
              <figcaption className="mt-1 text-center text-sm">Painting</figcaption>
            </figure>
            <figure>
              <img
                src={`data:image/png;base64,${result.lineArtImageBase64}`}
                alt="Line art chưa upscale (bước 2)"
                className="w-full rounded border"
              />
              <figcaption className="mt-1 text-center text-sm">
                Line art (chưa upscale)
              </figcaption>
            </figure>
            <figure>
              <img
                src={`data:image/png;base64,${result.finalImageBase64}`}
                alt="Đã upscale"
                className="w-full rounded border"
              />
              <figcaption className="mt-1 text-center text-sm">Đã upscale</figcaption>
            </figure>
          </div>
        </div>
      )}
    </main>
  );
}
