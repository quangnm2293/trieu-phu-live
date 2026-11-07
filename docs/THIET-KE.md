# AI LÀ TRIỆU PHÚ LIVE — Bản thiết kế v1

> **Trạng thái: ĐÃ DUYỆT 07/11 — đang dựng** (anh Quang duyệt 07/11/2026)

Áp dụng quy trình studio Claude-Code-Game-Studios (mức rút gọn như Star Hunter / Đế Chế Mini / Đua Thú Live): bản thiết kế này duyệt xong mới dựng game → QA tự động → nghiệm thu trên live thật.
Ảnh định hướng phong cách: `design/media-generation-trieu-phu-live-concept-0-355eac7f-0941-42ec-96fc-48f6b0e81735.webp` (sân khấu xanh dương–tím phát sáng, ghế nóng ở giữa, thang điểm vàng 15 bậc bên phải, 4 đáp án viên thuốc A B C D — xem mục 2; lưu ý: số trên thang trong ảnh là chữ trang trí do AI vẽ, thang thật lấy theo mục 4.1).

## 1. Một câu mô tả
Game đố vui kiểu "Ai là triệu phú" chạy trên phiên live TikTok: **toàn bộ khán giả trả lời bằng comment**; mỗi vòng mở đầu bằng một câu hỏi loại để chọn người **nhanh + đúng nhất** ngồi vào **ghế nóng** leo thang 15 câu, còn khán giả vẫn chơi cùng từng câu — sau mỗi câu, sân khấu công bố **ai đúng và nhanh nhất** kèm thời gian trả lời.

**Nguyên tắc vàng (ghi rõ lên sân khấu + README):**
- Thang "tiền" trong game là **ĐIỂM trong game** (viết "150.000.000 điểm"), **không phải tiền thật, không quy đổi, không trao thưởng bằng tiền/quà**.
- Quà TikTok của khán giả **không bao giờ** mua được đáp án, không cộng vào điểm thi đấu, không đổi thành giải thưởng cho người chơi (chi tiết mục 7).

## 2. Sân khấu & khung hình
- Trang sân khấu web 1080×1920 (dọc 9:16), chạy làm nguồn trình duyệt trong LIVE Studio/OBS như Nuôi Rồng / Đua Thú Live; chế độ `?obs=1` ẩn mọi chi tiết quản trị.
- Mọi chữ/bảng quan trọng nằm trong vùng an toàn **y 276–1420** (tránh UI TikTok che) — chuẩn FRAME V2.
- Phong cách nhận diện "triệu phú": nền **xanh dương đậm → tím** phát sáng hướng tâm (radial glow), vòng tròn sân khấu phát sáng ở trung tâm, **thang điểm vàng 15 bậc** chạy dọc bên phải (mốc câu 5 và câu 10 có vạch riêng), câu hỏi trong panel tối viền sáng, 4 đáp án dạng **viên thuốc (pill)** có ký hiệu thoi ◆ A B C D.
- Bố cục trong vùng an toàn (tọa độ tham chiếu, tinh chỉnh khi dựng):
  - y ~290–430: vòng avatar **người ghế nóng** ở giữa (avatar TikTok thật, vòng đếm giờ ôm quanh avatar), tên + mức điểm hiện tại dưới avatar; khi chưa có ghế nóng: logo chương trình + dòng "SẮP MỞ CÂU HỎI LOẠI".
  - y ~440–1180 bên phải (x ~830–1040): **thang điểm 15 bậc**, bậc đang leo sáng vàng, đã qua tô mờ + tích xanh, mốc 5/10 có ngôi sao ★.
  - y ~700–900 bên trái–giữa (x ~30–800): panel câu hỏi (số câu + nội dung, chữ lớn).
  - y ~920–1240: 4 đáp án pill xếp 2×2 (A B trên, C D dưới); trạng thái màu: thường = xanh đậm, **đã chốt = cam**, **đúng = xanh lá nhấp nháy**, **sai = đỏ**.
  - y ~1260–1420: dải thông tin đổi theo pha — thanh Nhiệt huyết (like) + số người đã trả lời + dòng hướng dẫn comment ("Comment A / B / C / D để trả lời!").
