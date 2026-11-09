# BÁO CÁO — Gán lại độ khó ngân hàng (Hướng A) + nghỉ 7s + joke mở rộng
Ngày: 2026-11-09 · Repo: trieu-phu-live · Đi kèm: `relevel-map.json` (id → {oldLevel, newLevel, medianDifficulty})

## 1. Phương pháp gán lại cấp
- Chấm mù toàn bộ 2.400 câu bậc thang bằng **3 vòng chấm độc lập** (7.200 verdict): mỗi verdict gồm độ khó 1–15, chất lượng đáp án nhiễu (lo/ok/sat) và cờ câu hỏng (broken). Độ khó của câu = **trung vị 3 verdict**; broken = bị ≥1 verdict gắn cờ; nhiễu lấy theo đa số.
- Sắp xếp 2.400 câu theo độ khó trung vị tăng dần rồi **cắt đúng hạn ngạch từng cấp**: cấp 1–5 = 214 câu, cấp 6–10 = 134, cấp 11–15 = 132 (tổng số câu và số câu/cấp GIỮ NGUYÊN, không thêm/bớt câu nào; 38 câu vòng loại gốc dual-role giữ nguyên cờ qualifier và được gán lại cấp như mọi câu).
- Cân bằng đáp án đúng A/B/C/D trong từng cấp về **±10% quanh 25%** chỉ bằng hoán đổi các câu CÙNG độ khó trung vị ở lân cận ranh giới cấp — tuyệt đối không sửa vị trí/nội dung đáp án trong câu. Kết quả: cả 15 cấp đều đạt ngưỡng (kiểm chứng tự động trong `validate-bank.js`).
- **1.982/2.400 câu đổi cấp** (82,6%); 418 câu giữ nguyên cấp.

## 2. Độ khó trung vị theo cấp — trước / sau
| Cấp | Trước (trung vị / TB) | Sau (trung vị / TB) |
|---|---|---|
| 1 | 1,0 / 1,50 | 1,0 / 1,00 |
| 2 | 2,0 / 2,38 | 2,0 / 1,86 |
| 3 | 3,0 / 3,17 | 2,0 / 2,26 |
| 4 | 3,0 / 3,56 | 3,0 / 3,00 |
| 5 | 4,0 / 4,11 | 3,0 / 3,34 |
| 6 | 4,0 / 4,56 | 4,0 / 4,00 |
| 7 | 4,0 / 4,11 | 4,0 / 4,00 |
| 8 | 4,0 / 4,65 | 5,0 / 4,83 |
| 9 | 5,0 / 5,43 | 5,0 / 5,00 |
| 10 | 6,0 / 5,84 | 6,0 / 5,66 |
| 11 | 6,0 / 6,27 | 6,0 / 6,00 |
| 12 | 7,0 / 6,55 | 7,0 / 6,90 |
| 13 | 6,0 / 6,11 | 8,0 / 7,52 |
| 14 | 6,0 / 6,58 | 9,0 / 8,58 |
| 15 | 8,0 / 7,95 | 11,0 / 10,88 |

Trước đây thang dồn cục (cấp 6–10 gần như cùng một độ khó, cấp 15 chỉ ~8); sau gán lại, độ khó tăng đều theo cấp và hai đầu thang tách hẳn nhau.

