# Coloring Poster — Project Brief for Implementation

> Đây là tài liệu đặc tả (spec) để đưa vào Claude Code làm điểm khởi đầu build project.
> Không chứa code — chỉ mô tả kiến trúc, luồng nghiệp vụ, và các quyết định kỹ thuật đã chốt.

---

## 1. Tổng quan sản phẩm

Web app cho phép khách hàng upload 1 ảnh (thường là ảnh trẻ em/gia đình/thú cưng), chuyển thành
tranh coloring book (line art đen trắng), xem trước (preview), rồi đặt in vật lý khổ lớn (poster)
gửi tận nhà thông qua dịch vụ print-on-demand Gelato.

Đối tượng khách hàng: quốc tế (Mỹ/Âu trước), mua làm quà tặng cá nhân hóa hoặc hoạt động trải
nghiệm gia đình (tự tô màu).

Mô hình khác biệt với đối thủ: đối thủ hiện tại chỉ bán file số (app coloring) hoặc thiết kế mẫu
có sẵn (Stuff2Color). Sản phẩm này kết hợp AI cá nhân hóa từ ảnh thật của khách + fulfillment vật
lý tự động (không phải app cung cấp file, mà là dịch vụ trọn gói tạo tranh + in + giao).

---

## 2. Tech stack đã chốt

- **Frontend/Backend**: Next.js
- **Database/Auth**: Supabase
- **AI xử lý ảnh**: OpenAI API — model `gpt-image-2.5-sunburst`
- **Upscale ảnh**: Upscayl (self-hosted/local) hoặc fal.ai upscaler làm fallback
- **Print-on-demand fulfillment**: Gelato API
- **Thanh toán**: PayPal (giai đoạn đầu); Airwallex Checkout (giai đoạn sau, cần hộ kinh doanh)
- **PDF/file generation** (nếu cần cho tài liệu phụ): pdfly (stack sẵn có của founder)

---

## 3. Pipeline xử lý ảnh (đã test và verify)

### Bước 1 — Kiểm duyệt nội dung
Ảnh khách upload phải qua content moderation trước khi xử lý tiếp.

### Bước 2 — AI transform (2 lần gọi API, cùng model)

**Model:** `gpt-image-2.5-sunburst` (KHÔNG dùng `gpt-image-1`, đã deprecated 23/10/2026)

**Tham số bắt buộc cho cả 2 lần gọi:**
- `background: "opaque"` — QUAN TRỌNG: bắt buộc phải set, nếu để mặc định "auto" model có thể
  xuất nền trong suốt, gây lỗi nghiêm trọng khi flatten/upscale sau này (nền biến thành đen,
  nét line art đen hòa lẫn vào nền, ảnh không dùng được)
- `quality: "max"` hoặc `"xhigh"`
- `size`: custom WIDTHxHEIGHT khớp đúng tỷ lệ khổ giấy khách chọn (xem bảng mục 5)

**Gọi lần 1 — Photo → Painting đơn giản hóa:**
```
Repaint this photo as a simple, flat illustration. Preserve the subject's likeness and
proportions accurately. Reduce fine texture, background clutter, and busy details into
clean simple shapes. Flatten complex lighting and shadows. Clean storybook illustration
style, minimal detail.
```

**Gọi lần 2 — Painting → Coloring book line art** (dùng ảnh kết quả bước 1 làm input):
```
Convert this illustration into a professional coloring book page. Black and white line
art only, bold clean closed outlines, consistent line weight throughout. No shading, no
gray tones, no color, no background texture. Pure white background.
```

> Lưu ý: đã test và xác nhận cách 2 bước cho kết quả tốt hơn 1 bước trực tiếp với ảnh có nền
> phức tạp. KHÔNG thêm logic "để AI tự quyết định giữ/bỏ nền" vào prompt — đã test và cho kết
> quả tệ hơn (ảnh bị kéo về hướng photorealistic thay vì giữ style minh họa).

