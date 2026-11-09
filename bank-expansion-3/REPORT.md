# BÁO CÁO MỞ RỘNG NGÂN HÀNG CÂU HỎI — ĐỢT 3 (09/11/2026)

Hai việc theo yêu cầu của đại ca: (1) thêm 500 câu hỏi (vòng loại + cấp 1–5);
(2) tính năng MC nhắc dùng quyền trợ giúp khi sắp hết giờ (báo cáo ở cuối).

## Kết quả ngân hàng sau ghép

| Nhóm | Trước đợt 3 | Thêm | Sau đợt 3 |
|---|---|---|---|
| Bậc thang cấp 1–5 | 134/cấp | +80/cấp | **214/cấp** |
| Bậc thang cấp 6–10 | 134/cấp | — | 134/cấp |
| Bậc thang cấp 11–15 | 132/cấp | — | 132/cấp |
| **Tổng bậc thang** | 2.000 | **+400** | **2.400** |
| Pool vòng loại | 62 | **+100** (qualifierOnly, trải đều cấp 3–6: 25/cấp) | **162** |
| **Tổng mục** | 2.024 | **+500** | **2.524** |

- Phân bố đáp án đúng của 500 câu mới: **A/B/C/D = 125/125/125/125** (đều tuyệt đối).
- Phân bố toàn ngân hàng bậc thang sau ghép (2.400 câu): A=603, B=608, C=598, D=591.
- ID mới: bậc thang q1-135…214, q2-135…214, q3-144…223, q4-156…235, q5-145…224;
  vòng loại q3-224…248, q4-236…260, q5-225…249, q6-143…167. Không trùng ID/nội dung với bank cũ.

> ⚠️ **Lưu ý số học trong đề bài:** đề ghi "tổng 2.500 bậc thang / 2.662 mục / 2.700 clip",
> nhưng phân bổ CHÍNH XÁC của chính đề (+80 × 5 cấp + 100 vòng loại = +500) cho ra
> 2.400 bậc thang / 2.524 mục / 2.562 clip. Báo cáo này và validate-bank.js đi theo
> phân bổ chính xác (+500 câu đúng như yêu cầu "thêm 500 câu hỏi").

## Quy trình khử trùng (2 lớp) + soạn bù

1. **Soạn vòng 1:** 500 câu (80/cấp 1–5 + 100 vòng loại) + 50 câu dự phòng.
2. **Khử trùng lớp 1 (máy):** trùng nguyên văn/Jaccard ≥ 0,8 so với toàn bộ 2.024 câu cũ
   + nội bộ → 127 mục bị loại tạm.
3. **Xét tay lớp 1:** 25 mục là ngộ nhận của máy (bài toán khác số liệu, khác thực thể,
   khác thuộc tính hỏi) → khôi phục; **102 loại thật**.
4. **Khử trùng lớp 2 (fact):** 721 cặp gắn cờ tương tự fact được 4 nhóm xét độc lập theo
   tiêu chí "cùng thực thể + cùng thuộc tính hỏi" → **loại thêm 147**.
   Tổng loại vòng 1: **249/500** (chủ yếu do người soạn vòng 1 chỉ đối chiếu corpus
   của cấp mình, trong khi fact kinh điển đã nằm rải ở các cấp khác của bank cũ).
   Bù từ dự phòng đạt chuẩn: +35 → ứng viên 286.
5. **Soạn bù vòng 2:** 214 câu mới, người soạn bắt buộc grep tránh trùng trên TOÀN BỘ
   corpus (2.024 cũ + 286 ứng viên) cho từng fact.
6. **Kiểm chứng vòng cuối trên tập 500 đã ghép:** rà lại toàn bộ cặp tương tự liên quan
   câu mới/dự phòng/restore → phát hiện và **loại thêm 26** (gồm 3 cặp trùng nguyên văn
   giữa các lô soạn bù độc lập: "17 × 4", "Kẹo dừa Bến Tre", "40% của 150"; các câu dự
   phòng lọt trùng: Đông Du, Lục Vân Tiên, Đôn Kihôtê, UN New York…; 2 câu restore nhầm:
   "2 mũ 5" và "hành tinh gần Mặt Trời nhất" vốn đã có ở bank cũ). Thay bằng dự trữ +
   8 câu soạn tay có grep kiểm chứng.
7. **Kết quả cuối:** đủ 500/500, kiểm tra trùng cứng ngưỡng 0,85 trên tập cuối = 0
   (trừ cặp "4 mũ 3" vs "3 mũ 4" — khác bài toán, đã xét giữ).

## Rà đáp án mù (solver độc lập)

- 2 solver KHÔNG xem đáp án gốc, giải toàn bộ 500 câu (mỗi solver 250).
- **Tranh chấp: 1/500** — q4-241 (bóng rổ): solver chọn C, đáp án gốc B; nguyên nhân là
  đề mơ hồ ("trong vòng ba điểm"). Đã sửa đề thành "…từ vị trí bên trong vạch ba điểm…"
  → đáp án B (2 điểm) chặt chẽ.