## 3. Ma trận chuyển cấp (hàng = cấp cũ, cột = cấp mới 1→15)
```
cũ\1   2   3   4   5   6   7   8   9  10  11  12  13  14  15
 1: 131  53  23   1   5   0   0   0   0   1   0   0   0   0   0
 2:  59  67  31  24  19   0   1   8   0   3   0   2   0   0   0
 3:  16  63   5  50  38   1   2  21   1  14   0   3   0   0   0
 4:   7  20  39  49   9  33   1  23   1  18   0  12   2   0   0
 5:   1   8  28  48   5  44   1  30   1  24   3  14   6   1   0
 6:   0   0  19  22   1  26   0  24   4  15   0  15   6   2   0
 7:   0   1  22  16  18  25   5   2  14  15   0   9   7   0   0
 8:   0   1  11   4  26   4  22   5  20   3  18   8   8   3   1
 9:   0   1   7   0  17   1  21   0  26   1  18  18  13   9   2
10:   0   0   7   0  15   0  18   0  20   1  20  22  14   9   8
11:   0   0   6   0  12   0  17   0  18   0  18  16  18  13  14
12:   0   0   4   0  12   0  15   0  17   0  16   3  24  22  19
13:   0   0   6   0  14   0  23   0   9  11  17   0  10  25  17
14:   0   0   5   0  11   0   8  12   3  17  19   2   9  21  25
15:   0   0   1   0  12   0   0   9   0  11   3   8  15  27  46
```

## 4. Năm ví dụ lạc cấp nặng nhất (cả 5 đều từ cấp 14–15 rơi xuống cấp 3, độ khó trung vị = 2)
1. **q15-067** (15 → 3): "Hằng số toán học nào, xấp xỉ 1,618, được gọi là 'tỉ lệ vàng'…" — kiến thức phổ thông.
2. **q14-008** (14 → 3): "Định lý Pythagoras liên quan đến loại tam giác nào?" (tam giác vuông).
3. **q14-009** (14 → 3): "Trong y học, chụp X-quang sử dụng loại tia nào?" (tia Röntgen/tia X).
4. **q14-023** (14 → 3): "Cặp nhiễm sắc thể giới tính điển hình của nam giới ở người là cặp nào?" (XY).
5. **q14-049** (14 → 3): "Sông nào là sông dài nhất châu Phi?" (sông Nile).

## 5. Sửa đáp án nhiễu (chỉ cấp 1–5 sau gán lại)
- Số câu bị đa số verdict chấm nhiễu "lo" và rơi vào cấp 1–5 sau gán lại: **263 câu** (vượt con số dự kiến ~150 vì thực tế có tới 263 câu đạt tiêu chí — đã sửa toàn bộ thay vì cắt bớt).
- Tổng **637 vị trí đáp án sai** được viết lại cho sát hơn (cùng lĩnh vực, độ dài cảm giác tương đương, vẫn sai rõ khi biết đáp án đúng). Một phần đáp án sai vốn đã đủ sát được giữ nguyên (ví dụ: ký hiệu nguyên tố H/N/C cho ôxy, các giá trị gần đúng 500/2000 kg cho 1 tấn, hành tinh/quốc gia lân cận).
- Đáp án đúng (vị trí + nội dung), đề bài, id, cấp, cờ qualifier: **giữ nguyên 100%** — đã kiểm chứng chéo tự động từng câu trước khi hợp nhất.

## 6. Câu bị gắn cờ hỏng (6 câu) — kiểm chứng và xử lý từng câu
1. **q5-007 — HỎNG THẬT, ĐÃ SỬA.** "Tỉnh nào có diện tích lớn nhất Việt Nam?" Đáp án cũ "Nghệ An" đã lỗi thời sau sáp nhập tỉnh 2025 (Nghị quyết 202/2025/QH15, hiệu lực 01/07/2025): tỉnh lớn nhất nay là **Lâm Đồng (24.233,1 km²)**. Đã sửa nội dung đáp án đúng C: "Nghệ An" → "Lâm Đồng" (giữ nguyên chữ đáp án C; Sơn La/Đắk Lắk/Gia Lai giữ làm nhiễu). Nay ở cấp 6.
2. **q5-064 — HỎNG THẬT, ĐÃ SỬA.** Đề cũ hỏi "loại nhạc cụ" nhưng đáp án đúng là "Dàn nhạc ngũ âm" (một dàn nhạc, không phải một nhạc cụ). Đã sửa đề thành: "Dàn nhạc nào là dàn nhạc truyền thống của người Khmer Nam Bộ, dùng trong các lễ hội lớn ở chùa?" — options và đáp án A giữ nguyên. Nay ở cấp 3.
3. **q2-034 — KHÔNG HỎNG, giữ nguyên.** "Loài thú nào có túi trước bụng để mang con?" (đúng: chuột túi/kangaroo). Gõ kiến "koala cũng có túi" chỉ là nhiễu gây nhiễu đọc — định nghĩa trong đề trỏ đúng kangaroo.
4. **q4-041 — KHÔNG HỎNG, giữ nguyên.** "Con người hít vào khí ôxy và thở ra chủ yếu khí nào?" (đúng: khí cacbonic) — đúng khung sách giáo khoa phổ thông.
5. **q11-024 — KHÔNG HỎNG, giữ nguyên.** "Thiếu nữ bên hoa huệ" (1943) của Tô Ngọc Vân — chính xác.
6. **q3-181 — KHÔNG HỎNG, giữ nguyên.** Mì Quảng ăn kèm bánh tráng nướng — đúng truyền thống, bảo vệ được.

