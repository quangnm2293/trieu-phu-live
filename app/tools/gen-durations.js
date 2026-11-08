'use strict';
/**
 * Đo thời lượng MỌI clip giọng MC (ffprobe) → app/audio/durations.json.
 *
 * Mục đích: server cần biết clip đọc câu hỏi dài bao nhiêu giây để tính cửa sổ
 * "MC đang đọc" (đọc xong mới bắt đầu tính giờ trả lời) theo tín hiệu dự phòng:
 *   cửa sổ đọc dự phòng = thời lượng clip + READING_BUFFER_MS (config.js).
 * Nếu thiếu file/thiếu mục → server dùng READING_DEFAULT_MS.
 *
 * Định dạng durations.json: { generatedAt, unit: 'seconds', durations: { "<qid>": 12.34, "mc/<key>": 3.21 } }
 * (qid = id câu hỏi, khớp tên file audio/questions/<qid>.mp3; mc/<key> khớp audio/mc/<key>.mp3.)
 *
 * Chạy: node tools/gen-durations.js
 * gen-audio.js tự gọi lại tool này sau mỗi lần sinh giọng — thêm câu hỏi mới thì
 * chỉ cần chạy gen-audio là durations.json được cập nhật theo.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const APP = path.join(__dirname, '..');
const FFPROBE = process.env.FFPROBE_BIN || 'ffprobe';

function probe(file) {
  return new Promise(resolve => {
    const p = spawn(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', c => { out += c; });
    p.on('error', () => resolve(null));
    p.on('close', () => {
      const d = parseFloat(String(out).trim());
      resolve(Number.isFinite(d) ? Math.round(d * 100) / 100 : null);
    });
  });
}

async function generate(audioDir = path.join(APP, 'audio')) {
  const jobs = [];
  for (const [sub, prefix] of [['questions', ''], ['mc', 'mc/']]) {
    const dir = path.join(audioDir, sub);
    let files = [];
    try { files = fs.readdirSync(dir).filter(f => f.endsWith('.mp3')).sort(); } catch (_) {}
    for (const f of files) jobs.push({ key: prefix + f.replace(/\.mp3$/, ''), file: path.join(dir, f) });
  }
  const durations = {};
  let idx = 0;
  async function worker() {
    while (idx < jobs.length) {
      const job = jobs[idx++];
      const d = await probe(job.file);
      if (d !== null) durations[job.key] = d;
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  const data = { generatedAt: new Date().toISOString(), unit: 'seconds', durations };
  fs.writeFileSync(path.join(audioDir, 'durations.json'), JSON.stringify(data, null, 1));
  return durations;
}

if (require.main === module) {
  generate().then(d => {
    const qs = Object.keys(d).filter(k => !k.startsWith('mc/'));
    const mcs = Object.keys(d).filter(k => k.startsWith('mc/'));
    const vals = qs.map(k => d[k]);
    const max = vals.length ? Math.max(...vals) : 0;
    console.log(`DURATIONS: đã đo ${qs.length} clip câu hỏi + ${mcs.length} clip MC → app/audio/durations.json (clip câu hỏi dài nhất ${max}s)`);
  }).catch(e => { console.error('DURATIONS FAIL:', e.message); process.exit(1); });
}

module.exports = { generate, probe };