- Các màn phủ (overlay) dùng chung vùng an toàn: bảng TOP 5 đúng–nhanh nhất, thanh % hỏi khán giả, bục tổng kết giữa các lượt ghế nóng.

## 3. Vòng loại — chọn người ngồi ghế nóng

### 3.1. Hai phương án đã cân nhắc
| Phương án | Cách comment | Ưu | Nhược |
|---|---|---|---|
| **A. Trắc nghiệm 4 đáp án (CHỐT — chính)** | Comment `A`/`B`/`C`/`D` | Gõ 1 ký tự → nhanh, ít sai chính tả; máy chủ chấm tức thì; khán giả học 1 kiểu trả lời dùng cho cả game | Ít "đặc sản" hơn kiểu sắp xếp |
| B. Sắp xếp 4 ý theo thứ tự (kiểu gốc TV) | Comment dãy như `BADC` | Đúng chất câu hỏi loại bản gốc | Gõ 4 ký tự chậm + dễ sai thứ tự khi hồi hộp; sai 1 vị trí = sai hết, khó giải thích trên live; chấm chậm hơn |

**Chốt: dùng phương án A làm chính.** Phương án B giữ làm *biến thể đặc biệt* (cờ tùy chỉnh `QUALIFIER_MODE=order`, bật cho các buổi sự kiện nếu muốn) — luật chấm B: phải đúng toàn bộ dãy, vẫn xếp hạng theo thời gian máy chủ nhận.

### 3.2. Luật vòng loại (phương án A)
1. Sân khấu hiện câu hỏi loại (lấy từ ngân hàng, độ khó tương đương câu 3–6 — đủ nhanh nhưng không quá dễ), mở cổng trả lời **15 giây** (tùy chỉnh `QUALIFIER_TIME_MS`).
2. Mọi khán giả comment đáp án; **mỗi người chỉ tính đáp án hợp lệ đầu tiên** (luật khóa đáp án, mục 10).
3. Hết giờ hoặc đã có ít nhất 1 đáp án đúng sau tối thiểu 5 giây đầu → chốt: **người đúng có thời gian trả lời nhỏ nhất** (tính từ lúc câu hỏi mở cổng đến lúc máy chủ nhận comment) thắng ghế nóng.
4. Công bố: avatar người thắng phóng to vào vòng ghế nóng + bảng **TOP 5 đúng–nhanh nhất** của câu loại (tên, avatar, thời gian dạng `2,31s`) — những người đúng còn lại vẫn được cộng điểm khán giả (mục 6).
5. **Không ai đúng trong 15s** → bỏ câu, rút câu loại khác, chạy lại (tối đa 3 câu liên tiếp; sau 3 câu vẫn trống ghế thì nghỉ giải lao 20s rồi tiếp tục — tránh vòng lặp vô hạn khi phòng vắng).
6. **Chống độc chiếm ghế:** người vừa giữ ghế nóng ở lượt ngay trước **không được thắng câu loại kế tiếp** (vé của họ vẫn tính điểm khán giả nhưng bỏ qua khi chọn ghế) — tùy chỉnh `HOTSEAT_COOLDOWN_RUNS=1`. Người đang giữ ghế cũng không tham gia câu loại.
7. Hòa thời gian: xếp hạng theo **thứ tự máy chủ nhận sự kiện** (đồng hồ máy chủ, độ phân giải mili-giây) — gần như không thể trùng tuyệt đối; nếu trùng mili-giây, sự kiện đến trước trong hàng đợi thắng. Đây là luật công bằng duy nhất khả thi trên live (độ trễ mạng từng người khác nhau — ghi rõ mục 12).

## 4. Ghế nóng — thang 15 câu

### 4.1. Thang điểm (điểm trong game)
| Câu | Điểm | | Câu | Điểm | | Câu | Điểm |
|---|---|---|---|---|---|---|---|
| 1 | 200.000 | | 6 | 3.000.000 | | 11 | 30.000.000 |
| 2 | 400.000 | | 7 | 6.000.000 | | 12 | 40.000.000 |
| 3 | 600.000 | | 8 | 10.000.000 | | 13 | 60.000.000 |
| 4 | 1.000.000 | | 9 | 14.000.000 | | 14 | 85.000.000 |
| 5 | **2.000.000 ★ mốc** | | 10 | **22.000.000 ★ mốc** | | 15 | **150.000.000 👑** |

