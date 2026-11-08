'use strict';
/**
 * Sửa các clip đọc câu hỏi bị TTS sinh lỗi (dài bệnh > 28s: giọng bị lặp/chặt đoạn, dài 3–13 lần bình thường).
 * Nguyên nhân đã chẩn đoán (08/11/2026): dịch vụ Meta TTS trả kết quả deterministic theo đúng chuỗi input —
 * chạy lại nguyên văn sẽ nhận lại đúng clip lỗi; phải đổi dạng input bằng cách TÁCH ĐOẠN
 * (câu hỏi riêng, đáp án riêng / AB / CD / từng đáp án) rồi ghép lại bằng ffmpeg (logic: speakQuestionSmart
 * trong gen-audio.js, cũng là logic gen-audio.js tự dùng khi gặp clip dài lúc sinh mới).
 *
 * Chạy: node tools/fix-long-clips.js [id1 id2 ...]  — không tham số = tự quét mọi clip > 28s.
 * In báo cáo trước/sau cho từng clip; clip nào không đạt chuẩn sau mọi chiến lược sẽ được ghi rõ là NGOẠI LỆ.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { speakQuestionSmart, probeDuration, questionText, LONG_CLIP_SEC } = require('./gen-audio.js');

const APP = path.join(__dirname, '..');
const QDIR = path.join(APP, 'audio', 'questions');

async function main() {
  const bank = JSON.parse(fs.readFileSync(path.join(APP, 'questions', 'bank.json'), 'utf8'));
  const byId = new Map(bank.map(q => [q.id, q]));
  let targets = process.argv.slice(2);
  if (!targets.length) {
    targets = bank.map(q => q.id).filter(id => {
      const d = probeDuration(path.join(QDIR, id + '.mp3'));
      return d !== null && d > LONG_CLIP_SEC;
    });
  }
  console.log(`FIX: ${targets.length} clip cần sửa (ngưỡng > ${LONG_CLIP_SEC}s)`);
  const report = [];
  for (const id of targets) {
    const q = byId.get(id);
    if (!q) { console.log(`FIX: bỏ qua ${id} — không có trong bank`); continue; }
    const file = path.join(QDIR, id + '.mp3');
    const before = probeDuration(file);
    const chars = questionText(q).length;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-fix-'));
    let r;
    try { r = await speakQuestionSmart(q, file, tmpDir); }
    finally { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {} }
    const after = probeDuration(file);
    const rate = after ? (after / chars * 100) : null;
    // 3 mức: pass = <=30s và rate <= 1,6x trung vị | flagged = <=30s nhưng rate cao (đoạn ngắn bị đội chi phí tách đoạn) | exception = >30s
    const tier = (after !== null && after <= 30 && rate <= 8.68 * 1.6) ? 'pass' : (after !== null && after <= 30 ? 'flagged' : 'exception');
    report.push({ id, before, after, chars, ratePer100: rate, method: r.method, tier });
    console.log(`FIX: ${id}  ${before ? before.toFixed(1) : '?'}s -> ${after ? after.toFixed(1) : '?'}s  (method=${r.method}, rate=${rate ? rate.toFixed(1) : '?'}/100c)${tier === 'exception' ? '  <-- NGOẠI LỆ' : tier === 'flagged' ? '  <-- đạt <=30s, rate còn cao' : ''}`);
  }
  const okCount = report.filter(r => r.tier === 'pass').length;
  const flagCount = report.filter(r => r.tier === 'flagged').length;
  console.log(`FIX: xong ${okCount}/${report.length} clip đạt chuẩn đầy đủ, ${flagCount} clip đạt <=30s nhưng rate cao, ${report.length - okCount - flagCount} ngoại lệ`);
  const exceptions = report.filter(r => r.tier === 'exception');
  if (exceptions.length) console.log('FIX: NGOẠI LỆ: ' + exceptions.map(r => `${r.id} (${r.after ? r.after.toFixed(1) : '?'}s, method=${r.method})`).join('; '));
  fs.writeFileSync(path.join(__dirname, 'fix-long-clips-report.json'), JSON.stringify({ at: new Date().toISOString(), report }, null, 1));
}

if (require.main === module) main().catch(e => { console.error('FIX FAIL:', e); process.exit(1); });
