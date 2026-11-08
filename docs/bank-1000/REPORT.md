# Mở rộng ngân hàng câu hỏi — Ai Là Triệu Phú Live: 135 → 1.000 câu

Ngày: 08/11/2026 · Khu vực staging: `bank-expansion/` (chưa gộp vào `app/`, chưa sinh audio, chưa commit git — chờ bước gộp riêng).

## Kết quả tổng

- **Câu mới: 865** trong [bank-additions.json](bank-additions.json) (chỉ chứa câu mới).
- **Tổng sau gộp với bank cũ: đúng 1.000 câu.**
- Phân bổ: cấp 1–10 mỗi cấp 67 câu (9 cũ + 58 mới); cấp 11–15 mỗi cấp 66 câu (9 cũ + 57 mới).
- **Pool câu loại (qualifier): 38 câu** (14 cũ + 24 mới: cấp 3 +8, cấp 4 +6, cấp 5 +5, cấp 6 +5).
- ID câu mới nối tiếp sau bank cũ: `q<cấp>-010` … tối đa `q<cấp>-067`; các câu bù ở vòng rà soát mang số tiếp sau nữa (tới `q4-080`, `q7-080`, `q13-073`…).

## Số câu theo cấp (mới → tổng)

| Cấp | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mới | 58 | 58 | 58 | 58 | 58 | 58 | 58 | 58 | 58 | 58 | 57 | 57 | 57 | 57 | 57 |
| Tổng | 67 | 67 | 67 | 67 | 67 | 67 | 67 | 67 | 67 | 67 | 66 | 66 | 66 | 66 | 66 |

## Phân bố đáp án đúng

- Phần mới (865 câu): **A=216 (25,0%) · B=221 (25,5%) · C=217 (25,1%) · D=211 (24,4%)** — đều trong dải 22–28%.
- Toàn bộ 1.000 câu: A=252 · B=257 · C=251 · D=240.

## Phân bố chuyên mục (865 câu mới)

Khoa học 126 · Địa lý 119 · Lịch sử 110 · Văn học 77 · Thiên nhiên 69 · Toán học 67 · Văn hóa 55 · Đời sống 44 · Nghệ thuật 37 · Âm nhạc 32 · Công nghệ 31 · Thế giới 30 · Thể thao 29 · Ẩm thực 20 · Điện ảnh 19.
(Lưu ý thẩm mỹ: bank cũ có vài câu dùng nhãn gộp "Văn hóa – Nghệ thuật", phần mới dùng nhãn tách theo danh mục chuẩn của game — không ảnh hưởng validator.)

## Kiểm định (nguyên văn)

`node bank-expansion/validate-additions.js`:
```
  Cấp  1: +58 mới → tổng 67
  Cấp  2: +58 mới → tổng 67
  Cấp  3: +58 mới → tổng 67
  Cấp  4: +58 mới → tổng 67
  Cấp  5: +58 mới → tổng 67
  Cấp  6: +58 mới → tổng 67
  Cấp  7: +58 mới → tổng 67
  Cấp  8: +58 mới → tổng 67
  Cấp  9: +58 mới → tổng 67
  Cấp 10: +58 mới → tổng 67
  Cấp 11: +57 mới → tổng 66
  Cấp 12: +57 mới → tổng 66
  Cấp 13: +57 mới → tổng 66
  Cấp 14: +57 mới → tổng 66
  Cấp 15: +57 mới → tổng 66
  TỔNG MỚI: 865 · TỔNG GỘP VỚI BANK CŨ: 1000
  Qualifier: +24 mới (theo cấp: {"3":8,"4":6,"5":5,"6":5}) · pool tổng: 38
  Phân bố đáp án đúng (phần mới): A=216 (25.0%) B=221 (25.5%) C=217 (25.1%) D=211 (24.4%)
  Nghi trùng gần (Jaccard ≥0.72): 67
ADDITIONS PASS
```
67 cặp "nghi trùng gần" còn lại đều đã soi bằng mắt: là các **mẫu câu giống nhau nhưng khác sự kiện** (họ câu thủ đô các nước khác nhau; ký hiệu hóa học các nguyên tố khác nhau; lớn nhất/nhỏ nhất đảo ngược; √81 khác √144; ngũ giác khác lục giác; Duy Tân khác Đông Du; electron khác proton; hồ Ladoga khác hồ Victoria…) — không phải trùng sự kiện.

Chạy thêm validator gốc của game trên file 1.000 câu đã gộp (`app/test/validate-bank.js`):
```
  TỔNG: 1000 câu · câu loại (qualifier): 38
  Phân bố đáp án đúng: A=252 B=257 C=251 D=240
BANK PASS
```

## Quá trình khử trùng (quan trọng)