## 7. Âm thanh
- **Thu lại 283 clip**: 265 clip câu hỏi (263 câu sửa nhiễu + q5-007 + q5-064) + 18 clip MC joke mới (xem mục 8). Mọi clip đều qua pipeline `tools/gen-audio.js` (giọng MAI_03), durations.json + manifest cập nhật đồng bộ.
- Tổng cuối: **2.588 clip** (2.524 câu hỏi + **64 MC cố định**), durations.json đủ 2.588 mục.
- Còn 9 clip câu hỏi dài >30s từ ngân hàng cũ (q11-076 = 46,4s; q8-081 = 39,5s; q14-112 = 40,0s; q15-077 = 38,7s; q14-082 = 37,9s; q14-135 = 37,1s; q13-020 = 36,1s; q6-088 = 35,0s; q14-068 = 31,8s): gen-audio đã thử thu lại bằng chiến lược tách đoạn nhưng TTS vẫn đọc dài; file trên đĩa đầy đủ, nghe được trọn vẹn — cửa sổ đọc của server dùng đúng thời lượng thật + tín hiệu audio-done nên không ảnh hưởng ván chơi. Manifest ghi các clip này ở danh sách "missing" theo tiêu chí độ dài của pipeline (không phải mất file).

## 8. Joke mở rộng (theo bổ sung "joke thêm nhiều vào đi")
- Mật độ: joke-correct xác suất **0,7** (CFG `JOKE_CORRECT_CHANCE`); joke-wrong khi sai ở cấp 1–6 xác suất **0,9** (CFG mới `JOKE_WRONG_CHANCE`); joke-welcome **luôn phát** khi có ghế nóng mới; joke-break xác suất **0,6** mỗi lần vào nghỉ (CFG mới `JOKE_BREAK_CHANCE`). Mỗi nhóm joke có bộ nhớ chống lặp riêng.
- Joke-break phát sau cue chuyển pha trong pha nghỉ, **không kéo dài pha nghỉ** (vẫn đúng 7s); thoại ≤ ~5,7s nên vừa trong 7s.
- Tổng số clip joke trong game: **32** = 6 joke-wrong (cũ) + 26 mới (12 correct + 8 welcome + 6 break). MC cố định: 38 → **64**.

### Nguyên văn 26 câu joke mới
**Joke-correct (sau đáp án đúng, cấp 1–5):**
1. Đúng rồi! Bạn này học bài kỹ ghê, chắc hồi đi học toàn ngồi bàn đầu!
2. Chính xác! Não bộ chạy nhanh thế này chắc lắp chip đời mới rồi!
3. Hay quá! Trả lời nhẹ như không, khán giả bắt đầu thấy lo cho MC rồi đấy!
4. Đúng phóc! Kiến thức cỡ này chắc ở nhà bị gọi là bách khoa toàn thư!
5. Xuất sắc! Bạn trả lời mà MC chưa kịp chớp mắt luôn. Ghê thật!
6. Chuẩn không cần chỉnh! Chắc tối qua nằm mơ thấy trước đáp án hả bạn?
7. Trúng phóc! Bạn này mà đi thi là giám thị phải kiểm tra tai nghe đấy!
8. Đúng nữa rồi! Kiến thức đầy bụng thế này, ăn cơm chắc cũng phải nghĩ!
9. Hay chưa! Đáp án vừa ra là bạn bắt gọn, như mèo vồ chuột vậy!
10. Chuẩn luôn! Bộ nhớ này mà là điện thoại chắc phải một terabyte!
11. Đúng rồi đó! Bạn trả lời nhanh vậy, MC đọc đáp án còn không kịp!
12. Xuất thần! Câu này nhiều người vấp lắm, bạn qua nhẹ như đi dạo!