### 4.2. Luật chơi
- Người ghế nóng leo từ câu 1; mỗi câu **30 giây** suy nghĩ (tùy chỉnh `QUESTION_TIME_MS`), đồng hồ chạy trên máy chủ.
- Trả lời bằng comment `A`/`B`/`C`/`D` — **đáp án hợp lệ đầu tiên của người ghế nóng là đáp án chốt** (đổi ý không tính — đúng chất bản gốc, và ghi rõ luật trên sân khấu lúc bắt đầu lượt).
- Comment `DỪNG` (hoặc `DUNG`) bất cứ lúc nào trước khi chốt đáp án → dừng cuộc chơi, **giữ nguyên mức điểm của câu trước** (dừng khi đang ở câu n, nhận điểm của câu n−1; dừng ở câu 1 = 0 điểm).
- **Đúng** → lên câu tiếp, điểm hiện tại = mức của câu vừa qua. **Sai hoặc hết giờ** → rơi về **mốc gần nhất đã qua** (qua câu 5 giữ 2.000.000; qua câu 10 giữ 22.000.000; chưa qua mốc nào = 0) và kết thúc lượt.
- Đúng câu 15 → **quán quân 150.000.000 điểm**: pháo giấy + bảng vinh danh buổi live + kết thúc lượt.
- Trong lúc chờ người ghế nóng trả lời, **khán giả chơi cùng** theo mục 6 — hai đường chấm hoàn toàn tách biệt: đáp án khán giả **không bao giờ** thay đổi/ghi đè đáp án của người ghế nóng.
- Nếu người ghế nóng **rời phòng live / không tương tác 2 câu liên tiếp** (hết giờ 2 lần) → lượt kết thúc như trả lời sai (host không cần thao tác).
- Mốc an toàn được nhắc bằng hiệu ứng khi qua câu 5 và câu 10 ("ĐÃ CHẠM MỐC 2.000.000 ★").

## 5. Quyền trợ giúp (mỗi quyền 1 lần / lượt ghế nóng)

Người ghế nóng kích hoạt bằng **comment từ khóa** — máy chủ chỉ nhận từ khóa từ đúng tài khoản đang giữ ghế, trong lúc câu hỏi đang mở và chưa chốt đáp án. Từ khóa chuẩn hóa không dấu/không phân biệt hoa thường:

| Quyền | Từ khóa comment (chấp nhận các biến thể) | Hiệu ứng |
|---|---|---|
| **50:50** | `50` (hoặc `5050`, `50:50`) | Máy chủ xóa 2 đáp án sai (2 ô pill tối đi + gạch chéo); đồng hồ tiếp tục chạy |
| **Hỏi ý kiến khán giả** | `KHÁN GIẢ` (hoặc `KHAN GIA`, `HỎI KHÁN GIẢ`, `KG`) | Đóng băng đồng hồ câu hỏi; mở **phiếu bầu 10 giây** cho toàn phòng comment A/B/C/D; hiện 4 thanh % trực tiếp; hết giờ hiện kết quả cuối, đồng hồ câu hỏi chạy tiếp với thời gian còn lại. Lượt bầu này khán giả vẫn được điểm như 1 câu chơi cùng (mục 6) |
| **Đổi câu hỏi** | `ĐỔI` (hoặc `DOI`, `ĐỔI CÂU`, `DOI CAU`) | Bỏ câu hiện tại (đánh dấu đã dùng), rút câu khác **cùng cấp độ**; đồng hồ reset 30s; đáp án khán giả đã gửi cho câu cũ bị hủy (không tính điểm) để công bằng |

- Sân khấu hiện 3 biểu tượng trợ giúp cạnh avatar ghế nóng; dùng rồi thì xám đi + dấu X.
- Từ khóa của người **không** giữ ghế bị bỏ qua (không báo lỗi ồn ào) — tránh khán giả phá game; riêng `50` dạng số không xung đột vì đáp án chỉ là chữ A–D.
- Sau khi dùng trợ giúp, người ghế nóng vẫn phải tự chốt đáp án bằng comment A–D như thường.


