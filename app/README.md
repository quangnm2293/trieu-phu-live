# AI LÀ TRIỆU PHÚ LIVE — Hướng dẫn chạy & vận hành

Game đố vui kiểu "Ai là triệu phú" cho TikTok LIVE: khán giả comment đáp án, người **đúng & nhanh nhất** ở câu hỏi loại giành **ghế nóng** leo thang 15 câu tới **150.000.000 điểm**.

> ⚠️ Thang điểm là **ĐIỂM trong game** — không phải tiền thật, không quy đổi, không trao thưởng. Quà TikTok chỉ vào bảng ủng hộ riêng, không mua được điểm thi đấu hay đáp án.

## 1. Thứ tự chạy

```bash
# 1) Dịch vụ sự kiện (nếu chưa chạy) — ở thư mục tiktok-live-feed:
#    npm start            → ws://localhost:3010/events

# 2) Server game (thư mục này):
cd app
npm install              # chỉ lần đầu (phụ thuộc duy nhất: ws)
npm start                # cổng 3021
```

- **Sân khấu:** http://localhost:3021/ — đưa vào LIVE Studio/OBS làm nguồn trình duyệt.
  - Thêm `?obs=1` để ẩn nút tiếng + chip debug (khuyến nghị khi lên sóng).
  - Thêm `?mute=1` để tắt giọng MC ngay từ đầu.
- **Admin / giả lập:** http://localhost:3021/admin — bơm sự kiện tay, bật bot khán giả, trao ghế nóng thủ công, thêm câu hỏi, reset điểm buổi.

## 2. Giọng MC (Meta TTS — giọng MAI_03) + luật "đọc xong mới tính giờ"

- Toàn bộ giọng đọc được **sinh sẵn** bằng `node tools/gen-audio.js` (gọi `/opt/hatch/bin/tts`, giọng `avocado_v2:MAI_03` — giọng đã duyệt cho video ReviewHub):
  - **31 clip MC cố định** trong `audio/mc/` (chào mở buổi, giới thiệu vòng loại, công bố ghế nóng, "Câu hỏi số X trị giá…" đủ 15 cấp, đúng/sai, mốc 5/10, 3 trợ giúp, dừng cuộc chơi, quán quân…).
  - **1.000 clip câu hỏi** trong `audio/questions/<id>.mp3` — mỗi câu đọc cả 4 đáp án.
  - Hiện trạng sinh: **1.031/1.031 clip** (xem `audio/manifest.json`). Thiếu clip nào game vẫn chạy — stage tự bỏ qua; chạy lại `gen-audio.js` để sinh bổ sung (file đã có sẽ bỏ qua). Thêm câu hỏi mới qua admin thì chạy lại tool để có giọng cho câu đó.
- **Đọc xong mới tính giờ (luật cốt lõi):** khi một câu hỏi mở (câu loại lẫn câu ghế nóng), game vào **pha đọc**: câu hỏi + 4 đáp án hiện lên, MC đọc clip, nhưng **đồng hồ trả lời chưa chạy và đáp án gửi vào chưa được tính** (không khóa, không đếm — trả lời lại sau khi mở vẫn tính bình thường). Sân khấu hiện huy hiệu "🎙 MC ĐANG ĐỌC CÂU HỎI…" + thanh tiến trình đọc, đáp án mờ chờ. **Cửa sổ trả lời** (15 giây câu loại / 30 giây ghế nóng) chỉ mở khi việc đọc kết thúc, theo tín hiệu nào tới trước:
  1. **Tín hiệu của stage (chính):** clip đọc câu hỏi phát xong (hoặc lỗi/thiếu file) → stage gọi `POST /api/stage/audio-done {qid}` → server mở cửa sổ ngay. Stage đang tắt tiếng (`?mute=1` hoặc bấm 🔇) thì báo ngay khi cue được xử lý, không bắt khán giả chờ.
  2. **Dự phòng phía server:** thời lượng clip (từ `audio/durations.json`, sinh bằng `node tools/gen-durations.js` — `gen-audio.js` đã tự chạy lại bước này sau mỗi lần sinh giọng) **+ 1,5 giây đệm** kể từ lúc mở câu (cộng cả clip giới thiệu phát trước clip câu hỏi). Nhờ vậy stage mất tín hiệu thì game vẫn không kẹt.
  - Thời gian "trả lời nhanh" (xếp hạng TOP 5, chốt sớm vòng loại) tính **từ mốc cửa sổ mở**, không tính thời gian đọc. Bonus Nhiệt huyết +10 giây cộng vào **cửa sổ trả lời** như cũ (đầy thanh trong lúc đọc thì cộng dồn chờ, áp dụng khi cửa sổ mở).
  - **Trợ giúp trong lúc đọc:** người ghế nóng gõ `50` / `ĐỔI` / `DỪNG` vẫn ăn ngay (đổi câu → đọc lại từ đầu với clip câu mới); gõ `KHÁN GIẢ` thì quyền bị tiêu luôn nhưng **phiếu chỉ mở khi cửa sổ trả lời mở** (chạy trọn 10 giây, đồng hồ đóng băng như thường lệ).
  - Hiệu chỉnh/kiểm thử: biến môi trường `READING_BUFFER_MS` (đệm, mặc định 1500), `READING_DEFAULT_MS` (thời lượng giả định khi thiếu durations, mặc định 12000), `READING_SCALE` (nhân thời lượng clip), `READING_TEST_MS` (>0 = ép cửa sổ đọc cố định — QA dùng).
  - State cho stage: `question.reading`, `question.readingEndsAt` (mốc mở ước lượng), `question.readingMs`, `question.answersOpen`; `timer` chỉ xuất hiện khi cửa sổ đã mở.
