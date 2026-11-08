'use strict';
/**
 * AI LÀ TRIỆU PHÚ LIVE — mọi hằng số cân bằng nằm ở đây (mục 11 bản thiết kế).
 * Có thể ghi đè bằng biến môi trường (QA dùng để chạy nhanh).
 */
function envInt(name, def) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) ? v : def;
}
function envBool(name, def) {
  const v = process.env[name];
  if (v === undefined) return def;
  return v !== '0' && v.toLowerCase() !== 'false';
}
function envFloat(name, def) {
  const v = parseFloat(process.env[name]);
  return Number.isFinite(v) ? v : def;
}

module.exports = {
  PORT: envInt('PORT', 3021),
  FEED_URL: process.env.FEED_URL || 'ws://localhost:3010/events',
  TICK_MS: envInt('TICK_MS', 100),

  // --- Thời gian các pha (ms) ---
  QUESTION_TIME_MS: envInt('QUESTION_TIME_MS', 30000), // trả lời 1 câu ghế nóng
  QUALIFIER_TIME_MS: envInt('QUALIFIER_TIME_MS', 15000), // câu hỏi loại
  QUALIFIER_MIN_MS: envInt('QUALIFIER_MIN_MS', 5000), // có đáp án đúng sau mốc này thì chốt sớm
  QUALIFIER_MAX_FAILS: envInt('QUALIFIER_MAX_FAILS', 3), // số câu loại liên tiếp không ai đúng trước khi nghỉ
  POLL_TIME_MS: envInt('POLL_TIME_MS', 10000), // phiếu "Hỏi ý kiến khán giả"

  // --- Pha "MC đang đọc câu hỏi" (đọc xong mới bắt đầu tính giờ trả lời) ---
  // Khi câu hỏi mở: MC đọc clip câu hỏi, đồng hồ CHƯA chạy, đáp án CHƯA được nhận.
  // Cửa sổ trả lời mở theo tín hiệu stage báo đọc xong (POST /api/stage/audio-done)
  // hoặc — dự phòng nếu stage không báo — khi hết thời lượng clip + đệm dưới đây.
  READING_BUFFER_MS: envInt('READING_BUFFER_MS', 1500), // đệm sau thời lượng clip (tín hiệu dự phòng)
  READING_FALLBACK_CAP_MS: envInt('READING_FALLBACK_CAP_MS', envInt('READING_MAX_MS', 25000)), // TRẦN cửa sổ đọc dự phòng: clip dài nhất ~39s mà tín hiệu stage mất hẳn thì game cũng chỉ chờ tối đa 25s rồi tự mở cửa sổ (tránh đứng hình như live 08/11). Tên env cũ READING_MAX_MS vẫn được tôn trọng nếu có.
  READING_DEFAULT_MS: envInt('READING_DEFAULT_MS', 12000), // thời lượng giả định khi durations.json thiếu mục
  READING_SCALE: envFloat('READING_SCALE', 0), // >0: nhân thời lượng clip (hiệu chỉnh thực tế nếu cần)
  READING_TEST_MS: envInt('READING_TEST_MS', 0), // >0: ép cửa sổ đọc = đúng số ms này (QA/test — ghi đè durations)
  REVEAL_TIME_MS: envInt('REVEAL_TIME_MS', 5000), // hiện đáp án + TOP 5
  LOCKED_MS: envInt('LOCKED_MS', 1500), // hiện trạng thái "đã chốt đáp án" trước khi công bố
  INTERMISSION_MS: envInt('INTERMISSION_MS', 10000), // nghỉ giữa các lượt (đại ca yêu cầu rút ngắn tối 08/11 — cũ 20s)
  RUN_END_MS: envInt('RUN_END_MS', 6000), // bảng tổng kết lượt

  // --- Thang điểm (ĐIỂM trong game — không phải tiền thật) ---
  LADDER: [200000, 400000, 600000, 1000000, 2000000, 3000000, 6000000, 10000000,
    14000000, 22000000, 30000000, 40000000, 60000000, 85000000, 150000000],
  MILESTONE_LEVELS: [5, 10], // mốc an toàn ★

  // --- Điểm khán giả ---
  AUDIENCE_CORRECT_POINTS: envInt('AUDIENCE_CORRECT_POINTS', 100),
  AUDIENCE_SPEED_BONUS: [50, 40, 30, 20, 10], // TOP 5 nhanh nhất
  FOLLOW_POINTS: envInt('FOLLOW_POINTS', 200),
  SHARE_POINTS: envInt('SHARE_POINTS', 50),
  SHARE_COOLDOWN_MS: envInt('SHARE_COOLDOWN_MS', 600000),

  // --- Like / Nhiệt huyết ---
  LIKE_METER_TARGET: envInt('LIKE_METER_TARGET', 1000),
  LIKE_TIME_BONUS_MS: envInt('LIKE_TIME_BONUS_MS', 10000),

  // --- Đọc TÊN người chơi bằng TTS động (mục A/B) ---
  // Trên Mac của chủ phòng: dùng lệnh `say` của macOS (ưu tiên giọng Việt 'Linh') → MP3 trong audio/dynamic/.
  // NAME_TTS_CMD: lệnh thay thế dạng mẫu, có 2 placeholder {text} và {out} (vd cho QA trên Linux trỏ vào stub).
  // Để trống = tự phát hiện `say` trên macOS; máy không có (Linux) → tính năng tự tắt êm, game chạy bình thường.
  NAME_TTS_CMD: process.env.NAME_TTS_CMD || '',

  // --- Nhạc nền lúc nghỉ giải lao (mục F) ---
  MUSIC_ENABLED: envBool('MUSIC_ENABLED', true), // phát nhạc thư mục music/ ở pha intermission/run_end; tắt bằng env MUSIC_ENABLED=0

  // --- Khác ---
  HOTSEAT_COOLDOWN_RUNS: envInt('HOTSEAT_COOLDOWN_RUNS', 1),
  BIG_GIFT_COINS: envInt('BIG_GIFT_COINS', 199),
  QUALIFIER_MODE: process.env.QUALIFIER_MODE || 'choice', // biến thể 'order' chưa bật ở v1
  BANK_PATH: process.env.BANK_PATH || 'questions/bank.json',
  RELAY_ENABLED: envBool('RELAY_ENABLED', true),
};
