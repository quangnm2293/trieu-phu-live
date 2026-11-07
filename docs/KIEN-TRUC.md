# AI LÀ TRIỆU PHÚ LIVE — Kiến trúc kỹ thuật

## Tổng quan

```
TikTok LIVE ─→ tiktok-live-feed (ws://localhost:3010/events) ─┐
Admin giả lập ─→ POST /api/sim ───────────────────────────────┤
Relay DOM cũ ─→ POST /api/relay/* ────────────────────────────┴─→ Engine (game.js) ─→ WS broadcast 10Hz ─→ Stage (DOM/CSS)
                                                                        │
                                                          data/scores-<ngày>.json · questions/bank.json · audio/*.mp3
```

- `server.js` — HTTP (stage/admin/audio tĩnh/API) + WS cho stage + client nối feed (tự reconnect 3s) + bot khán giả + vòng tick 100ms gọi `engine.tick()` rồi broadcast state.
- `game.js` — engine thuần logic: máy trạng thái pha, chấm điểm, trợ giúp, bền dữ liệu. Không phụ thuộc HTTP/WS nên QA được bằng cách lái qua API.
- `config.js` — mọi hằng số cân bằng (mục 11 bản thiết kế), ghi đè bằng env.
- Chỉ 1 phụ thuộc: `ws`.

## Máy trạng thái (phase)

```
intermission ──(hết giờ)──► qualifier ──(có đúng & ≥ QUALIFIER_MIN_MS | hết giờ)──► qualifier_reveal
      ▲                                                                              │
      │                                          (có người thắng)                    │ (không ai đúng, <3 lần liên tiếp)
      │                                                                              ▼                    │
      │                                                                           startRun ──► question ◄─┘ (câu loại mới)
      │                                                                              │
      │        question ──(ghế nóng chốt)──► locked ──(LOCKED_MS)──► reveal ──(đúng, chưa tới 15)──► question (câu+1)
      │                                                                              │
      │        question ──(hết giờ)──► reveal                                        │ (sai/hết giờ/DỪNG/quán quân)
      │                                                                              ▼
      └────────────────────────────  run_end  ◄──────────────────────────────────────┘
```

**Luật vòng lặp (yêu cầu nhấn mạnh):** MỌI cách kết thúc lượt ghế nóng — trả lời sai, hết giờ, `DỪNG`, hay thắng 150.000.000 — đều đi qua `run_end` (tổng kết ngắn) → `intermission` → `qualifier` với câu loại mới. Không có đường nào kẹt ở ghế nóng.

Pha phụ trong `question`: `poll` (phiếu khán giả) không phải phase riêng mà là trạng thái con của ctx — đồng hồ câu hỏi được "đóng băng" bằng cách lưu `frozenRemaining` và đặt lại deadline khi phiếu đóng.

## Mô hình thời gian

- Mọi mốc (mở câu, deadline, hết pha) là timestamp theo **đồng hồ máy chủ**; engine chuyển pha trong `tick(now)`.
- Thời gian trả lời của mỗi người = `now - ctx.openedAt` tại thời điểm máy chủ xử lý sự kiện chat → thứ hạng nhanh/chậm tuyệt đối theo thứ tự ghi nhận (mục 12 bản thiết kế).
- Stage nhận `serverNow` kèm mỗi state, tự tính offset để vẽ vòng đếm ngược bằng rAF cho mượt; state broadcast 10Hz là đủ vì hiển thị đồng hồ chạy ở client.
- Cộng giờ Nhiệt huyết sửa trực tiếp `ctx.deadline` (+10s, cờ `bonusUsed` chặn lần 2 trong cùng câu; thanh đầy ngoài giờ câu hỏi thì áp dụng ngay khi mở câu kế tiếp).

## Chấm điểm

- Mỗi ctx giữ `answers: Map<uid, {letter, elapsedMs}>` — đáp án hợp lệ đầu tiên của mỗi người bị khóa (parser: token đầu tiên là 1 chữ cái A–D; từ khóa trợ giúp chuẩn hóa bỏ dấu).
- `scoreCtx()` chạy đúng 1 lần/câu (cờ `scored`): sắp xếp người đúng theo elapsedMs → TOP 5 + thưởng tốc độ; +100/người đúng; ghế nóng bị loại khỏi bảng khán giả ở câu của chính mình (tham số `excludeUid`), nhưng câu loại thì mọi người đều được tính.
- 50:50: `ctx.removed` chứa 2 đáp án sai — đáp án/phiếu chọn ô đã loại bị từ chối *kể từ lúc loại*; đáp án đã khóa trước đó giữ nguyên.
- Đổi câu: ctx bị thay mới hoàn toàn (đáp án khán giả hủy), câu cũ vẫn nằm trong `usedIds`.
- Quà: cộng dồn theo streak (`repeatEnd=false` chỉ gom, `repeatEnd=true` mới cộng tổng vào bảng ủng hộ) — tránh tính trùng quà gửi liên tục.

## Âm thanh

- Engine không phát tiếng; nó phát **audio cue** trong state: `audioCue = {seq, keys[]}` (vd `["mc/level-7", "q/q7-003"]`). Stage theo dõi `seq`, phát các file mp3 theo thứ tự, tự bỏ qua file lỗi/thiếu, tôn trọng `?mute=1` và nút tắt tiếng.
- Clip sinh sẵn bằng Meta TTS (`tools/gen-audio.js`, giọng MAI_03) — sinh lúc build, không gọi TTS lúc chạy (độ trễ bằng 0, không phụ thuộc mạng khi live).
- Hiệu ứng ngắn (đúng/sai/tick) tổng hợp WebAudio tại stage — không cần file, không bản quyền.

## Độ bền dữ liệu

- `data/scores-YYYY-MM-DD.json`: điểm khán giả, bảng ủng hộ, `usedIds`. Ghi qua file tạm + rename (chống hỏng khi mất điện), ghi lười (dirty flag, tối đa 10s/lần + ghi ngay khi kết thúc lượt). Restart giữa buổi khôi phục được bảng điểm trong ngày; "Reset điểm buổi" ở admin để mở buổi mới.
- Thêm câu hỏi qua admin ghi thẳng vào `questions/bank.json` (có kiểm tra trùng/thiếu/sai định dạng trước khi ghi).

## Bot khán giả

`server.js` theo dõi state: mỗi khi có câu hỏi mới (khóa theo phase+qid+level), hẹn giờ cho từng bot trả lời với độ trễ ngẫu nhiên trong khoảng cấu hình và tỉ lệ đúng theo "skill". Bot giữ ghế có thể tự dùng 50:50 ở câu khó. Lưu ý kỹ thuật: lịch trả lời chỉ được dọn khi *đổi câu hỏi* — dọn mỗi vòng poll 400ms sẽ hủy mất các timer đang chờ (lỗi đã gặp và đã sửa khi chụp ảnh demo).
