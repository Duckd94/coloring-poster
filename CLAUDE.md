# CLAUDE.md

> File này được Claude Code tự động đọc vào đầu mỗi phiên làm việc trong thư mục project.
> Giữ ngắn gọn — chi tiết đầy đủ nằm ở PROJECT_BRIEF.md.

## Bắt buộc đọc trước khi code

Trước khi bắt đầu bất kỳ task nào, đọc `PROJECT_BRIEF.md` ở thư mục gốc — đây là spec đầy đủ
cho toàn bộ project (kiến trúc, pipeline AI, tích hợp Gelato, khổ giấy, thuật toán, v.v.).
KHÔNG code dựa trên phỏng đoán nếu thông tin đã có sẵn trong file đó.

## Quy tắc kỹ thuật KHÔNG ĐƯỢC QUÊN

- **`background: "opaque"` là BẮT BUỘC** trong mọi lần gọi OpenAI image API
  (`gpt-image-2.5-sunburst`). Để mặc định `"auto"` có thể khiến model xuất ảnh nền trong suốt,
  gây lỗi nghiêm trọng khi flatten/upscale (nền biến thành đen, nét line art đen hòa lẫn vào
  nền, ảnh hỏng hoàn toàn không dùng được). Đây là lỗi đã gặp thật trong quá trình test — không
  bỏ qua tham số này.

- **KHÔNG dùng model `gpt-image-1`** — đã deprecated 23/10/2026. Luôn dùng
  `gpt-image-2.5-sunburst`.

- **Pipeline line art luôn là 2 bước** (photo → painting → line art), không rút gọn thành 1
  bước trừ khi có yêu cầu rõ ràng — đã test và xác nhận 1 bước cho kết quả kém hơn với ảnh nền
  phức tạp.

- **Size ảnh AI phải khớp đúng tỷ lệ khổ giấy khách chọn** — xem bảng size cụ thể trong
  PROJECT_BRIEF.md mục 5. Không dùng size mặc định/square cho ảnh sẽ đem đi in.

- **File ảnh độ phân giải cao (sau upscale, không watermark) KHÔNG BAO GIỜ được trả về
  client/frontend.** Chỉ truyền nội bộ server → Gelato. Đây là yêu cầu bảo mật doanh thu, không
  phải tối ưu hiệu năng — vi phạm nghĩa là khách có thể tự in mà không trả tiền.

- **Giá cơ sở Gelato PHẢI query động qua Prices API theo quốc gia khách**, không hardcode.
  Giá khác nhau đáng kể giữa các quốc gia sản xuất/giao hàng.

- **Thanh toán đang ở trạng thái STUB** (giả lập) theo quyết định trong PROJECT_BRIEF.md mục 7.
  Không tự ý tích hợp PayPal/cổng thanh toán thật trừ khi được yêu cầu rõ ràng — cổng thanh toán
  thật chưa được chốt.

## Cách làm việc

- Code từng bước theo đúng thứ tự ở PROJECT_BRIEF.md mục 12. Không nhảy cóc sang bước sau khi
  bước hiện tại chưa test được.
- Khi có quyết định kỹ thuật mới phát sinh ngoài spec (đổi thư viện, đổi cấu trúc DB...), cập
  nhật lại PROJECT_BRIEF.md để tài liệu luôn khớp với code thực tế.
- Nếu cần quyết định mà spec không có, hỏi trước khi tự chọn — đặc biệt với các quyết định ảnh
  hưởng lâu dài (model AI, cấu trúc DB, tên biến môi trường).

## Lệnh thường dùng

```
npm run dev      # dev server (Turbopack)
npm run build
npm run lint
```

## Trạng thái hiện tại (Bước 1 — mục 12 PROJECT_BRIEF.md)

- Đã scaffold Next.js (TypeScript, App Router, Tailwind, npm) + client Supabase
  (`src/lib/supabase/{client,server,admin,middleware}.ts`) + `middleware.ts` refresh session.