## 6. Khán giả chơi cùng — đúng & nhanh nhất (phần khán giả mê nhất)

Mỗi câu hỏi (câu loại + mọi câu ghế nóng, kể cả lượt "Hỏi ý kiến khán giả") đều là một câu chơi cho **toàn phòng**:

1. Khán giả comment `A`/`B`/`C`/`D` trong lúc câu hỏi mở; **đáp án hợp lệ đầu tiên của mỗi người bị khóa** (comment sau không sửa được — tránh sửa theo đám đông).
2. Khi đáp án được công bố, sân khấu chạy chuỗi hiệu ứng:
   - Đáp án đúng **xanh lá nhấp nháy**, đáp án người ghế nóng chọn sai (nếu sai) đỏ.
   - Bảng **"ĐÚNG & NHANH NHẤT" — TOP 5**: avatar + tên + thời gian trả lời (dạng `1,87s`, tính từ lúc mở câu đến lúc máy chủ nhận comment đúng đầu tiên của người đó).
   - Dòng thống kê: **tỉ lệ đúng** (số người đúng / tổng số người đã trả lời, dạng %) + tổng số người tham gia câu đó.
3. **Điểm khán giả** (cộng dồn cả buổi live):
   - Trả lời **đúng: +100 điểm**.
   - **Thưởng tốc độ** cho TOP 5 nhanh nhất: **+50 / +40 / +30 / +20 / +10**.
   - Sai hoặc không trả lời: 0 điểm (không trừ điểm — giữ không khí vui vẻ).
   - Người ghế nóng **không** nhận điểm khán giả cho câu của chính mình (đang leo thang điểm riêng).
4. **Bảng vàng khán giả** (TOP 10 buổi live: tên, avatar, tổng điểm, số câu đúng): hiện ở màn nghỉ giữa các lượt ghế nóng + cuộn chạy cuối buổi. Điểm khán giả **reset khi bắt đầu buổi live mới**; lưu file theo ngày (`data/scores-YYYY-MM-DD.json` như các game trước) để host xem lại sau buổi.
5. Công bằng tốc độ: thứ hạng tính theo **thời gian máy chủ nhận comment** (mục 12 ghi rõ giới hạn độ trễ mạng).

## 7. Like / Follow / Share / Quà — có vai trò, nhưng không phá công bằng

| Hành động | Tác dụng (CHỐT) | Vì sao công bằng |
|---|---|---|
| **Like** | Đổ vào thanh **Nhiệt huyết**: đầy thanh (mặc định 1.000 like, tùy chỉnh) **trong lúc một câu hỏi đang mở** → người ghế nóng được **+10 giây** cho câu đó (tối đa 1 lần/câu; thanh đầy lúc nghỉ thì giữ sang câu kế tiếp). Like là hành động cả phòng cùng góp nên thưởng cho cả phòng xem | Chỉ thêm **thời gian**, không chạm vào đáp án |
| **Follow** | Người follow mới được **+200 điểm khán giả** (1 lần/buổi, khi sự kiện follow tới) + hiện tên chào mừng | Đã cân nhắc phương án "follow = điểm ×2 cho câu đó" và **loại bỏ**: follow chỉ bấm được 1 lần nên người cũ thiệt, máy chủ cũng không kiểm chứng được ai đã follow từ trước |
| **Share** | **+50 điểm khán giả** cho người share, tối đa 1 lần/10 phút/người | Sự kiện share qua connector thưa và không ổn định — điểm thưởng nhỏ, mang tính khuyến khích là chính |
| **Quà TikTok** | Cộng vào **bảng "Top ủng hộ hôm nay"** riêng (1 coin = 1 điểm ủng hộ, lưu theo ngày) + hiệu ứng ăn mừng theo cỡ quà (≥199 coin: pháo hoa vàng toàn màn + hiện tên người tặng). Bảng ủng hộ hiện cùng màn nghỉ với Bảng vàng khán giả | **Quà KHÔNG cộng điểm khán giả thi đấu, KHÔNG thêm giờ, KHÔNG gợi ý đáp án, KHÔNG đổi thành thưởng cho người ghế nóng.** Ai giỏi thì đứng Bảng vàng bằng kiến thức; ai ủng hộ kênh thì đứng bảng ủng hộ — hai bảng tách bạch, tiền không mua được hạng thi đấu |