### Bước 3 — Preview
- Hiển thị ảnh kết quả bước 2 ở nguyên độ phân giải AI trả về (~1024-1536px, đủ cho màn hình,
  không đủ để in) — KHÔNG cần downscale thêm, đã ở đúng mức "độ phân giải màn hình"
- Thêm watermark mờ, nhẹ, lặp lại nhiều vị trí (không đặt góc — dễ bị crop bỏ)
- Render qua canvas/img trong HTML, backend KHÔNG bao giờ trả file gốc không watermark xuống
  client ở bước này

### Bước 4 — Sau khi khách xác nhận + thanh toán
- Lưu lại toàn bộ tham số đã dùng (prompt, seed nếu có, model version) gắn với đơn hàng, để
  tái tạo đúng y bản khách đã duyệt
- Chạy lại API tạo bản sạch, không watermark, cùng tham số
- Upscale lên đủ độ phân giải cho khổ giấy đã chọn (xem công thức mục 5)
- File độ phân giải cao KHÔNG BAO GIỜ đi qua client — chỉ truyền nội bộ server → Gelato

---

## 4. Chống lạm dụng AI (miễn phí có giới hạn)

- Giới hạn 3-5 lượt tạo/email/ngày cho preview miễn phí
- Yêu cầu email trước khi tạo ảnh đầu tiên (không cần tài khoản đầy đủ)
- Rate limiting theo IP/thiết bị để chặn tạo nhiều tài khoản né limit
- CAPTCHA đơn giản trước khi gọi AI
- Set cảnh báo chi tiêu trên OpenAI/Replicate khi vượt ngưỡng $/ngày

---

## 5. Khổ giấy, tỷ lệ, và độ phân giải cần thiết

3 khổ chính (theo khuyến nghị chính thức Gelato — KHÔNG dùng chuẩn A-series vì khó tìm khung
matching và gây lệch tỷ lệ khi đổi cm/inch):

| Khổ | Tỷ lệ | Size tạo ảnh AI (WIDTHxHEIGHT) | Cần đạt sau upscale (300 DPI) |
|---|---|---|---|
| 30x40cm / 12x16in | 3:4 | 1536x2048 | 3543x4724px |
| 50x70cm / 20x28in (mặc định) | 5:7 | 1520x2128 | 5906x8268px |
| 70x100cm / 28x40in | 7:10 | 1568x2240 | 8268x11811px |

Ràng buộc API `gpt-image-2.5-sunburst` cho custom size:
- Cạnh chia hết cho 16
- Tỷ lệ dài/ngắn trong khoảng 1:3 đến 3:1
- Tổng pixel: 655,360 – 8,294,400
- Cạnh dài nhất tối đa 3840px

Vật liệu giấy: Premium Matte (200gsm) mặc định, Archival Matte (250gsm) tùy chọn cao cấp.
KHÔNG dùng Semi-glossy (không hợp để tô).

---

## 6. Tích hợp Gelato

**Base URLs:**
- Orders: `order.gelatoapis.com`
- Product Catalog/Prices: `product.gelatoapis.com`
- Shipment: `shipment.gelatoapis.com`
- Ecommerce (custom store templates): `ecommerce.gelatoapis.com`

**Setup cần làm trên Dashboard trước khi code (thủ công, 1 lần):**
1. Tạo tài khoản, kết nối Custom Store qua API
2. Tạo Product Template cho từng biến thể (khổ × giấy × khung) → lấy `productUid`
3. Tạo mockup template (vị trí đặt ảnh trong khung cảnh mẫu) cho tính năng preview mockup

**Endpoints cần dùng:**
- `GET /v3/products/{productUid}/prices?country=&currency=` — lấy giá cơ sở động theo quốc gia
  khách, dùng để tính giá bán = giá cơ sở + margin
- Product API (mockup generation) — tạo ảnh mockup (tranh trong khung treo tường) từ ảnh khách
  + template, hiển thị trên web app