- Stage phát tiếng đồng bộ trạng thái: mở câu → đọc câu hỏi; chốt đáp án → câu chờ; công bố → đúng/sai; lên ghế → công bố ghế nóng. Hiệu ứng phụ (chuông đúng, trầm sai, tick 5 giây cuối) tổng hợp bằng WebAudio ngay trên stage.
- **Lưu ý OBS/trình duyệt:** trình duyệt chặn autoplay có tiếng — bấm/chạm **1 lần vào stage** để mở tiếng (stage có dòng nhắc; nếu bị chặn, clip sẽ phát bù ngay khi có thao tác đầu tiên). Nút 🔊 góc phải để tắt/bật nhanh.

## 3. Cách chơi (cho host đọc lên sóng)

- **Vòng loại:** câu hỏi hiện lên, MC đọc câu hỏi — **đọc xong** mới mở 15 giây trả lời, cả phòng comment `A`/`B`/`C`/`D`. Người **đúng và nhanh nhất** (tính từ lúc mở trả lời) lên ghế nóng. Không ai đúng → đổi câu loại khác.
- **Ghế nóng:** leo 15 câu, mỗi câu 30 giây **sau khi MC đọc xong câu hỏi**. Chỉ **đáp án đầu tiên** của người ghế nóng mới tính. Comment `DỪNG` để bảo toàn điểm của câu trước. Sai/hết giờ → rơi về mốc an toàn gần nhất (câu 5 = 2.000.000, câu 10 = 22.000.000). **Mọi cách kết thúc lượt (sai / dừng / quán quân) đều quay ngay về vòng loại chọn người mới.**
- **Trợ giúp** (mỗi quyền 1 lần/lượt, chỉ người ghế nóng gõ được): `50` = 50:50 · `KHÁN GIẢ` = hỏi ý kiến khán giả (bầu 10 giây, đồng hồ đóng băng) · `ĐỔI` = đổi câu cùng cấp.
- **Khán giả chơi cùng mọi câu:** đáp án đầu tiên bị khóa; đúng **+100 điểm**, TOP 5 đúng–nhanh nhất được thưởng thêm **+50/40/30/20/10**. Follow +200 (1 lần/buổi), share +50 (1 lần/10 phút). Like đổ thanh **Nhiệt huyết** — đầy 1.000 like trong lúc câu đang mở → ghế nóng **+10 giây** (tối đa 1 lần/câu).

## 4. Ngân hàng câu hỏi

- File `questions/bank.json`, định dạng: `{id, level (1–15), category, question, options {A,B,C,D}, correct, qualifier?}`.
- Hiện có **1.000 câu (66–67 câu/cấp) + 38 câu loại** (`qualifier: true`, độ khó tương đương cấp 3–6). Kiểm tra: `node test/validate-bank.js`.
- Thêm câu: qua form trong trang admin (tự kiểm tra trùng/thiếu) hoặc sửa JSON trực tiếp rồi chạy lại validator + `gen-audio.js` (gen-audio tự cập nhật `audio/durations.json` ở cuối — cần cho cửa sổ đọc của server; nếu sinh giọng bằng cách khác thì chạy thêm `node tools/gen-durations.js`).
- Server chống lặp trong buổi: câu đã dùng không rút lại; hết pool mới quay vòng (tránh 20 câu gần nhất).

## 5. Công bằng & dữ liệu

- Thứ hạng "nhanh nhất" tính theo **thời điểm máy chủ nhận được comment** (đồng hồ máy chủ) — độ trễ mạng từng người khác nhau, không có cách tuyệt đối công bằng trên live; luật này hiện công khai trên sân khấu.
- Điểm khán giả + bảng ủng hộ + câu đã dùng lưu theo ngày tại `data/scores-YYYY-MM-DD.json` (restart giữa buổi không mất). Nút **Reset điểm buổi** trong admin để bắt đầu buổi mới sạch.
- Cấu hình (thời gian các pha, thang điểm, điểm thưởng…) nằm hết trong `config.js`, ghi đè được bằng biến môi trường cùng tên.

## 6. Kiểm thử

```bash
node test/validate-bank.js   # kiểm định ngân hàng
node test/qa.js              # QA tự động toàn bộ luật chơi + pha đọc của MC (cổng riêng 3099)
node test/timer-check.js     # kiểm công thức đồng hồ đếm ngược của sân khấu
node test/audio-sync-test.js # kiểm đồng bộ tiếng/hình trên Chrome headless (cần Chrome qua puppeteer cache)
```
