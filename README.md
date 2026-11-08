# Ai Là Triệu Phú Live

Game đố vui tương tác cho **TikTok LIVE** theo format "Ai là triệu phú":
khán giả comment đáp án để tranh ghế nóng, người đúng & nhanh nhất lên ghế,
leo thang 15 câu (đỉnh 150.000.000 **điểm trong game** — không quy đổi tiền
thật), khán giả chơi cùng mọi câu với bảng TOP 5 đúng–nhanh nhất, có giọng
MC đọc câu hỏi (TTS Meta, giọng MAI_03, sinh sẵn 1.037 clip cho 1.000 câu hỏi).
**Luật giờ:** MC đọc xong câu hỏi mới bắt đầu tính giờ trả lời — trong lúc đọc,
đáp án gửi vào chưa được tính (xem `app/README.md` mục 2).
MC còn **đọc tên người lên ghế nóng + khán giả đúng–nhanh nhất mỗi câu** bằng
TTS động trên máy chủ (lệnh `say` của macOS, ưu tiên giọng Việt "Linh"), đọc
thêm **câu joke khi ghế nóng sai ở câu 1–4**, và sân khấu tự phát **nhạc nền
lúc nghỉ giải lao** từ thư mục `app/music/` (thả file remix của bạn vào đó).
Chi tiết: `app/README.md` mục 2b/2c.

Sự kiện live (chat/quà/like/follow/share) lấy từ dịch vụ anh em
[tiktok-live-feed](https://github.com/quangnm2293/tiktok-live-feed).

## Chạy nhanh (macOS)

```bash
git clone https://github.com/quangnm2293/trieu-phu-live.git
git clone https://github.com/quangnm2293/tiktok-live-feed.git   # để cạnh nhau, cùng thư mục cha
cd trieu-phu-live
./start-live.sh
```

Script sẽ tự: cài thư viện lần đầu, bật feed (nếu có), bật game ở cổng
3021, mở tunnel Cloudflare và in **link HTTPS của sân khấu**.

### Lần đầu — cấu hình feed (bắt buộc để có sự kiện thật)

```bash
cd ../tiktok-live-feed
npm install
cp .env.example .env
# Mở .env, điền:
#   EULER_API_KEY  — key EulerStream miễn phí (https://www.eulerstream.com)
#   TIKTOK_USERNAME — username phòng live của bạn (không có @)
```

Thiếu bước này game vẫn chạy (chế độ giả lập ở trang admin) nhưng không
nhận được comment/quà thật từ phòng live.

## Link cho TikTok LIVE Studio

LIVE Studio **không nhận link localhost** — phải dùng link tunnel HTTPS
mà `start-live.sh` in ra, dạng:

```
https://<tên-ngẫu-nhiên>.trycloudflare.com/?obs=1
```

- `?obs=1` = chế độ lên sóng (ẩn các chi tiết debug).
- Link tunnel **đổi mới mỗi lần chạy script** — luôn lấy link của lần chạy
  hiện tại dán vào LIVE Studio.
- Trang quản trị (giả lập khán giả, bot test, thêm câu hỏi, trao ghế thủ
  công): `<link-tunnel>/admin` — hoặc local `http://localhost:3021/admin`.

## Cách chơi (tóm tắt)

- **Vòng loại:** ra 1 câu trắc nghiệm, tất cả khán giả comment `A/B/C/D` —
  người **đúng và nhanh nhất** lên ghế nóng.
- **Ghế nóng:** 15 câu, 30 giây/câu; người giữ ghế comment đáp án, hoặc
  dùng trợ giúp: `50` (50:50), `KHÁN GIẢ` (bầu chọn 10 giây), `ĐỔI` (đổi
  câu). Comment `DỪNG` để bảo toàn điểm. Sai/hết giờ → rơi về mốc an toàn
  gần nhất (câu 5 = 2.000.000, câu 10 = 22.000.000) và quay lại vòng loại.
- **Khán giả:** trả lời mọi câu; đúng +100 điểm, TOP 5 nhanh nhất +50→10;
  bảng vàng khán giả hiện giữa các lượt. Like đầy thanh Nhiệt huyết
  (1.000) → ghế nóng +10 giây. Quà chỉ lên bảng ủng hộ — không mua được
  điểm hay đáp án.

## Thêm câu hỏi + sinh giọng MC

1. Vào trang `/admin` → form thêm câu hỏi (có kiểm tra trùng), hoặc sửa
   trực tiếp `app/questions/bank.json` rồi chạy
   `cd app && npm run validate-bank`.
2. Sinh giọng đọc cho câu mới:
   ```bash
   cd app && node tools/gen-audio.js
   ```
   (script chỉ sinh các clip còn thiếu; audio nằm trong `app/audio/`.)

## Cấu trúc

```
app/          server game (server.js, game.js, config.js) + stage + admin
app/questions ngân hàng câu hỏi (bank.json — 135 câu khởi điểm)
app/audio/    166 clip giọng MC sinh sẵn (bắt buộc có để chạy sau clone)
docs/         THIET-KE.md · KIEN-TRUC.md · QA.md
shots/        ảnh sân khấu các trạng thái
start-live.sh script chạy nhanh + tunnel
```

Chạy tay không cần script: bật `tiktok-live-feed` trước, rồi
`cd app && npm install && npm start` → sân khấu `http://localhost:3021/`.
