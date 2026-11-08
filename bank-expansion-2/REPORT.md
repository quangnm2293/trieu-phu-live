# Bank Expansion Round 2 — Báo cáo staging (+1.000 câu bậc thang + 24 câu vòng loại)

Ngày: 2026-11-08. Phạm vi: **CHỈ staging** trong `bank-expansion-2/` — không sửa `app/questions`, `app/audio`, `manifest.json`, `durations.json`; không chạy gen-audio/gen-durations; không commit/push. Bước ghép + thu tiếng làm sau.

## Kết quả tổng

- **bank-additions.json: đúng 1.000 câu bậc thang mới** (định dạng giống hệt ngân hàng hiện tại: id, level, category, question, options A–D, correct).
- **qualifier-additions.json: 24 câu vòng loại mới** (cờ `qualifier: true`, phân bổ L3:+8, L4:+6, L5:+5, L6:+5).
- Sau khi ghép (bước sau): ngân hàng sẽ có **2.000 câu bậc thang + 62 câu vòng loại**.

## Số câu theo level (câu mới)

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mới | 67 | 67 | 67 | 67 | 67 | 67 | 67 | 67 | 67 | 67 | 66 | 66 | 66 | 66 | 66 |

Đúng mục tiêu: L1–10 mỗi level +67, L11–15 mỗi level +66. ID tiếp nối dãy cũ theo level, không trùng ID ngân hàng hiện tại (đã validate máy: schema, ID duy nhất, không đụng ID cũ, không trùng nội dung lựa chọn trong cùng câu — **0 lỗi**).

## Khử trùng 2 lớp — 57 câu bị loại, thay bằng 57 câu bù

5 worker soạn tổng 1.024 câu thô (1.000 bậc thang + 24 vòng loại). Qua khử trùng, **57 câu bậc thang bị loại** (vòng loại: 0 câu trùng), toàn bộ được thay bằng câu bù do điều phối viên soạn và tự kiểm chứng chéo:

- **Lớp (a) — trùng FACT với 1.000 câu hiện có**: bắt được bằng scan độ tương tự + đối chiếu cụm cùng đáp án + grep thực thể. Ví dụ: đơn vị decibel trùng câu cũ q13-066; hàng loạt fact "kinh điển" (thủ đô các nước, đơn vị SI, kỷ lục lớn nhất/đầu tiên) hóa ra ngân hàng cũ đã phủ kín.
- **Lớp (b) — trùng fact lẫn nhau giữa các lô mới** (giữ bản ở level thấp nhất theo quy ước đợt 1): cụm Lisbon ×3, Aconcagua ×3, "Vợ chồng A Phủ" ×3, Irrawaddy ×3, thủ đô Hy Lạp (q3-069 giữ, q10-070 loại), Rubens/Baroque (q8-087 giữ, q13-128 loại), saffron (q7-110 giữ, q14-109 loại), Elbrus/Kavkaz (q7-125 giữ, q13-115 loại), Kawabata (q12-095 giữ, q14-092 loại), Louis XIV (q8-122 giữ, q10-083 loại), ngôn ngữ C/Bell Labs (q6-124 giữ, q7-107 loại), Mekong/Thanh Tạng (q6-071 giữ, q12-069 loại).
- **1 câu HỎNG dữ liệu**: q3-112 — câu hỏi về quốc kỳ Canada nhưng bộ lựa chọn/đáp án lại là "Máy in" (lỗi ghép của worker), loại và thay mới.
- Chi tiết từng câu bị loại + lý do: `drops.json` (57 mục).
- Bài học vòng này: 31/48 câu bù bản nháp đầu tiên của điều phối viên cũng bị loại vì trùng ngân hàng cũ (ngân hàng 1.000 câu đã phủ rất dày các fact kinh điển) — bản bù cuối cùng dùng fact tầng hai và đã qua cùng quy trình kiểm chứng (scan + grep thực thể). Sau merge, scan sâu lại toàn bộ: chỉ còn 7 cặp "cùng đáp án" là fact khác nhau thật (eo Dardanelles ≠ Bosphorus; WHO ≠ WTO; Huckleberry Finn ≠ Tom Sawyer; MS-DOS ≠ Windows; cải lương ≠ đờn ca tài tử; Anna Karenina ≠ Chiến tranh và hòa bình; Verdun ≠ Jutland).

