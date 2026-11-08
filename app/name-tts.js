'use strict';
/**
 * ĐỌC TÊN NGƯỜI CHƠI BẰNG GIỌNG TỔNG HỢP ĐỘNG (mục A/B).
 *
 * Nickname TikTok là dữ liệu ĐỘNG nên không sinh sẵn được như clip MC cố định.
 * Trên máy chủ (Mac của chủ phòng) dùng lệnh `say` của macOS (ưu tiên giọng
 * tiếng Việt 'Linh' nếu máy có) → afconvert → MP3 lưu vào app/audio/dynamic/,
 * phát qua cue key 'dyn/<tên-file>'. File được CACHE theo (mẫu câu + tên đã
 * làm sạch): cùng một người lên ghế lần nữa thì dùng lại file cũ, kể cả sau
 * khi server khởi động lại (quét lại thư mục lúc cần).
 *
 * Sinh file BẤT ĐỒNG BỘ — không bao giờ chặn vòng game:
 *   request(kind, nickname) → khơi việc sinh, trả cacheKey (null nếu tên sạch
 *                             xong rỗng / tính năng đang tắt).
 *   readyKey(kind, nickname) → 'dyn/<file>' nếu file ĐÃ sẵn sàng, null nếu chưa
 *                             (người gọi tự bỏ qua clip tên lần đó).
 *
 * Máy không có `say` (vd Linux): tính năng tự tắt êm (log đúng 1 lần).
 * env NAME_TTS_CMD (qua config): lệnh thay thế dạng mẫu với 2 placeholder
 * {text} và {out} — phục vụ QA trên Linux (trỏ vào stub tạo MP3 giả) hoặc
 * trỏ vào engine TTS khác trên máy chủ.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile, exec } = require('child_process');

const TEMPLATES = {
  hotseat: name => `Ghế nóng thuộc về ${name}!`,
  fastest: name => `Nhanh nhất câu này là ${name}!`,
};
const EXTS = ['.mp3', '.m4a', '.aiff', '.wav'];

/**
 * Làm sạch nickname trước khi đọc: bỏ emoji/ký tự điều khiển/ký hiệu, giữ chữ
 * (kể cả dấu tiếng Việt) + số + khoảng trắng, gộp khoảng trắng, cắt 30 ký tự.
 */
function sanitizeName(raw) {
  let s = String(raw || '');
  s = s.replace(/[^\p{L}\p{N} ]/gu, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > 30) s = s.slice(0, 30).trim();
  return s;
}

function shellQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