- **Câu hỏng được gắn cờ: 5** → đã sửa cả 5:
  - q4-241: sửa chữ đề (như trên).
  - q4-177: đề tự lộ đáp án ("tuồng (hát bội)" trong thân câu) → viết lại đề, bỏ cụm lộ.
  - q3-234 (vải thiều Lục Ngạn), q3-238 (Đèo Ngang), q6-156 (nho): đáp án có cả tên tỉnh
    TRƯỚC và SAU sáp nhập hành chính 2025 trong cùng bộ lựa chọn → hai đáp án đều bảo vệ
    được. Đã thay lựa chọn mang tên tỉnh sau sáp nhập bằng tỉnh khác; đáp án giữ theo tên
    truyền thống — nhất quán với toàn bộ ngân hàng hiện hữu (vẫn dùng địa danh trước 2025).
- Ngoài 5 câu trên: 0 câu sai đáp án, 0 câu hai đáp án đúng theo solver.

## Thu tiếng (audio)

- Tổng nhu cầu: **2.562 clip** (2.524 câu hỏi + 38 MC) — durations.json đủ 2.562 mục,
  manifest: generated 2.553, "missing" 9 (xem dưới). Mọi clip đều CÓ file trên đĩa.
- 500 clip câu hỏi mới: **đều ≤ 30 giây**. Riêng q5-151 (Istanbul/Constantinople) bị TTS
  suy biến 46,9s vì cụm từ nước ngoài → đổi diễn đạt đề ("Đế quốc Byzantine" →
  "đế quốc La Mã phương Đông", giữ nguyên fact + đáp án) → clip đạt 14,84s.
- **Clip > 30s còn lại: 9 clip, TẤT CẢ thuộc ngân hàng cũ** (không có câu mới nào):
  q11-076 (46,4s), q8-081 (40,2s), q14-112 (40,0s), q15-077 (38,6s), q14-082 (37,9s),
  q14-135 (37,0s), q13-020 (36,8s), q6-088 (35,0s), q8-112 (34,0s). Đã xử lý lại bằng
  tách đoạn (gen-audio + fix-long-clips) như đợt merge trước nhưng TTS vẫn trả đoạn dài
  bệnh — giữ làm ngoại lệ như đợt 2: cửa sổ đọc dùng thời lượng thật + tín hiệu
  audio-done của stage nên không ảnh hưởng luật chơi.

## Tính năng: MC nhắc dùng quyền trợ giúp khi sắp hết giờ

- `config.js`: thêm `LIFELINE_REMIND_MS` (mặc định **10.000 ms**, ghi đè bằng env).
- `game.js`: cờ `ctx.lifelineReminded` (mỗi câu tối đa 1 lần). Trong tick pha `question`:
  khi cửa sổ trả lời đang mở, ghế nóng CHƯA chốt đáp án, không đang bầu phiếu khán giả,
  VẪN CÒN ≥ 1 quyền trợ giúp (50:50 / KHÁN GIẢ / ĐỔI) và thời gian còn **≤ 10 giây**
  (và > 0) → cue `mc/lifeline-remind` + announce "⏰ Sắp hết giờ! Ghế nóng còn quyền
  trợ giúp — gõ 50 / KHÁN GIẢ / ĐỔI nếu cần!".
- Clip MC mới `mc/lifeline-remind` (MAI_03, 6,96s): "Sắp hết giờ rồi! Ghế nóng vẫn còn
  quyền trợ giúp, hãy gõ 50, KHÁN GIẢ hoặc ĐỔI câu nếu cần nhé!" — MC cố định 37 → 38 clip.
- Test mới `app/test/lifeline-remind-test.js` — 3 kịch bản đều PASS:
  (a) không trả lời → nhắc đúng 1 lần khi còn ~3,9s (ngưỡng test 4s);
  (b) trả lời sớm → không nhắc; (c) dùng hết 3 trợ giúp → không nhắc dù sắp hết giờ.

## Kiểm thử toàn bộ trên bản cuối

| Suite | Kết quả |
|---|---|
| validate-bank (BANK) | **PASS** — 2.400 bậc thang + 162 vòng loại, 2.524 mục |
| qa | **PASS** |
| timer-check | **PASS** |
| audio-sync-test | **PASS** |
| name-joke-test | **PASS** |
| poll-stale-test | **PASS** |
| reveal-audio-test | **PASS** |
| reveal-fastest-test | **PASS** |
| lifeline-remind-test | **PASS** (3/3 kịch bản) |

## File đợt 3 được commit kèm

- `bank-expansion-3/bank-additions.json` — 400 câu bậc thang mới (đã gán ID).
- `bank-expansion-3/qualifier-additions.json` — 100 câu vòng loại mới (đã gán ID + cờ).
- `bank-expansion-3/REPORT.md` — báo cáo này.
- Các file nháp/verdict/script trung gian trong `bank-expansion-3/` KHÔNG commit (scratch).
