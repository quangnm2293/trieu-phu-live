'use strict';
/**
 * Sinh giọng MC bằng Meta TTS (giọng avocado_v2:MAI_03 — giọng đã duyệt cho video ReviewHub)
 * qua CLI /opt/hatch/bin/tts — cùng cách gọi như ~/workspace/video-tools/engine.py.
 *
 * Xuất: app/audio/mc/<key>.mp3 (câu MC cố định) + app/audio/questions/<id>.mp3 (từng câu hỏi)
 *       + app/audio/manifest.json (thống kê sinh thành công / còn thiếu).
 * Chạy: node tools/gen-audio.js  — file đã có (>1KB) sẽ được bỏ qua; chạy lại để sinh bổ sung phần thiếu.
 * Thiếu clip nào game vẫn chạy bình thường (stage tự bỏ qua), manifest ghi rõ phần thiếu.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const APP = path.join(__dirname, '..');
const AUDIO_DIR = path.join(APP, 'audio');
const TTS = process.env.TTS_BIN || '/opt/hatch/bin/tts';
const CONCURRENCY = 4;

const ORDINALS = ['một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười',
  'mười một', 'mười hai', 'mười ba', 'mười bốn', 'mười lăm'];
const VALUE_WORDS = ['hai trăm nghìn điểm', 'bốn trăm nghìn điểm', 'sáu trăm nghìn điểm',
  'một triệu điểm', 'hai triệu điểm', 'ba triệu điểm', 'sáu triệu điểm', 'mười triệu điểm',
  'mười bốn triệu điểm', 'hai mươi hai triệu điểm', 'ba mươi triệu điểm', 'bốn mươi triệu điểm',
  'sáu mươi triệu điểm', 'tám mươi lăm triệu điểm', 'một trăm năm mươi triệu điểm'];

function mcClips() {
  const clips = {
    'welcome': 'Xin chào mừng quý vị và các bạn đến với Ai Là Triệu Phú Live! Hãy comment đáp án thật nhanh và chính xác để giành ghế nóng!',
    'qualifier-intro': 'Vòng loại bắt đầu! Tất cả quý vị hãy comment đáp án. Ai trả lời đúng và nhanh nhất sẽ ngồi vào ghế nóng!',
    'qualifier-again': 'Rất tiếc, chưa ai trả lời đúng câu hỏi loại vừa rồi. Chúng ta cùng thử một câu hỏi khác!',
    'next-qualifier': 'Chúng ta cùng đến với câu hỏi vòng loại tiếp theo, để tìm ra người ngồi ghế nóng mới!',
    'hotseat-new': 'Người chơi tiếp theo đã lộ diện! Xin chúc mừng bạn đã xuất sắc giành ghế nóng!',
    'locked': 'Đáp án đã được chốt! Chúng ta cùng hồi hộp chờ xem kết quả.',
    'correct': 'Chính xác! Đó là đáp án đúng!',
    'wrong': 'Rất tiếc! Đó chưa phải là đáp án đúng.',
    'milestone5': 'Chúc mừng! Bạn đã chạm mốc an toàn hai triệu điểm!',
    'milestone10': 'Tuyệt vời! Mốc an toàn hai mươi hai triệu điểm đã thuộc về bạn!',
    'lifeline-5050': 'Quyền trợ giúp năm mươi năm mươi đã được sử dụng! Hai đáp án sai đã bị loại bỏ.',
    'lifeline-poll': 'Người chơi hỏi ý kiến khán giả! Quý vị khán giả hãy comment đáp án để giúp người chơi nào!',
    'lifeline-swap': 'Người chơi quyết định đổi câu hỏi! Một câu hỏi mới cùng cấp độ sẽ được đưa ra.',
    'walkaway': 'Người chơi quyết định dừng cuộc chơi và bảo toàn số điểm hiện có. Xin chúc mừng!',
    'champion': 'Không thể tin được! Chúng ta đã có nhà vô địch một trăm năm mươi triệu điểm! Xin chúc mừng triệu phú của đêm nay!',
    'run-end': 'Lượt chơi đã kết thúc. Cảm ơn người chơi và toàn thể quý vị khán giả đã tham gia!',
  };
  for (let i = 0; i < 15; i++) {
    clips[`level-${i + 1}`] = `Câu hỏi số ${ORDINALS[i]}, trị giá ${VALUE_WORDS[i]}.`;
  }
  return clips;
}

const SUB_DIGITS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
function sanitize(text) {
  let t = String(text || '');
  t = t.replace(/×10²³/g, ' nhân mười mũ hai mươi ba');
  t = t.replace(/×10⁻¹¹/g, ' nhân mười mũ âm mười một');
  t = t.replace(/[₀-₉]/g, ch => SUB_DIGITS[ch] || ch);
  t = t.replace(/×/g, ' nhân ');
  t = t.replace(/π/g, 'pi');
  t = t.replace(/[·–]/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}
function questionText(q) {
  const o = q.options || {};
  return sanitize(`Câu hỏi: ${q.question} A: ${o.A}. B: ${o.B}. C: ${o.C}. D: ${o.D}.`);
}

function speak(text, out) {
  return new Promise(resolve => {
    const p = spawn(TTS, ['speak', '--text', text, '--language', 'vi', '--output', out], { stdio: 'ignore' });
    const to = setTimeout(() => { try { p.kill('SIGKILL'); } catch (_) {} resolve(false); }, 90000);
    p.on('error', () => { clearTimeout(to); resolve(false); });
    p.on('close', code => {
      clearTimeout(to);
      let ok = false;
      try { ok = code === 0 && fs.existsSync(out) && fs.statSync(out).size > 1000; } catch (_) {}
      resolve(ok);
    });
  });
}

async function main() {
  const bank = JSON.parse(fs.readFileSync(path.join(APP, 'questions', 'bank.json'), 'utf8'));
  fs.mkdirSync(path.join(AUDIO_DIR, 'mc'), { recursive: true });
  fs.mkdirSync(path.join(AUDIO_DIR, 'questions'), { recursive: true });
  const jobs = [];
  const mc = mcClips();
  for (const [key, text] of Object.entries(mc)) jobs.push({ kind: 'mc', key, text, out: path.join(AUDIO_DIR, 'mc', key + '.mp3') });
  for (const q of bank) jobs.push({ kind: 'q', key: q.id, text: questionText(q), out: path.join(AUDIO_DIR, 'questions', q.id + '.mp3') });

  const results = { ok: [], missing: [] };
  let done = 0;
  async function worker(queue) {
    while (queue.length) {
      const job = queue.shift();
      let ok = false;
      try { ok = fs.existsSync(job.out) && fs.statSync(job.out).size > 1000; } catch (_) {}
      if (!ok) ok = await speak(job.text, job.out);
      (ok ? results.ok : results.missing).push((job.kind === 'mc' ? 'mc/' : 'q/') + job.key);
      done++;
      if (done % 20 === 0) console.log(`  ... ${done}/${jobs.length}`);
    }
  }
  const queue = [...jobs];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

  const manifest = {
    generatedAt: new Date().toISOString(),
    voice: 'avocado_v2:MAI_03',
    totalNeeded: jobs.length,
    generated: results.ok.length,
    missing: results.missing,
  };
  fs.writeFileSync(path.join(AUDIO_DIR, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(`AUDIO: đã sinh ${results.ok.length}/${jobs.length} clip (MC cố định ${Object.keys(mc).length} + câu hỏi ${bank.length})`);
  if (results.missing.length) console.log('AUDIO: còn thiếu ' + results.missing.length + ' clip: ' + results.missing.slice(0, 20).join(', ') + (results.missing.length > 20 ? ' …' : ''));
  console.log('AUDIO: manifest → app/audio/manifest.json');
}

if (require.main === module) main().catch(e => { console.error('AUDIO FAIL:', e.message); process.exit(0); });
module.exports = { mcClips, questionText, sanitize };
