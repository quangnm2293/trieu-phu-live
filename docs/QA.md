# AI LÀ TRIỆU PHÚ LIVE — Hồ sơ QA (07/11/2026)

## 1. QA tự động luật chơi — `node test/qa.js`

Cách chạy: QA tự khởi động server trên cổng riêng 3099 với bộ đếm thời gian rút gọn, **chỉ lái game qua HTTP** (`/api/sim`, `/api/state`, `/api/admin/state`) — không gọi trực tiếp engine. File điểm ngày được sao lưu trước và khôi phục sau khi chạy. Kết quả (nguyên văn, chạy trên code cuối cùng):

```
QA: server boot, state sẵn sàng OK
QA: vòng loại có người thắng OK
QA: ghế nóng = người đúng NHANH NHẤT (user_a) OK
QA: TOP 5 vòng loại xếp tăng dần theo thời gian, không có người sai OK
QA: lượt ghế nóng bắt đầu với user_a OK
QA: state có audio key của câu hiện tại (q/q1-001) OK
QA: đáp án đầu tiên của khán giả bị KHÓA (sửa sau không tính) OK
QA: ghế nóng đúng câu 1 OK
QA: TOP 5 khán giả câu 1: user_e đúng & nhanh nhất OK
QA: % đúng khán giả chính xác (1/2 = 50%) OK
QA: đúng câu 1 → lên câu 2 OK
QA: 50:50 loại đúng 2 đáp án SAI OK
QA: qua câu 2 bằng đáp án đúng sau 50:50 OK
QA: đồng hồ câu hỏi ĐÓNG BĂNG trong lúc hỏi khán giả OK
QA: kết quả phiếu: đáp án đúng 50%, tổng ≈100% (100%) OK
QA: đồng hồ chạy tiếp với thời gian còn lại sau phiếu (19893ms so với 19927ms trước phiếu — không mất 3s bầu) OK
QA: qua câu 3 sau khi hỏi khán giả OK
QA: đổi câu: câu mới CÙNG cấp độ (câu 4) OK
QA: qua câu 4 sau khi đổi câu OK
QA: leo qua mốc câu 5, tới câu 7 OK
QA: sai ở câu 7 → rơi về mốc 2.000.000 điểm (thực tế: 2000000) OK
QA: sau khi ghế nóng sai → pha tiếp theo là QUALIFIER với câu loại MỚI OK
QA: DỪNG ở câu 3 → giữ điểm câu 2 = 400.000 (thực tế: 400000) OK
QA: sau khi DỪNG → cũng quay về vòng loại OK
QA: like đầy thanh → ghế nóng +10 giây (endsAt +10000ms) OK
QA: đầy thanh lần 2 trong CÙNG câu → không cộng giờ nữa OK
QA: màn nghỉ hiện Bảng vàng khán giả có user_e (đúng + thưởng tốc độ) OK
QA: buổi live tự lặp: nghỉ → vòng loại tiếp theo OK
QA: audio MC cố định đủ 31/31 clip OK
QA: audio câu hỏi có 135/135 clip
QA: audio cho MỌI câu hỏi trong ngân hàng đều tồn tại OK
QA: ngân hàng hợp lệ: 135 câu, câu loại 14 OK
QA PASS
```

Các mục kiểm theo yêu cầu bổ sung đều có mặt: **sai → quay về qualifier với câu loại mới**, **DỪNG → cũng về qualifier**, **state có audio key**, **file audio tồn tại cho mọi câu hỏi**.

## 2. Kiểm định ngân hàng — `node test/validate-bank.js`

```
Ngân hàng câu hỏi: app/questions/bank.json
  Cấp  1: 9 câu
  Cấp  2: 9 câu
  Cấp  3: 9 câu
  Cấp  4: 9 câu
  Cấp  5: 9 câu
  Cấp  6: 9 câu
  Cấp  7: 9 câu
  Cấp  8: 9 câu
  Cấp  9: 9 câu
  Cấp 10: 9 câu
  Cấp 11: 9 câu
  Cấp 12: 9 câu
  Cấp 13: 9 câu
  Cấp 14: 9 câu
  Cấp 15: 9 câu
  TỔNG: 135 câu · câu loại (qualifier): 14
  Phân bố đáp án đúng: A=36 B=36 C=34 D=29
BANK PASS
```

## 3. Âm thanh — `node tools/gen-audio.js`

```
AUDIO: đã sinh 166/166 clip (MC cố định 31 + câu hỏi 135)
AUDIO: manifest → app/audio/manifest.json
```
Giọng `avocado_v2:MAI_03` qua `/opt/hatch/bin/tts` (cùng đường như engine video ReviewHub). Một clip (q10-003) lỗi ở lượt sinh đầu, đã sinh bổ sung ở lượt chạy lại — đủ 166/166.

## 4. Ảnh chụp sân khấu (Chrome headless 1080×1920, chế độ `?obs=1`, bot khán giả chơi thật)

Thư mục `shots/`:

- **qualifier.png** — vòng loại đang mở: tiêu đề vàng, vòng avatar trống với đếm ngược, thông báo follow, panel câu hỏi loại, 4 đáp án pill ◆ A–D, thang điểm 15 bậc bên phải (mốc ★ ở câu 5/10), thanh Nhiệt huyết 61/1.000, dòng "Đã có 13 người trả lời câu này" và hướng dẫn comment.
- **question.png** — câu 1 của ghế nóng "Minh Anh": avatar chữ M trong vòng đếm giờ vàng, 3 chip trợ giúp (50:50 / KHÁN GIẢ / ĐỔI CÂU), bậc 1 của thang sáng vàng, panel "CÂU 1 · Đời sống · TRỊ GIÁ 200.000 ĐIỂM", Nhiệt huyết 207/1.000.
- **reveal.png** — công bố đáp án: ô B xanh lá (đáp án đúng), bảng "ĐÚNG & NHANH NHẤT — CÂU NÀY" đủ TOP 5 kèm thời gian kiểu `1,49s` và điểm cộng (+150…+110), dòng thống kê "Đáp án đúng: B · 6/13 người trả lời đúng (46%)".
- **intermission.png** — nghỉ giải lao: panel chào mừng, **Bảng vàng khán giả** (bot demo: ga_rung 150, hong_nhung 140…) cạnh **Top ủng hộ hôm nay**, dòng luật chơi tóm tắt, đếm ngược tới vòng loại. (Chụp với FEED_URL trỏ cổng trống để ảnh không lẫn dữ liệu của feed giả lập đang chạy trong máy.)

Đã soi ảnh và sửa 2 lỗi trình bày trước khi chụp bản cuối: ẩn các pill đáp án trống trong lúc nghỉ, và bỏ ký tự "--" thừa dưới vòng avatar khi không có đồng hồ.

Một lỗi thật được phát hiện nhờ quá trình chụp ảnh: vòng lặp bot 400ms xóa mất lịch trả lời của bot mỗi khi quét lại — đã sửa trong `server.js` (chỉ dọn lịch khi đổi câu hỏi) và QA chạy lại PASS sau khi sửa.

## 5. Chưa kiểm chứng

- **Nghiệm thu trên live TikTok thật** (sự kiện thật từ feed, độ trễ thật, avatar TikTok thật) — chờ buổi live đầu của anh Quang.
- Âm thanh MC nghe thực tế trên loa/OBS (máy ảo không có card tiếng để nghe thử) — clip sinh từ cùng engine/giọng đã duyệt cho video ReviewHub.