- Migration khởi tạo `supabase/migrations/20260913000000_init_orders_generations.sql`
  (bảng `generations`, `orders`) — CHƯA áp dụng lên DB, cần chạy `npx supabase db push`
  (hoặc dán vào SQL Editor trên Supabase Dashboard) với project cloud đã có sẵn.
- Copy `.env.local.example` → `.env.local` (đã có sẵn), điền `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` từ Supabase Dashboard
  (Project Settings → API). Không dán các key này vào chat với Claude.
- Quyết định kỹ thuật phát sinh ngoài spec gốc:
  - Biến Supabase URL/anon key cần prefix `NEXT_PUBLIC_` (bắt buộc kỹ thuật của Next.js để
    client component đọc được) — khác tên gợi ý ở mục 10, không phải thay đổi nghiệp vụ.
  - `generations`/`orders` bật RLS nhưng KHÔNG có policy nào cho anon/authenticated — mọi
    đọc/ghi đi qua API route dùng `admin.ts` (service role). Không có tài khoản khách hàng
    (đúng mục 8-9), nên khóa chặt bảng ở tầng DB thay vì cố gắng viết RLS theo email.
## Trạng thái hiện tại (Bước 2 — module OpenAI)

- `src/lib/openai/{client,prompts,pipeline}.ts` — pipeline 2 bước (photo → painting → line art),
  `background: "opaque"`, `quality: "max"`, model `gpt-image-2.5-sunburst`.
- `src/lib/paper-sizes.ts` — nguồn duy nhất cho `PaperSize`, size ảnh AI (`AI_IMAGE_SIZE`), và
  kích thước in đích 300 DPI (`PRINT_TARGET_PX`).
- Route test độc lập: `POST /api/generate-preview` (multipart `image` + `paperSize`) — CHƯA có
  content moderation/watermark/rate-limit/lưu DB (đánh dấu `ponytail:` trong code, thêm ở bước 4
  và 9 của mục 12).
- Đã test build/lint pass. Đã điền `OPENAI_API_KEY` (người dùng tự làm), chưa test gọi API thật
  qua route này.

## Trạng thái hiện tại (Bước 3 — module Upscale)

- Quyết định giữ đúng thiết kế gốc trong PROJECT_BRIEF.md mục 2: **Upscayl là đường chính, fal.ai
  là fallback** (đã hỏi người dùng, người dùng chọn giữ nguyên spec thay vì đơn giản hoá còn
  fal.ai).
- Đã cài Upscayl qua `winget install Upscayl.Upscayl` (bản Windows local, có GPU/Vulkan).
  Binary mặc định: `C:\Program Files\Upscayl\resources\bin\upscayl-bin.exe`, models tại
  `C:\Program Files\Upscayl\resources\models` — override qua `UPSCAYL_BIN_PATH`/
  `UPSCAYL_MODELS_PATH`/`UPSCAYL_MODEL_NAME` khi deploy server khác (vd. Linux không có Upscayl
  cài sẵn thì luôn rơi vào nhánh fal.ai).
- Model Upscayl dùng: `digital-art-4x` (phù hợp line art/illustration hơn model ảnh chụp
  `realesrgan-x4plus`).
- `src/lib/upscale/upscayl.ts` — gọi CLI qua `child_process.execFile`, ném
  `UpscaylUnavailableError` khi lỗi/không tìm thấy binary.
- `src/lib/upscale/falai.ts` — fallback dùng model `fal-ai/esrgan` (Real-ESRGAN) qua
  `@fal-ai/client`. Cần biến env `FAL_KEY` (chưa thêm vào `.env.local.example`, cần bổ sung nếu
  dùng fallback thật).