## Phân bố đáp án đúng (1.000 câu mới)

**A: 248 — B: 253 — C: 250 — D: 249** (mục tiêu ~250/chữ, lệch tối đa 3).

## Rà soát chất lượng khi soạn

- Quy ước giữ nguyên từ đợt 1 (báo cáo `docs/bank-1000/REPORT.md`): độ khó tăng theo level; tránh chính trị gia đương nhiệm, kỷ lục thể thao theo mùa, "lớn nhất hiện nay", nguồn gốc gây tranh cãi (phở, tango…), khẳng định "đầu tiên" tuyệt đối, đơn vị hành chính sau sáp nhập 2025.
- 44 câu được worker gắn cờ "không chắc" khi soạn (dùng diễn đạt phòng thủ "thường được coi là"…). Sau khử trùng còn **39 câu gắn cờ của worker** trong bản cuối + **13 câu gắn cờ mới từ vòng giải mù** = **52 câu gắn cờ** (danh sách ở cuối báo cáo). Gắn cờ ≠ sai — đây là các câu fact đúng theo nguồn phổ thông nhưng có sắc thái tranh cãi nhẹ, cần biết khi vận hành live.

## RÀ ĐÁP ÁN (vòng bổ sung theo yêu cầu chủ dự án)

Phương pháp: 5 solver MỚI (không phải người soạn) giải mù toàn bộ 1.024 câu từ file đã lược bỏ đáp án (`blind/`), mỗi solver một dải level; so đáp án solver với đáp án đã gắn; câu lệch → tranh chấp → kiểm chứng web.

- **Đã giải: 1.024/1.024 câu. Tranh chấp (solver chọn khác đáp án gắn): 0.**
- **Số chữ đáp án phải sửa: 0.**
- Solver gắn thêm: 20 câu low-confidence (đều đồng ý đáp án gắn, chỉ thiếu chắc chắn) và 8 câu nghi lỗi diễn đạt/dữ kiện. Điều phối viên xử lý từng câu:
  - **Thay 1 câu**: q6-141 (vòng loại, Festival Huế "2 năm một lần") — kiểm chứng web xác nhận từ 2022 Huế chuyển sang mô hình Festival bốn mùa quanh năm (Dân Trí 02/01/2022), định kỳ cũ không còn là đáp án duy nhất đúng → thay bằng q6-142 (Ý vô địch Euro 2020, đáp án D giữ nguyên vị trí phân bổ).
  - **Sửa diễn đạt đề (fact + đáp án + chữ đúng không đổi) 6 câu**: q2-111 (đề tự tham chiếu ngựa vằn), q2-121 ("diện tích bề mặt" gây hiểu nhầm sang ruột non → hỏi thẳng "cơ quan lớn nhất"), q5-096 (đồng tử/mống mắt → hỏi đích danh lỗ mở giữa mống mắt), q8-131 (đề tự lộ đáp án Alps → bỏ cụm lộ), q11-082 (bỏ "châu Âu" thừa), q14-132 (bỏ chi tiết "vương miện Mặt Trời" dễ nhầm sang thần Ra).
  - **Kiểm tra lại 7 câu đã sửa/thay bằng 1 solver mù mới: 7/7 khớp đáp án dự định**, và solver này bắt thêm 1 lỗi thật: q11-082 sau khi bỏ "châu Âu" thì **Yemen cũng thống nhất năm 1990** — đã sửa lần 2, neo đề vào "Sau khi Bức tường Berlin sụp đổ" (chỉ nước Đức khớp; đáp án B không đổi).
  - **Giữ nguyên sau kiểm chứng web**: q15-095 (Osmi 22,59 > Iridi 22,56 g/cm³ theo số liệu X-ray — RSC/Wikipedia xác nhận Osmi là nguyên tố tự nhiên đặc nhất; vẫn gắn cờ vì cách biệt chỉ 0,1%), q9-102 (Vịnh Bengal lớn nhất theo diện tích — giữ + gắn cờ), q13-117 (Onega là hồ lớn thứ hai châu Âu sau Ladoga — giữ).
