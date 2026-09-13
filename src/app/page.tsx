"use client";

import { useState } from "react";
import { PAPER_SIZES, type PaperSize } from "@/lib/paper-sizes";

type Status = "idle" | "loading" | "done" | "error";

const PAPER_SIZE_LABELS: Record<PaperSize, string> = {
  "30x40": "30×40cm — nhỏ gọn",
  "50x70": "50×70cm — phổ biến nhất",
  "70x100": "70×100cm — khổ lớn",
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [paperSize, setPaperSize] = useState<PaperSize>("50x70");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  function handleFileChange(selected: File | null) {
    setFile(selected);
    setResultUrl(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus("loading");
    setError(null);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("email", email);
    formData.append("paperSize", paperSize);

    try {
      const res = await fetch("/api/generate", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Có lỗi xảy ra, thử lại sau.");
      setResultUrl(data.previewImageUrl);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra, thử lại sau.");
      setStatus("error");
    }
  }

  return (
    <main className="flex-1 bg-[#fbf4e8] text-[#2a231c]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-16 px-6 py-16 sm:px-10 lg:grid-cols-[1.1fr_1fr] lg:py-24">
        <section className="flex flex-col justify-center">
          <span className="w-fit rounded-full border border-[#c65a2e]/30 bg-[#c65a2e]/10 px-4 py-1 text-sm font-medium tracking-wide text-[#c65a2e]">
            Tranh tô màu cá nhân hoá
          </span>
          <h1 className="mt-6 font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Biến ảnh của bạn thành
            <span className="italic text-[#c65a2e]"> tranh tô màu</span> khổ lớn
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#5c5347]">
            Tải lên một tấm ảnh — con bạn, thú cưng, hay cả gia đình — AI sẽ vẽ lại
            thành trang coloring book nét đen trắng, in khổ poster, gửi tận nhà để
            cả nhà cùng tô.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-5">
            <label className="group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#c65a2e]/40 bg-white/60 px-6 py-10 text-center transition-colors hover:border-[#c65a2e] hover:bg-white">
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Ảnh đã chọn"
                  className="h-32 w-32 rounded-xl object-cover shadow-md"
                />
              ) : (
                <>
                  <span className="text-3xl">📷</span>
                  <span className="mt-2 text-sm font-medium text-[#8a6f52]">
                    Bấm để chọn ảnh, hoặc kéo thả vào đây
                  </span>
                </>
              )}
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-[#5c5347]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@email.com"
                  className="w-full rounded-lg border border-[#dfd3bf] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#c65a2e] focus:ring-2 focus:ring-[#c65a2e]/20"
                />
              </div>
              <div>
                <label htmlFor="paperSize" className="mb-1 block text-sm font-medium text-[#5c5347]">
                  Khổ giấy
                </label>
                <select
                  id="paperSize"
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                  className="w-full rounded-lg border border-[#dfd3bf] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#c65a2e] focus:ring-2 focus:ring-[#c65a2e]/20"
                >
                  {PAPER_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {PAPER_SIZE_LABELS[size]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={!file || !email || status === "loading"}
              className="mt-2 rounded-full bg-[#c65a2e] px-6 py-3.5 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(198,90,46,0.6)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#c65a2e]/40 disabled:shadow-none"
            >
              {status === "loading" ? "Đang vẽ tranh của bạn… (~1-2 phút)" : "Tạo bản xem trước — miễn phí"}
            </button>

            {status === "error" && error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </form>
        </section>

        <section className="flex items-center justify-center">
          <div className="flex aspect-[3/4] w-full max-w-md items-center justify-center overflow-hidden rounded-3xl border border-[#e6d9c2] bg-white shadow-[0_20px_60px_-20px_rgba(42,35,28,0.25)]">
            {resultUrl ? (
              <img src={resultUrl} alt="Tranh tô màu đã tạo" className="h-full w-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-3 px-8 text-center text-[#a89a83]">
                <span className="text-4xl">🖍️</span>
                <p className="text-sm">
                  Bản xem trước (có watermark) sẽ hiện ở đây sau khi bạn tải ảnh lên.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