- Shipment/Quote Order API — ước tính phí ship trước khi hiển thị tổng giá
- Order API — tạo đơn in thật sau khi khách thanh toán
- Webhooks (`order.gelatoapis.com`) — theo dõi trạng thái đơn (đang in/đã gửi/đã giao)

**Lưu ý:** giá cơ sở khác nhau theo quốc gia sản xuất/giao hàng — PHẢI query động theo địa chỉ
khách nhập, không hardcode 1 giá cố định.

---

## 7. Luồng thanh toán (2 giao dịch tách biệt) — HOÃN LẠI, chưa build ngay

> **Quyết định:** bỏ qua việc tích hợp thanh toán ở giai đoạn build hiện tại. Build toàn bộ
> pipeline (AI, preview, mockup, tính giá) trước; phần thanh toán chỉ chuẩn bị và tích hợp khi
> thực sự sẵn sàng launch. Trong lúc code, để checkout ở dạng stub/mock (giả lập "thanh toán
> thành công" để có thể test full flow tới bước tạo Gelato order) — không chặn tiến độ các phần
> khác vì chưa chốt cổng thanh toán.

Thiết kế dự kiến khi tới lúc tích hợp thật (2 giao dịch tách biệt):

1. **Khách → Founder**: qua PayPal (giai đoạn đầu) trên web app, thu đủ giá bán
2. **Founder → Gelato**: thẻ liên kết sẵn với tài khoản Gelato, tự động trừ theo giá cơ sở khi
   gọi Order API

Margin = Giá bán − Giá cơ sở Gelato − Chi phí AI (~$0.07/ảnh cho 2 lần gọi) − Phí xử lý PayPal

> Ghi chú: KHÔNG dùng Lemon Squeezy (chỉ hỗ trợ sản phẩm số, không hỗ trợ hàng vật lý cần ship).
> KHÔNG dùng Stripe trực tiếp (không hỗ trợ tài khoản đăng ký tại Việt Nam).

**Việc cần chuẩn bị trước khi launch thật** (làm song song, không chặn việc code):
- Xác nhận PayPal Business có bị gắn cờ "high-risk" cho ngành merch/POD không
- Hỏi Payoneer xem tài khoản Individual có đủ điều kiện dùng Payoneer Checkout không
- Cân nhắc đăng ký hộ kinh doanh để mở khóa Airwallex Checkout (ổn định hơn về lâu dài)

---

## 8. Luồng người dùng đầy đủ (end-to-end)

1. Khách upload ảnh → nhập email (giới hạn chống lạm dụng)
2. Chọn khổ mong muốn → hệ thống chạy pipeline AI (mục 3, bước 1-3) → hiển thị preview có
   watermark
3. Khách xem mockup (tranh trong khung cảnh phòng khách mẫu) qua Gelato Product/mockup API
4. Khách không ưng → có thể yêu cầu tạo lại (giới hạn số lần miễn phí)
5. Khách ưng ý → chọn loại giấy, có/không khung, nhập địa chỉ giao hàng
6. Hệ thống tự tính giá (Prices API) + phí ship (Shipment API) → hiển thị tổng giá
7. Khách thanh toán (PayPal)
8. Backend: tạo bản sạch không watermark → upscale đúng khổ → gọi Order API tới Gelato
9. Gelato tự in, đóng gói, giao hàng — theo dõi qua webhook, thông báo khách qua email ở các
   mốc quan trọng (đang xử lý / đã gửi / đã giao)

---

## 9. Việc KHÔNG làm (out of scope cho bản đầu)

- KHÔNG cho khách tô màu trên web trước khi in (đã quyết định bỏ — giữ nguyên trải nghiệm tự
  tô tay bằng vật liệu thật)
- KHÔNG dùng subscription — mô hình trả theo đơn (pay-per-order)
- KHÔNG cần tích hợp kênh nội địa Việt Nam trong bản đầu (kênh quốc tế qua Gelato làm trước)
- KHÔNG cần Magic Mockups (AI-generated mockup scenes) của Gelato — dùng template mockup cố
  định để tránh giới hạn 30 lượt/tháng

---

## 10. Biến môi trường cần chuẩn bị

```
OPENAI_API_KEY=
GELATO_API_KEY=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## 11. Gợi ý cấu trúc thư mục (Next.js)

```
/app
  /api
    /generate-preview      # gọi OpenAI, trả ảnh preview + watermark
    /generate-mockup       # gọi Gelato Product API
    /quote                 # gọi Gelato Prices + Shipment API
    /checkout              # tạo PayPal order
    /webhooks/paypal
    /webhooks/gelato
    /fulfill               # sau thanh toán: upscale + tạo Gelato order
  /(customer-facing pages)
/lib
  /openai.ts              # wrapper gọi gpt-image-2.5-sunburst, 2 bước
  /gelato.ts              # wrapper các endpoint Gelato
  /upscale.ts             # gọi Upscayl/fal.ai
  /rate-limit.ts          # chống lạm dụng
/supabase
  /migrations
```

---

## 12. Thứ tự implement gợi ý cho Claude Code

1. Setup Next.js project + Supabase (auth, bảng orders/generations)
2. Module gọi OpenAI (2 bước, đúng tham số mục 3) — test độc lập trước khi build UI
3. Module upscale — test độc lập
4. UI upload + preview flow (chưa cần thanh toán)
5. Tích hợp Gelato Prices + mockup API
6. Checkout dạng STUB (giả lập thanh toán thành công) — chỉ để nối thông toàn bộ luồng, chưa
   tích hợp cổng thanh toán thật
7. Module fulfill (upscale bản cuối + tạo Gelato order) sau khi "thanh toán" (stub) thành công
8. Webhooks + trạng thái đơn hàng
9. Rate limiting/chống lạm dụng (có thể làm sớm hơn nếu deploy public trước khi launch chính
   thức)
10. **Trước khi launch thật:** thay stub ở bước 6 bằng cổng thanh toán thật đã chốt (xem mục 7
    — cần hoàn tất việc xác minh PayPal/Payoneer/Airwallex trước bước này)

---

## 13. Phase 2 — Mở rộng: bản tô màu sẵn ("Portrait Art")

> Triển khai SAU KHI dòng Coloring Poster (Phase 1) đã có đơn hàng thật ổn định. Không build
> song song với Phase 1 để tránh pha loãng thông điệp marketing ("trải nghiệm tự tô tay").

### Kiến trúc: rẽ nhánh sau line art, KHÔNG tạo pipeline riêng

Quyết định quan trọng: KHÔNG tạo nhiều nhánh prompt riêng từ ảnh gốc (đã thử hướng đó và gặp vấn
đề model kéo kết quả về hướng photorealistic dù đã thêm "NOT photorealistic" vào prompt). Thay
vào đó, dùng chính ảnh line art đã tạo ở Bước 2 (mục 3) làm input cho bước tô màu mới — vì input
đã là tranh vẽ (không phải ảnh thật), rủi ro bị kéo về photorealistic gần như không còn.

```
Bước 2 (đã có): Photo → Painting → Line art
                                      │
                                      ├── Khách chọn "để tự tô" → dừng ở đây (Phase 1, mặc định)
                                      │
                                      └── Khách chọn "xem bản tô sẵn" → Bước C (mới)
```

### Bước C — Tô màu từ line art (input luôn là ảnh line art, không phải ảnh gốc)

Khách chọn 1 trong các style tô màu có sẵn (bảng dưới). Mỗi style dùng chung 1 khung prompt,
chỉ đổi phần mô tả chất liệu. Câu bắt buộc trong MỌI prompt style: `Keep all original line art
outlines intact and visible.` — đảm bảo nét gốc khách đã duyệt không bị vẽ đè.

| Style | Prompt |
|---|---|
| Crayon trẻ em | `Color in this line art as if hand-colored with crayons by a child. Warm cheerful colors, visible crayon texture, slight color bleeding at edges. Add simple decorative elements (hearts, sun, flowers) in the background in matching crayon style. Keep all original line art outlines intact and visible.` |
| Màu nước nhẹ nhàng | `Color in this line art with soft watercolor washes. Translucent, gentle color blending, light pastel tones, visible paper texture. Keep all original line art outlines intact and visible.` |
| Flat/vector hiện đại | `Color in this line art with flat, solid colors — no shading, no texture, clean modern illustration style. Bold color choices, minimal palette (4-6 colors). Keep all original line art outlines intact and visible.` |
| Chì màu | `Color in this line art as if colored with colored pencils. Soft blended shading, visible pencil strokes, slightly textured coverage rather than perfectly flat color. Keep all original line art outlines intact and visible.` |
| Cartoon rực rỡ | `Color in this line art with vibrant cartoon-style flat colors and simple cel-shading (basic highlight and shadow blocks). Bright, saturated palette. Keep all original line art outlines intact and visible.` |
| Street art / Graffiti | `Color in this line art in a street art / graffiti style. Bold spray-paint texture, vibrant neon or high-contrast color combinations, drip effects and splatter accents around edges. Add graffiti-style decorative elements in the background if left blank. Keep all original line art outlines intact and visible.` |
| Trừu tượng | `Color in this line art using an abstract art style. Bold geometric color blocks and organic shapes that don't strictly follow realistic color logic. Inspired by abstract expressionism and modern art. Keep all original line art outlines intact and visible.` |

> Cần test kỹ trước khi launch: Street art (rủi ro hiệu ứng drip/splatter tràn lộn xộn ở khổ in
> lớn) và Trừu tượng (kết quả khó đoán nhất, cần nhiều lượt test hơn các style khác).

### Vật liệu/sản phẩm mở khóa thêm cho dòng này

Vì đây là tranh đã hoàn thiện (không cần tô tay), giới hạn "phải dùng giấy uncoated" của Phase 1
không áp dụng — có thể mở thêm: Canvas (gallery-wrapped), Glossy/Satin poster, Metal print.

### Thay đổi kỹ thuật cần thêm

- Bảng `art_styles` trong DB (tên, prompt, ảnh mẫu minh họa) — dễ thêm/bớt style không cần sửa
  code core
- UI: sau khi xem line art, thêm lựa chọn "Xem bản đã tô màu sẵn" → hiện lưới chọn style
- Cần thêm mockup template riêng cho canvas/glossy (khác template khung treo tường của Phase 1)

---

## 14. Phase 3 — Tùy chọn nâng cao: khách upload ảnh tham chiếu phong cách

> Chỉ làm sau khi Phase 2 đã chạy ổn và có dữ liệu thực tế cho thấy nhu cầu tùy biến vượt ra
> ngoài 7 style cố định là đủ lớn để đáng đầu tư.

Cho phép khách upload thêm 1 ảnh tham chiếu (style/màu sắc mong muốn) bên cạnh ảnh line art,
dùng làm input thứ 2 trong cùng 1 lần gọi API (model hỗ trợ tối đa 10 ảnh reference/lần gọi).

**Prompt mẫu:**
```
Image 1 is a line art coloring page. Image 2 is a style reference showing the desired
color palette and artistic technique. Color Image 1 using the color palette, mood, and
artistic style shown in Image 2 — match the color choices and rendering technique, but
keep all outlines and composition exactly as they appear in Image 1. Do not alter the
subject or composition from Image 1.
```

**Lưu ý khi implement:**
- Định vị là tùy chọn cao cấp (premium), riêng biệt với 7 style dựng sẵn
- Ảnh tham chiếu khách upload cũng phải qua content moderation như ảnh gốc
- Kết quả khó đoán hơn nhiều so với 7 style cố định → tính thêm buffer chi phí AI cho tỷ lệ
  tạo lại cao hơn
- Luôn bắt buộc qua bước preview/duyệt trước khi tính là đơn đã chốt (không dùng chung logic
  "auto-approve" nào nếu có, vì rủi ro lệch kỳ vọng cao hơn hẳn)