**Joke-welcome (ghế nóng mới):**
1. Ghế nóng vừa có chủ mới! Nhìn mặt sáng sủa thế này chắc không vấp câu một đâu!
2. Xin chào người chơi mới! Ghế này hơi nóng, ngồi cẩn thận kẻo phỏng kiến thức!
3. Người chơi mới lên sóng! Tim đập thình thịch mà mặt vẫn tỉnh bơ, hay lắm!
4. Chào mừng bạn đến với ghế nóng! Cứ bình tĩnh, sai thì khán giả cười thôi, không sao!
5. Một gương mặt mới toanh! Khán giả vỗ tay đi, biết đâu đây là nhà vô địch tối nay!
6. Ghế nóng đổi chủ! Bạn ngồi xuống là nhiệt độ phòng tăng hẳn hai độ!
7. Chào bạn mới! Cứ coi ghế nóng như ghế đá công viên, khác cái là có tiền điểm thôi!
8. Người chơi mới xuất hiện! Nhìn ánh mắt này là biết ở nhà cày sách dữ lắm!

**Joke-break (lúc nghỉ giải lao):**
1. Nghỉ giải lao chút nhé cả nhà! Ai chưa uống nước thì uống, ai chưa thả tim thì thả nào!
2. Phút thư giãn! Khán giả comment điểm danh cái nào, xem còn ai chưa chạy mất dép!
3. Giải lao ngắn thôi! Ai đang lurk thì lộ diện đi, MC thấy hết đấy nhé!
4. Nghỉ một nhịp! Tay ai mỏi vì comment nhanh quá thì xoa bóp đi, sắp vào vòng mới!
5. Giờ giải lao! Ai đoán được người thắng vòng sau, comment tên mình cho MC ghi sổ!
6. Thư giãn nào cả nhà! Hít sâu một cái, vòng loại tới là phải nhanh tay hơn nữa đấy!

## 9. Nghỉ 7 giây
`INTERMISSION_MS` 10.000 → **7.000** (lịch sử: 20s → 10s → 7s). `RUN_END_MS` giữ 6.000 (clip mc/run-end dài 5,16s). Smoke boot không env đè: server boot thẳng vào pha nghỉ với đúng mặc định 7.000ms trong config.

## 10. Kiểm thử (toàn bộ PASS)
- BANK (`validate-bank.js`): 2.400 bậc thang (214/134/132 theo nhóm cấp) + 162 vòng loại = 2.524 mục; phân bố đáp án từng cấp trong ±10% quanh 25% — PASS.
- QA, TIMER, AUDIO-TEST (clip đọc dừng sau 131ms khi chuyển pha), NAME-JOKE, POLL-STALE (rò 0/25 mẫu), REVEAL-AUDIO (giữ 7.260ms), REVEAL-FASTEST (giữ ~6.652ms), LIFELINE-REMIND — PASS.
- JOKES-EXTENDED (test mở rộng): đúng cấp 3 có joke-correct; đúng cấp 7 không; sai cấp 6 có joke-wrong; sai cấp 7 không; ghế nóng mới có joke-welcome; vào nghỉ với JOKE_BREAK_CHANCE=1 có joke-break, =0 thì không — PASS (lần chạy đầu rớt 1 mục do mẫu thăm dò cue của chính test lúc chạy song song cả suite; chạy riêng PASS toàn bộ — đã đối chiếu log từng mục).
