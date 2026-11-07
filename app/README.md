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

## 2. Giọng MC (Meta TTS — giọng MAI_03)

- Toàn bộ giọng đọc được **sinh sẵn** bằng `node tools/gen-audio.js` (gọi `/opt/hatch/bin/tts`, giọng `avocado_v2:MAI_03` — giọng đã duyệt cho video ReviewHub):
  - **31 clip MC cố định** trong `audio/mc/` (chào mở buổi, giới thiệu vòng loại, công bố ghế nóng, "Câu hỏi số X trị giá…" đủ 15 cấp, đúng/sai, mốc 5/10, 3 trợ giúp, dừng cuộc chơi, quán quân…).
  - **135 clip câu hỏi** trong `audio/questions/<id>.mp3` — mỗi câu đọc cả 4 đáp án.
  - Hiện trạng sinh: **166/166 clip** (xem `audio/manifest.json`). Thiếu clip nào game vẫn chạy — stage tự bỏ qua; chạy lại `gen-audio.js` để sinh bổ sung (file đã có sẽ bỏ qua). Thêm câu hỏi mới qua admin thì chạy lại tool để có giọng cho câu đó.
- Stage phát tiếng đồng bộ trạng thái: mở câu → đọc câu hỏi; chốt đáp án → câu chờ; công bố → đúng/sai; lên ghế → công bố ghế nóng. Hiệu ứng phụ (chuông đúng, trầm sai, tick 5 giây cuối) tổng hợp bằng WebAudio ngay trên stage.
- **Lưu ý OBS/trình duyệt:** trình duyệt chặn autoplay có tiếng — bấm/chạm **1 lần vào stage** để mở tiếng (stage có dòng nhắc; nếu bị chặn, clip sẽ phát bù ngay khi có thao tác đầu tiên). Nút 🔊 góc phải để tắt/bật nhanh.

## 3. Cách chơi (cho host đọc lên sóng)

- **Vòng loại:** câu hỏi hiện lên, cả phòng comment `A`/`B`/`C`/`D`. Người **đúng và nhanh nhất** lên ghế nóng. Không ai đúng → đổi câu loại khác.
- **Ghế nóng:** leo 15 câu, mỗi câu 30 giây. Chỉ **đáp án đầu tiên** của người ghế nóng mới tính. Comment `DỪNG` để bảo toàn điểm của câu trước. Sai/hết giờ → rơi về mốc an toàn gần nhất (câu 5 = 2.000.000, câu 10 = 22.000.000). **Mọi cách kết thúc lượt (sai / dừng / quán quân) đều quay ngay về vòng loại chọn người mới.**
- **Trợ giúp** (mỗi quyền 1 lần/lượt, chỉ người ghế nóng gõ được): `50` = 50:50 · `KHÁN GIẢ` = hỏi ý kiến khán giả (bầu 10 giây, đồng hồ đóng băng) · `ĐỔI` = đổi câu cùng cấp.
- **Khán giả chơi cùng mọi câu:** đáp án đầu tiên bị khóa; đúng **+100 điểm**, TOP 5 đúng–nhanh nhất được thưởng thêm **+50/40/30/20/10**. Follow +200 (1 lần/buổi), share +50 (1 lần/10 phút). Like đổ thanh **Nhiệt huyết** — đầy 1.000 like trong lúc câu đang mở → ghế nóng **+10 giây** (tối đa 1 lần/câu).

## 4. Ngân hàng câu hỏi

- File `questions/bank.json`, định dạng: `{id, level (1–15), category, question, options {A,B,C,D}, correct, qualifier?}`.
- Hiện có **135 câu (9 câu/cấp) + 14 câu loại** (`qualifier: true`, độ khó tương đương cấp 3–6). Kiểm tra: `node test/validate-bank.js`.
- Thêm câu: qua form trong trang admin (tự kiểm tra trùng/thiếu) hoặc sửa JSON trực tiếp rồi chạy lại validator + `gen-audio.js`.
- Server chống lặp trong buổi: câu đã dùng không rút lại; hết pool mới quay vòng (tránh 20 câu gần nhất).

## 5. Công bằng & dữ liệu

- Thứ hạng "nhanh nhất" tính theo **thời điểm máy chủ nhận được comment** (đồng hồ máy chủ) — độ trễ mạng từng người khác nhau, không có cách tuyệt đối công bằng trên live; luật này hiện công khai trên sân khấu.
- Điểm khán giả + bảng ủng hộ + câu đã dùng lưu theo ngày tại `data/scores-YYYY-MM-DD.json` (restart giữa buổi không mất). Nút **Reset điểm buổi** trong admin để bắt đầu buổi mới sạch.
- Cấu hình (thời gian các pha, thang điểm, điểm thưởng…) nằm hết trong `config.js`, ghi đè được bằng biến môi trường cùng tên.

## 6. Kiểm thử

```bash
node test/validate-bank.js   # kiểm định ngân hàng
node test/qa.js              # QA tự động toàn bộ luật chơi (cổng riêng 3099)
```