## 8. Ngân hàng câu hỏi

### 8.1. Định dạng JSON
```json
{
  "id": "dc-0001",
  "level": 1,
  "category": "Địa lý",
  "question": "Thủ đô của Việt Nam là thành phố nào?",
  "options": { "A": "Hà Nội", "B": "Huế", "C": "Đà Nẵng", "D": "Hải Phòng" },
  "correct": "A"
}
```
- `level` 1–15 khớp thang điểm; `correct` là 1 ký tự A/B/C/D; vị trí đáp án đúng được **trộn đều** khi soạn (không dồn về A).
- Thể loại: Địa lý, Lịch sử, Khoa học, Thể thao, Văn hóa – Nghệ thuật, Ẩm thực, Công nghệ, Đời sống — ưu tiên kiến thức Việt Nam + phổ thông quốc tế.

### 8.2. Độ khó theo tầng
| Tầng câu | Mức | Tiêu chí soạn |
|---|---|---|
| 1–5 | Dễ | Kiến thức phổ thông ai cũng biết, trả lời trong vài giây (vốn từ, địa danh nổi tiếng, phép tính đơn giản) |
| 6–10 | Trung bình | Cần học vấn phổ thông chắc (lớp 9–12), có 1–2 đáp án nhiễu "na ná đúng" |
| 11–15 | Khó | Kiến thức chuyên sâu / ít người biết (số liệu, sự kiện, danh nhân, khoa học nâng cao); vẫn phải kiểm chứng được bằng nguồn đáng tin |

### 8.3. Số lượng & cách xây ngân hàng
- **Tối thiểu để mở live: 8 câu/cấp × 15 cấp = 120 câu** (kèm ~15 câu loại riêng hoặc dùng chung pool cấp 3–6). Khuyến nghị soạn **10 câu/cấp = 150 câu** để có dự phòng đổi câu + tránh lặp trong buổi dài.
- Giai đoạn dựng game sẽ **soạn sẵn ngân hàng khởi điểm** (câu hỏi gốc tiếng Việt, tự viết, kiểm chứng đáp án chéo 2 nguồn với câu khó) — đây là phần tốn công nhất của dự án, tách thành bước riêng có kiểm duyệt trước khi nạp.
- **Chống lặp:** máy chủ ghi `usedIds` trong phiên: câu đã dùng (kể cả bị "Đổi câu hỏi" bỏ qua) không rút lại trong cùng buổi; hết pool của 1 cấp thì mới cho phép quay vòng nhưng tránh lặp trong 20 câu gần nhất.
- **Công cụ quản trị (trang admin):** thêm câu hỏi bằng form (cấp, thể loại, nội dung, 4 đáp án, đáp án đúng) + nhập JSON hàng loạt; kiểm tra tự động: đủ 4 đáp án khác nhau, đúng định dạng, trùng nội dung câu đã có; xem/sửa/xóa + đếm số câu theo từng cấp để biết cấp nào đang thiếu.

## 9. Vòng đời một buổi live (tự lặp, host không phải thao tác)
1. **Mở màn / nghỉ giải lao (20s)**: hiện Bảng vàng khán giả TOP 10 + Top ủng hộ hôm nay + luật chơi tóm tắt ("Comment chữ cái để trả lời — đúng & nhanh nhất lên bảng!").
2. **Câu hỏi loại (15s)** → chọn người ghế nóng (mục 3) → công bố TOP 5 đúng–nhanh nhất của câu loại.
3. **Lượt ghế nóng**: câu 1 → 15 theo mục 4–5; mỗi câu: mở cổng (khán giả chơi cùng) → khóa khi người ghế nóng chốt đáp án hoặc hết giờ → công bố đáp án + TOP 5 khán giả đúng–nhanh nhất + % đúng (~5s) → câu tiếp.
4. **Kết thúc lượt** (sai / dừng / quán quân): bảng tổng kết lượt — người ghế nóng đi được bao xa, điểm giữ được, MVP khán giả của lượt (người nhiều điểm khán giả nhất trong lượt).
5. Quay lại bước 1. Toàn bộ tự động; host chỉ việc live và dẫn chuyện.