function createNameTts(opts) {
  const dir = opts.dir;
  const cmdTemplate = opts.cmdTemplate || '';
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}

  const ready = new Map();   // cacheKey -> tên file (đã sinh xong / tìm thấy trên đĩa)
  const pending = new Map(); // cacheKey -> Promise
  const failed = new Set();  // cacheKey đã sinh hỏng trong phiên này — không thử lại liên tục
  const durations = new Map(); // cacheKey -> thời lượng clip (giây) đã đo được
  const measuring = new Set(); // cacheKey đang đo thời lượng (tránh đo lặp)

  // Đo thời lượng file tiếng (bất đồng bộ, không chặn game): macOS có sẵn
  // afinfo; máy khác thử ffprobe. Game dùng số này để giữ pha đủ lâu cho clip
  // tên phát trọn — đo không được thì game tự ước lượng.
  function measureDuration(cacheKey, fileName) {
    if (durations.has(cacheKey) || measuring.has(cacheKey)) return;
    measuring.add(cacheKey);
    const filePath = path.join(dir, fileName);
    const done = sec => { if (Number.isFinite(sec) && sec > 0) durations.set(cacheKey, sec); measuring.delete(cacheKey); };
    try {
      execFile('afinfo', [filePath], { timeout: 5000 }, (e1, out1) => {
        const m = !e1 && String(out1 || '').match(/estimated duration:\s*([\d.]+)\s*sec/);
        if (m) return done(parseFloat(m[1]));
        execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath], { timeout: 5000 }, (e2, out2) => {
          done(e2 ? null : parseFloat(String(out2 || '').trim()));
        });
      });
    } catch (_) { measuring.delete(cacheKey); }
  }
  let mode = null;           // 'cmd' | 'say' | 'off' — chốt ở lần request đầu tiên
  let sayVoiceArgs = [];     // ['-v','Linh'] nếu máy có giọng Việt
  let loggedOff = false;

  function cacheKeyFor(kind, cleanName) {
    const h = crypto.createHash('sha1').update(kind + '|' + TEMPLATES[kind](cleanName)).digest('hex').slice(0, 12);
    return `${kind}-${h}`;
  }

  function findOnDisk(cacheKey) {
    if (ready.has(cacheKey)) return ready.get(cacheKey);
    for (const ext of EXTS) {
      const f = cacheKey + ext;
      try { if (fs.statSync(path.join(dir, f)).size > 0) { ready.set(cacheKey, f); return f; } } catch (_) {}
    }
    return null;
  }

  function detectMode() {
    if (mode) return mode;
    if (cmdTemplate) { mode = 'cmd'; return mode; }
    if (process.platform === 'darwin' && fs.existsSync('/usr/bin/say')) { mode = 'say'; return mode; }
    mode = 'off';
    if (!loggedOff) {
      loggedOff = true;
      log('[name-tts] máy này không có lệnh `say` của macOS — TẮT tính năng đọc tên (đặt env NAME_TTS_CMD để dùng engine TTS khác).');
    }
    return mode;
  }

  // Chạy 1 lệnh con có timeout; resolve(true/false), không bao giờ throw.
  function runFile(file, args, timeoutMs = 20000) {
    return new Promise(resolve => {
      execFile(file, args, { timeout: timeoutMs }, err => resolve(!err));
    });
  }
  function runShell(cmd, timeoutMs = 20000) {
    return new Promise(resolve => {
      exec(cmd, { timeout: timeoutMs }, err => resolve(!err));
    });
  }

  let voiceProbed = false;
  async function probeVoice() {
    if (voiceProbed) return;
    voiceProbed = true;
    // `say -v '?'` liệt kê giọng; có giọng Việt 'Linh' thì ưu tiên dùng.
    const out = await new Promise(resolve => {
      execFile('say', ['-v', '?'], { timeout: 8000 }, (err, stdout) => resolve(err ? '' : String(stdout || '')));
    });
    if (/^Linh\s/m.test(out)) sayVoiceArgs = ['-v', 'Linh'];
  }

  async function generate(cacheKey, text) {
    const m = detectMode();
    if (m === 'off') return null;
    if (m === 'cmd') {
      const out = path.join(dir, cacheKey + '.mp3');
      const cmd = cmdTemplate.replace('{text}', shellQuote(text)).replace('{out}', shellQuote(out));
      const ok = await runShell(cmd);
      try {
        if (ok && fs.statSync(out).size > 0) { ready.set(cacheKey, cacheKey + '.mp3'); return cacheKey + '.mp3'; }
      } catch (_) {}
      return null;
    }
    // m === 'say' (macOS): say → AIFF tạm → afconvert MP3 (dự phòng M4A/AIFF)
    await probeVoice();
    const tmpAiff = path.join(dir, `.tmp-${cacheKey}-${process.pid}.aiff`);
    const okSay = await runFile('say', [...sayVoiceArgs, '-o', tmpAiff, text]);
    if (!okSay) { try { fs.unlinkSync(tmpAiff); } catch (_) {} return null; }
    const tries = [
      { ext: '.mp3', args: ['-f', 'MPG3', '-d', '.mp3', tmpAiff] },
      { ext: '.m4a', args: ['-f', 'm4af', '-d', 'aac', tmpAiff] },
    ];
    for (const t of tries) {
      const tmpOut = path.join(dir, `.tmp-${cacheKey}-${process.pid}${t.ext}`);
      const ok = await runFile('afconvert', [...t.args, tmpOut]);
      try {
        if (ok && fs.statSync(tmpOut).size > 0) {
          const finalName = cacheKey + t.ext;
          fs.renameSync(tmpOut, path.join(dir, finalName));
          ready.set(cacheKey, finalName);
          try { fs.unlinkSync(tmpAiff); } catch (_) {}
          return finalName;
        }
      } catch (_) {}
      try { fs.unlinkSync(tmpOut); } catch (_) {}
    }
    // Phương án cuối: giữ nguyên AIFF (trình duyệt vẫn phát được)
    try {
      const finalName = cacheKey + '.aiff';
      fs.renameSync(tmpAiff, path.join(dir, finalName));
      ready.set(cacheKey, finalName);
      return finalName;
    } catch (_) { return null; }
  }

  /** Khơi việc sinh clip tên (bất đồng bộ). Trả cacheKey hoặc null. */
  function request(kind, nickname) {
    if (!TEMPLATES[kind]) return null;
    const clean = sanitizeName(nickname);
    if (!clean) return null;
    if (detectMode() === 'off') return null;
    const key = cacheKeyFor(kind, clean);
    if (findOnDisk(key) || pending.has(key) || failed.has(key)) return key;
    const p = generate(key, TEMPLATES[kind](clean))
      .then(f => { if (!f) failed.add(key); else measureDuration(key, f); })
      .catch(() => failed.add(key))
      .finally(() => pending.delete(key));
    pending.set(key, p);
    return key;
  }

  /** 'dyn/<file>' nếu clip tên đã sẵn sàng, ngược lại null. */
  function readyKey(kind, nickname) {
    if (!TEMPLATES[kind]) return null;
    const clean = sanitizeName(nickname);
    if (!clean) return null;
    const key = cacheKeyFor(kind, clean);
    const f = findOnDisk(key);
    if (f) measureDuration(key, f); // file có sẵn từ phiên trước → đo bổ sung để game giữ pha đủ lâu
    return f ? 'dyn/' + f : null;
  }

  /** Thời lượng (giây) của clip tên nếu đã đo được, ngược lại null. */
  function durationSec(kind, nickname) {
    if (!TEMPLATES[kind]) return null;
    const clean = sanitizeName(nickname);
    if (!clean) return null;
    const d = durations.get(cacheKeyFor(kind, clean));
    return Number.isFinite(d) && d > 0 ? d : null;
  }

  return { request, readyKey, durationSec };
}

module.exports = { createNameTts, sanitizeName, TEMPLATES };