Các worker chỉ tự khử trùng trong batch của mình + với bank cũ, nên vòng gộp phát hiện **50 câu trùng sự kiện liên batch** — toàn là fact "kinh điển" bị nhiều worker cùng nghĩ tới (thủ đô Pháp/Đức/Nhật/Thái Lan, công thức nước, quốc hoa sen, Hành tinh Đỏ, Cách mạng Tháng Tám 1945, Cách mạng Tháng Mười 1917 ×3, kênh Suez, Giza, Sahara, Truyện Kiều thể thơ, Đồi gió hú, Thần khúc/Dante, ký hiệu Na hỏi xuôi–ngược ×3, ký hiệu Au xuôi–ngược, đơn vị Culông, Ý hình chiếc ủng, Hiệp định Giơnevơ 1954, nước đóng băng 0°C, √144…).
Xử lý: giữ bản ở **cấp thấp nhất** (fact dễ thuộc về cấp thấp), loại bản ở cấp cao hơn, và **soạn bù đúng 50 câu fact mới** (file `topups.json` trước khi gộp) — trong lúc soạn bù lại tiếp tục phát hiện và thay thêm 7 câu bù trùng với cụm cấp 1–3/10–12 (bún bò Huế, Trường Sa, Những người khốn khổ, kim loại dẫn điện, đờn ca tài tử, Bà Bovary, Jane Eyre, Sao Kim tự quay, Thế chiến I 1914). 5 cờ qualifier bị mất do loại trùng (cấp 4: 2, cấp 5: 2, cấp 6: 1) đã được gắn lại vào câu bù dễ ở đúng cấp đó, giữ nguyên phân bổ qualifier 8/6/5/5.

## 4 câu cụm 13–15 bị worker tự gắn cờ "kém chắc chắn" — đã soi lại, GIỮ cả 4

- `q15-021` La Paz: câu chữ đã ghi rõ "nơi đặt trụ sở chính phủ… thủ đô hành chính cao nhất" và để Sucre (thủ đô hiến định) làm đáp án nhiễu — cách hỏi đúng bản chất, giữ.
- `q15-047` Hiến pháp Hoa Kỳ: đã có cụm "thường được coi là" để né tranh luận học thuật (hiến chương San Marino 1600), đáp án theo thông lệ trắc nghiệm quốc tế, giữ.
- `q14-016` Hải âu lang thang sải cánh lớn nhất: đáp án chuẩn mực phổ biến, giữ.
- `q15-049` Sông Tagus dài nhất bán đảo Iberia (~1.007 km > Ebro ~930 km): số liệu ổn định, giữ.

## Chủ đề cố tình tránh (và lý do)

- Chính trị gia/người đương chức, kỷ lục thể thao và bảng xếp hạng thay đổi theo mùa, "lớn nhất/hiện nay" về công ty/sản phẩm (dễ mục nát).
- Sự kiện gây tranh cãi thật sự: nguồn gốc phở (Nam Định/Hà Nội), số dây đàn tranh theo từng bản đàn, nguồn gốc tango (Argentina/Uruguay), quốc gia nhiều đảo nhất (Canada/Thụy Điển tranh nhau cách đếm), phát minh bóng đèn/điện thoại dạng "ai là người đầu tiên tuyệt đối" (chỉ giữ bản Edison đã có sẵn trong bank cũ).
- Đơn vị hành chính sau sáp nhập 2025: chỉ dùng tỉnh/thành giữ nguyên tên hoặc cách hỏi không phụ thuộc ranh giới mới (Cà Mau cực Nam, Khánh Hòa quản lý Trường Sa — khớp cách hỏi đã có trong bank cũ).
- Công thức hóa học viết dạng H₂O/CO₂ (ký tự Unicode) giữ theo đúng phong cách bank cũ.

## Đánh giá chất lượng — nói thẳng

- Cấp 1–6: chất lượng đều tay, fact phổ thông chắc chắn.
- Cấp 7–10: tốt; vài câu tính toán đã kiểm tra lại hai lần ở phía worker.
- Cấp 11–15 là nơi khó giữ chất lượng nhất khi viết số lượng lớn: nguồn fact chuyên sâu nhưng vẫn "có thể kiểm chứng" bị cạn nhanh hơn — cụm này đã phải tránh nhiều chủ đề tranh cãi và có 4 câu phải soi lại (ở trên). Trước khi dùng phát sóng lâu dài, nên có một lượt biên tập người thật đọc lướt ngẫu nhiên ~10% số câu cấp 11–15 để bắt lỗi diễn đạt (bản thân các đáp án đã được rà theo tiêu chí "chỉ dùng fact chắc chắn").
- Toàn bộ 865 câu đều qua kiểm tra máy (schema/trùng/chữ đáp án) + rà soát trùng sự kiện bằng mắt ở vòng gộp; không có kiểm chứng nguồn ngoài (web) cho từng câu — độ tin cậy dựa trên tiêu chí chọn fact phổ thông/bền vững nêu trên.

## File trong thư mục này

- `bank-additions.json` — 865 câu mới (file bàn giao chính).
- `batch-L1-3.json`, `batch-L4-6.json`, `batch-L7-9.json`, `batch-L10-12.json`, `batch-L13-15.json` — các batch gốc của 5 worker (trước khử trùng liên batch).
- `topups.json` — 50 câu bù của vòng rà soát.
- `validate-additions.js` — script kiểm định phần bổ sung (chạy lại: `node bank-expansion/validate-additions.js`).
- `kept-after-drops.json`, `corpus-list.txt` — sản phẩm trung gian của vòng rà soát (tham khảo).