**Thông báo lớn (banner + hiệu ứng) cho các khoảnh khắc:** có người ghế nóng mới 👑 qua mốc câu 5 / câu 10 ★ dùng quyền trợ giúp 🎁 phá kỷ lục tốc độ của buổi (thời gian đúng nhanh nhất) 🏆 quán quân 150.000.000 điểm.

## 10. Kỹ thuật (dùng lại stack đã chứng minh ở Nuôi Rồng / Đua Thú Live)
- **Server Node.js, cổng 3021** (feed 3010, Đua Thú 3020 — không đụng nhau). Máy chủ là nơi duy nhất giữ đáp án đúng + bấm giờ: **mốc mở câu, thời gian trả lời, thứ hạng đều tính bằng đồng hồ máy chủ**; client sân khấu chỉ hiển thị.
- **Nguồn sự kiện:** kết nối WebSocket tới **tiktok-live-feed sẵn có** `ws://localhost:3010/events` — nhận sự kiện đã chuẩn hóa: `chat` (chứa đáp án/từ khóa), `like` (đổ thanh Nhiệt huyết), `follow`, `share`, `gift` (bảng ủng hộ). Feed mất kết nối → game tự nối lại, sân khấu hiện trạng thái feed; adapter dự phòng nhận sự kiện dạng relay DOM cũ (POST) như Đua Thú Live nếu cần.
- **Phân tích comment (parser):** chuẩn hóa chữ hoa + bỏ dấu tiếng Việt cho từ khóa; đáp án = comment mà **token đầu tiên là đúng 1 chữ cái A/B/C/D** (chấp nhận dạng `A`, `a`, `A.`, `A)` …); **đáp án hợp lệ đầu tiên của mỗi người trong mỗi câu sẽ khóa** — comment sau bị bỏ qua; chống trùng sự kiện bằng msgId như feed đã làm.
- **Trang sân khấu** (`stage.html`, canvas/DOM 1080×1920, `?obs=1` cho OBS/LIVE Studio) nhận trạng thái qua WebSocket từ server game, nội suy hiển thị cho mượt (đồng hồ đếm ngược vẽ tại client theo mốc máy chủ gửi).
- **Trang admin + giả lập (bắt buộc có, như các game trước):** bot khán giả với số lượng / tỉ lệ trả lời đúng / độ trễ trả lời cấu hình được (bot trả lời với độ trễ ngẫu nhiên 0,5–8s và "trình độ" khác nhau) — đây là công cụ **không thể thiếu** để QA xếp hạng nhanh–chậm và để demo cho anh xem trước khi live thật; admin cũng có nút: mở câu loại, ép kết thúc lượt, nạp lại ngân hàng câu hỏi, reset điểm buổi.
- **Lưu trữ:** JSON theo ngày trong `data/` (điểm khán giả + ủng hộ + câu đã dùng), ghi file chống mất dữ liệu khi server restart giữa buổi.
- **Âm thanh:** nhạc nền căng thẳng + tiếng "khóa đáp án / đúng / sai" phát từ trang sân khấu (file âm thanh tự chế/tự tổng hợp — không dùng nhạc bản quyền của chương trình TV).