- Lưu ý trung thực (giống đợt rà ngân hàng cũ): solver là AI cùng họ mô hình — 0 tranh chấp không đồng nghĩa 0 sai sót tuyệt đối; vòng này chủ yếu bắt lỗi đáp án gắn sai chữ và lỗi diễn đạt, và đã bắt được 1 câu lỗi thời + 7 câu cần sửa đề.

## Danh sách câu gắn cờ trong bản cuối (52 câu)

Worker gắn cờ khi soạn (39): q1-121 (tre thuộc họ Hòa thảo), q2-091 (múa sạp của người Thái), q2-103 (1 dặm ≈ 1,6 km), q3-115 (1 sào Bắc Bộ = 360 m²), q3-126, q3-139 (chim ruồi — chim nhỏ nhất), q3-141 (Bern là thủ đô trên thực tế của Thụy Sĩ), q4-099, q5-088 (Vạn Lý Trường Thành chủ yếu xây thời Minh), q5-093, q5-112, q6-086 (Điện Biên Phủ trên không — 12 ngày đêm), q6-089 (LHQ thành lập 1945), q6-122 (Euro 1960 — Liên Xô), q6-126 (PNG hỗ trợ kênh alpha), q7-137 (koala có vân tay giống người), q8-096 (Lovelace/Babbage), q8-102 (Sri Jayawardenepura Kotte — thủ đô lập pháp Sri Lanka), q8-129 (Vua sư tử phỏng Hamlet), q9-071 (hồ Eyre), q9-081 (anh em Wright), q9-102 (vịnh Bengal — xem mục rà đáp án), q9-107 (bọ gấu nước), q9-117 (pizza Napoli), q9-128 (Mai Trung Thứ), q10-116 (tên gọi Bluetooth), q11-113 (gấu trúc đỏ), q11-130 (Năm Quốc tế Phụ nữ 1975), q12-068 (Astana), q12-106 (tên gọi MySQL), q12-120 (borscht — UNESCO 2022), q13-077 (Kafka), q13-081 (Yellowstone), q13-121 (Louis XIV trị vì 72 năm), q14-094 (Hyperion — cây cao nhất), q14-095 (máy Z3), q14-108 (Kasparov), q15-083 (Rafflesia — giữ nguyên cụm "hoa đơn"), q15-095 (Osmi/Iridi — xem mục rà đáp án).

Vòng giải mù gắn cờ thêm (13): q1-108 (tiết học tính bằng phút), q1-114 (canh chua miền Nam — me), q3-131 (đua thuyền — sông nước miền Tây), q4-092 (nhà Trần 1225), q4-123 (Lý cây bông — Nam Bộ), q6-084 (Bãi Sậy — Nguyễn Thiện Thuật), q6-087 (Đông Kinh Nghĩa Thục 1907), q6-103 (Bức tranh của em gái tôi — Tạ Duy Anh), q6-113 (Bài thánh ca buồn — Nguyễn Vũ), q8-072 (hồ Malawi — Đông nam châu Phi), q9-087 (The Planets — 7 khúc), q12-109 (gấu Bắc Cực — thú ăn thịt trên cạn lớn nhất), q13-117 (Onega — xem mục rà đáp án).

## File trong thư mục staging

- `bank-additions.json` — **1.000 câu bậc thang mới (file merge chính)**.
- `qualifier-additions.json` — **24 câu vòng loại mới (file merge chính)**.
- `batch-L1-3.json`, `batch-L4-6.json`, `batch-L7-9.json`, `batch-L10-12.json`, `batch-L13-15.json` — bản thô của 5 worker (đã áp cùng các sửa đề của vòng rà đáp án).
- `qualifier-batch-L3.json`, `qualifier-batch-L4-6.json` — bản thô vòng loại.
- `batch-*-notes.md` — ghi chú + danh sách gắn cờ gốc của từng worker.
- `topups-final.json` — 57 câu bù của điều phối viên.
- `drops.json` — 57 câu bị loại + lý do từng câu.
- `blind/` — 5 file blind dùng cho vòng giải mù + `blind-recheck.json`.
- `solve-L*.json`, `solve-recheck.json` — kết quả giải mù; `disputes.json` — đối chiếu tranh chấp (0); `solve-fixes.json` — nhật ký sửa đề/thay câu của vòng rà đáp án.
- `corpus-existing.txt`, các script `analyze-*.js`, `finalize-merge.js`, `revise-merge.js`, `apply-fixes.js`, `apply-fix2.js`, `compare-solve.js`, `final-validate.js` — công cụ phân tích/khử trùng/validate của điều phối viên.