- `src/lib/upscale/index.ts` — orchestrator: thử Upscayl trước, bắt `UpscaylUnavailableError` rồi
  fallback fal.ai, sau đó LUÔN resize chính xác bằng `sharp` về đúng `PRINT_TARGET_PX` (đảm bảo
  kích thước pixel-exact cho in ấn, bất kể upscaler nào chạy).
- Route test độc lập: `POST /api/upscale-test` — CHỈ dùng để test cục bộ, trả ảnh full-res qua
  API (route thật sau này KHÔNG được làm vậy — vi phạm quy tắc bảo mật doanh thu ở trên).
- Đã test end-to-end qua route test: ảnh 4x4px → upscale qua Upscayl thật (`digital-art-4x`) →
  resize `sharp` → output đúng 3543×4724px (khổ 30x40, 300 DPI). Build + lint pass.
- Bước tiếp theo theo mục 12: bước 4 (ghép flow generate + upscale thành API thật, có
  moderation/watermark/rate-limit/lưu DB) hoặc áp dụng migration DB nếu làm bước đó trước.

## Trạng thái hiện tại (Bước 4 — API generate thật + UI)

- Migration đã áp dụng lên DB cloud (`fqbdeylwvycmrkisnhia`) qua `npx supabase db push`. Bảng
  `generations`/`orders` đã tồn tại.
- 2 Storage bucket đã tạo trên Supabase: `generation-sources` (private, ảnh gốc khách upload) và
  `generation-previews` (public, ảnh preview có watermark) — quản lý qua
  `src/lib/supabase/storage.ts`.
- `src/lib/openai/moderation.ts` — `moderateImage()` dùng model `omni-moderation-latest`
  (`moderations.create` với `image_url` data URL), ném `ContentModerationError` kèm tên category
  bị flag. Gọi trước khi upload/generate để không tốn credit AI cho ảnh vi phạm.
- `src/lib/watermark.ts` — `applyWatermark()` phủ pattern text "PREVIEW – coloringposter.com"
  lặp lại, xoay -30°, bán trong suốt, dùng SVG + `sharp` composite. Áp dụng lên ảnh line art
  trước khi lưu vào bucket public.
- `POST /api/generate` — route thật thay thế `/api/generate-preview`: validate ảnh/email/khổ
  giấy → `moderateImage` → tạo `generationId` (UUID) → upload ảnh gốc vào bucket private →
  `generateColoringPage()` (pipeline 2 bước) → `applyWatermark()` → upload preview vào bucket
  public → insert row `generations` (status "completed") → trả về `{ generationId,
  previewImageUrl }`. CHƯA gọi module upscale ở route này — upscale full-res chỉ chạy sau khi
  thanh toán (đúng mục 3, tránh lộ ảnh full-res chưa trả tiền).
- `src/app/page.tsx` — thay UI mặc định bằng trang khách hàng thật: upload ảnh, nhập email,
  chọn khổ giấy, gọi `/api/generate`, hiển thị preview có watermark trả về.
- Chưa enforce rate-limit/CAPTCHA (mục 4) — email/IP đã lưu vào `generations` để dùng ở bước 9.
- Build (`npm run build`) và lint (`npm run lint`) đã pass — chỉ còn warning `next/image` không
  chặn build, chấp nhận được cho ảnh preview/blob URL động.
- Đã test end-to-end route `/api/generate` bằng API key thật: ảnh mẫu → HTTP 200 sau ~3m39s →
  `generationId` + `previewImageUrl` trả về, ảnh preview có watermark tải được công khai từ
  Supabase Storage, chất lượng line art tốt.
- Đã xoá các route/trang chỉ để test nội bộ (không còn cần sau khi có route thật):
  `/api/generate-preview`, `/api/full-pipeline-test`, `/api/upscale-test`, `/test`. Build lại
  xác nhận chỉ còn `/`, `/_not-found`, `/api/generate`.
- Bước tiếp theo theo mục 12: bước 5 trở đi (Gelato Prices API động theo quốc gia, mockup, stub
  checkout, fulfill module, webhook).