## 11. TÙY CHỈNH NHANH (mọi hằng số nằm trong 1 file config khi dựng)
| Hằng số | Mặc định | Ý nghĩa |
|---|---|---|
| `QUESTION_TIME_MS` | 30.000 | Thời gian trả lời 1 câu ghế nóng |
| `QUALIFIER_TIME_MS` | 15.000 | Thời gian câu hỏi loại |
| `QUALIFIER_MODE` | `choice` | `choice` = trắc nghiệm A–D; `order` = sắp xếp `BADC` |
| `POLL_TIME_MS` | 10.000 | Thời gian phiếu "Hỏi ý kiến khán giả" |
| `REVEAL_TIME_MS` | 5.000 | Thời gian hiện đáp án + TOP 5 sau mỗi câu |
| `INTERMISSION_MS` | 20.000 | Nghỉ giữa các lượt ghế nóng |
| `LADDER` | Theo mục 4.1 | Thang điểm 15 câu (điểm trong game) |
| `AUDIENCE_CORRECT_POINTS` | 100 | Điểm khán giả cho 1 câu đúng |
| `AUDIENCE_SPEED_BONUS` | 50/40/30/20/10 | Thưởng TOP 5 nhanh nhất |
| `LIKE_METER_TARGET` | 1.000 like | Đầy thanh Nhiệt huyết → +10s |
| `LIKE_TIME_BONUS_MS` | 10.000 | Thời gian cộng thêm cho ghế nóng |
| `FOLLOW_POINTS` / `SHARE_POINTS` | 200 / 50 | Điểm khán giả cho follow (1 lần/buổi) / share (1 lần/10 phút) |
| `HOTSEAT_COOLDOWN_RUNS` | 1 | Số lượt phải chờ trước khi được ngồi lại ghế nóng |
| `BANK_PATH` | `data/questions.json` | File ngân hàng câu hỏi |
| `PORT` / `FEED_WS` | 3021 / `ws://localhost:3010/events` | Cổng server game / địa chỉ tiktok-live-feed |

## 12. RỦI RO / GIỚI HẠN (nói thẳng)
- **Độ trễ mạng không đều:** xếp hạng "nhanh nhất" tính theo thời điểm **máy chủ nhận được comment** — người mạng nhanh có lợi thế thật, không có cách nào công bằng tuyệt đối trên live; luật này được ghi công khai trên sân khấu ("xếp hạng theo thứ tự hệ thống ghi nhận") để tránh tranh cãi.
- **Lượng comment dồn dập:** phòng đông có thể vài trăm comment/câu — server chỉ lưu đáp án đầu tiên của mỗi người mỗi câu, bỏ qua phần còn lại; việc chấm dùng cấu trúc dữ liệu theo người dùng nên không nghẽn; nếu feed bị TikTok giới hạn tốc độ thì đó là giới hạn của nguồn sự kiện (đã biết từ Đua Thú Live).
- **Khóa đáp án đầu tiên** có thể gây ức chế cho người gõ nhầm — đánh đổi có chủ đích để chống sửa đáp án theo người ghế nóng/đám đông; luật được hiện rõ ngay khi mở câu.
- **Người ghế nóng "bỏ trốn"** (thoát live, treo máy): xử lý bằng luật hết giờ = sai (tối đa mất 30s/câu) — buổi live không bao giờ bị kẹt.
- **Ngân hàng câu hỏi là khâu tốn công nhất:** 120–150 câu gốc + kiểm chứng đáp án; câu sai đáp án trên live sẽ bị khán giả bắt lỗi ngay — bước soạn ngân hàng cần vòng kiểm duyệt riêng, không gộp chung với bước code.
- **Bản quyền format:** game **lấy cảm hứng** từ format đố vui truyền hình — tên gọi, hình ảnh, nhạc, thang điểm trình bày **tự thiết kế**, câu hỏi tự soạn, **không dùng logo/nhạc/hình ảnh của VTV hay bản gốc nước ngoài**. "Ai là triệu phú" là tên chương trình có thật — nếu sau này muốn thương mại hóa nghiêm túc cần rà soát lại tên gọi; với quy mô live giải trí cá nhân, rủi ro được ghi nhận tại đây để anh quyết định.
- **Điểm trong game không có giá trị quy đổi** — ghi rõ trên sân khấu để tránh kỳ vọng giải thưởng và tránh vi phạm chính sách quà tặng của TikTok.
- **Cần host có mặt** dẫn chương trình (đọc câu hỏi, khuấy động) — game tự chạy phần kỹ thuật nhưng không thay người dẫn; buổi live vắng người thì bot chỉ để demo/QA, không tính là buổi chơi thật.