Bước tiếp theo (ngoài phạm vi đợt này): merge 2 file chính vào `app/questions/bank.json`, chạy gen-audio + gen-durations cho 1.024 câu mới, commit/push.

---

## GHÉP VÀO GAME + SỬA 7 CÂU LỖI AUDIT + THU TIẾNG — 08/11/2026

**Kết quả ngân hàng sau ghép** (`app/questions/bank.json`):

- Tổng 2.024 mục = **2.000 câu bậc thang + 62 câu vòng loại**
- Bậc thang theo cấp: cấp 1–10 = 134 câu/cấp; cấp 11–15 = 132 câu/cấp
- Vòng loại: 62 câu (38 câu cũ dùng chung hai vai + 24 câu mới đợt này)
- Phân bố đáp án đúng bậc thang (2.000 câu): **A=500 B=510 C=501 D=489** (toàn file: A=506 B=516 C=507 D=495)
- Không trùng id, không trùng nội dung câu hỏi (kiểm tra cứng trong lúc ghép)

*Ghi chú kỹ thuật ghép:* 24 câu vòng loại mới được gắn thêm cờ `qualifierOnly: true` khi ghép. Lý do: số liệu bắt buộc của thiết kế (2.000 bậc thang đúng 134/132 mỗi cấp + 62 vòng loại) chỉ đồng thời đúng khi 24 câu này thuộc vòng loại thuần — `game.js` vốn đã hỗ trợ sẵn: `drawLevel()` loại câu `qualifierOnly`, `drawQualifier()` lấy mọi câu `qualifier: true`. 38 câu vòng loại cũ giữ nguyên hai vai như thiết kế đợt 1.000.

**7 câu lỗi theo audit `docs/bank-1000/AUDIT-2026-11-08.md` mục (b) — đã xử lý (giữ nguyên qid):**

- *Sửa stem:* **q5-003** — "Tiểu thuyết Chí Phèo" → "Truyện ngắn Chí Phèo" (giữ nguyên lựa chọn + đáp án C); **q15-064** — "thuyết tương đối hẹp" → "thuyết tương đối rộng" (giữ nguyên lựa chọn + đáp án A).
- *Thay mới hoàn toàn* (cùng cấp, tự giải mù kiểm chứng 1 lượt, rà trùng fact với toàn ngân hàng; chữ cái đáp án đúng trùng câu gốc nên phân bố không đổi):
  - **q3-039** (cấp 3, Ẩm thực): "Bánh chưng truyền thống của Việt Nam được gói bằng loại lá nào?" — Đáp án: **B. Lá dong**
  - **q4-063** (cấp 4, Địa lý): "Cửa khẩu Hữu Nghị Quan, cửa khẩu đường bộ nổi tiếng trên tuyến biên giới phía Bắc, thuộc tỉnh nào của Việt Nam?" — Đáp án: **B. Lạng Sơn**
  - **q5-032** (cấp 5, Thể thao): "Trong bóng chuyền, vị trí chuyên phòng thủ phía sau, mặc áo khác màu với đồng đội và không được phát bóng, được gọi là gì?" — Đáp án: **A. Libero**
  - **q8-003** (cấp 8, Khoa học): "Năm 1676, nhà khoa học nào là người đầu tiên quan sát được vi khuẩn bằng kính hiển vi tự chế?" — Đáp án: **C. Antonie van Leeuwenhoek**
  - **q11-045** (cấp 11, Lịch sử): "Chiến dịch Điện Biên Phủ năm 1954 diễn ra trong bao nhiêu ngày đêm?" — Đáp án: **B. 56 ngày đêm**

**Thu tiếng MC** (giọng MAI_03, tools/gen-audio.js, tự tách đoạn khi clip >28s):

- Manifest: totalNeeded **2.061** clip = 37 clip MC cố định + 2.024 câu hỏi. Lượt sinh chính đạt chuẩn ngay 2.044 clip; 17 clip bị gắn cờ >30s được xử lý tiếp (xem dưới). Sau cùng **đủ 2.024/2.024 file clip câu hỏi**.
- durations.json: **2.061 mục** (2.024 câu hỏi + 37 MC), không câu nào thiếu duration — server tính cửa sổ "MC đang đọc" theo thời lượng thật của từng clip.
- **Clip >30s còn lại: 8** (dài nhất toàn ngân hàng 38,5s): q11-076 = 38,5s; q13-092 = 38,1s; q15-077 = 35,1s; q14-082 = 34,8s; q13-020 = 34,1s; q8-112 = 32,9s; q14-135 = 32,8s; q14-112 = 32,1s. Trong đó q13-020 là ngoại lệ cũ từ đợt 1.000 (đã cải thiện 36,8 → 34,1s); 7 câu còn lại là câu mới đợt này.
- Đã cứu về ≤30s: 2 ngoại lệ cũ q11-044 (38,8 → 20,1s) và q12-066 (34,2 → 21,3s); gen-audio tự cứu thêm 2 ngoại lệ cũ q11-043 (→ 12,1s) và q13-047 (→ 13,6s); 7 câu mới (q4-097, q6-088, q8-081, q11-128, q12-082, q12-132, q14-119) về 20,1–29,8s.
- Phương pháp sửa nối tiếp: ladder tách đoạn sẵn có của gen-audio → cắt khoảng lặng bệnh lý trong clip (ffmpeg silenceremove) → thu lại tách đoạn mịn (thân câu tách tại dấu phẩy, từng đáp án thu riêng, cắt lặng từng đoạn trước khi ghép) → thu hoạch best-of-N. 8 clip còn lại kháng mọi chiến lược tại thời điểm thu (dịch vụ TTS trả bản đọc kéo dài cho chính các đoạn đó, kể cả khi tách nhỏ); giữ bản ngắn nhất đạt được và ghi ngoại lệ tại đây — vòng lặp game không bị ảnh hưởng vì cửa sổ đọc lấy theo durations.json thật.

**Kiểm thử sau ghép (số thật, chạy trên bản cuối):**

- **BANK: PASS** — 2.000 câu bậc thang (cấp 1–10: 134/cấp; cấp 11–15: 132/cấp), 62 câu vòng loại, tổng 2.024 mục; phân bố đáp án bậc thang A=500 B=510 C=501 D=489. (Checker `app/test/validate-bank.js` đã cập nhật kỳ vọng từ 1.000 lên thiết kế 2.000 + 62.)
- **QA: PASS** (41 mục kiểm tra OK — gồm audio tồn tại cho mọi câu, trợ giúp 50:50 trong pha đọc, cửa sổ dự phòng khi mất tín hiệu stage).
- **TIMER: PASS** — remainingMs giảm khớp thời gian thực; công thức hiển thị giây của stage hợp lệ.
- **AUDIO-TEST: PASS** — Chrome headless thật: hai cue bắn liên tiếp phát đúng thứ tự; clip dừng sau 129ms khi chuyển pha.
- **NAME-JOKE: PASS** (21 mục OK — cửa sổ đọc theo duration + đệm, trần 25s, tắt nhạc bằng cờ).
- **POLL-STALE: PASS** — test hồi quy mới kèm đợt này cho lỗi "tỉ lệ phiếu khán giả câu cũ hiện đè lên câu mới": 0/24 mẫu trong pha đọc rò tỉ lệ cũ; phiếu vẫn hiện đúng ở câu đã bầu. (Kèm trong commit này: sửa `game.js` gắn qid vào kết quả phiếu + `stage.js`/`stage.html`/`stage.css` không render phiếu trong pha đọc, huy hiệu "MC ĐANG ĐỌC" khối vàng lớn và băng lóe "MC ĐỌC XONG" khi cửa sổ mở.)

**Commit:** __COMMIT_LINE__
