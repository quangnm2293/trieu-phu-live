'use strict';
/**
 * TEST HỒI QUY — lỗi live tối 08/11/2026: "câu joke nói chưa xong đã chuyển sang
 * nghỉ giải lao". Nguyên nhân: pha công bố (reveal) mặc định 5s trong khi cue của
 * pha là mc/wrong (2,69s) + joke (4,03–5,95s) = tối thiểu 6,7s → joke bị cắt đuôi
 * khi game chuyển pha. Fix: doReveal kéo dài pha theo tổng thời lượng thật của cue.
 *
 * Kịch bản: ghế nóng sai ở câu 1 → mẫu state đầu tiên của pha reveal phải còn
 * ≥6,8s mới hết pha (bản lỗi chỉ ~5s), và pha reveal thật sự kéo dài ≥6,8s.
 * Chạy: node test/reveal-audio-test.js → "REVEAL-AUDIO PASS" / "REVEAL-AUDIO FAIL".
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const PORT = 3103;
const BASE = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function check(cond, label) {
  console.log(`REVEAL-AUDIO: ${label} ${cond ? 'OK' : 'FAIL'}`);
  if (!cond) failures++;
}
async function get(p) { const r = await fetch(BASE + p); return r.json(); }
async function post(p, body) {
  const r = await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return r.json();
}
const sim = (uid, nickname, text) => post('/api/sim', { type: 'chat', uniqueId: uid, nickname, avatarUrl: '', text });
async function waitFor(fn, desc, timeout = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { const v = await fn(); if (v) return v; } catch (_) {}
    await sleep(100);
  }
  throw new Error('timeout chờ: ' + desc);
}
const waitPhase = (phase, timeout) => waitFor(async () => { const s = await get('/api/state'); return s.phase === phase ? s : null; }, 'phase=' + phase, timeout);
const waitOpen = (timeout) => waitFor(async () => { const s = await get('/api/state'); return s.question && s.question.answersOpen ? s : null; }, 'cửa sổ trả lời mở', timeout);
const wrongOf = (correct, removed = []) => ['A', 'B', 'C', 'D'].find(l => l !== correct && !removed.includes(l));

async function main() {
  const d = new Date();
  const dayName = `scores-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  const dayFile = path.join(APP, 'data', dayName);
  const hadDay = fs.existsSync(dayFile);
  if (hadDay) fs.copyFileSync(dayFile, dayFile + '.rvbak');

  const env = {
    ...process.env, PORT: String(PORT),
    // CỐ Ý không đặt REVEAL_TIME_MS → dùng mặc định production 5000ms, đúng cấu hình live.
    INTERMISSION_MS: '1000', QUALIFIER_TIME_MS: '6000', QUALIFIER_MIN_MS: '1200',
    LOCKED_MS: '300', QUESTION_TIME_MS: '20000', RUN_END_MS: '1200',
    READING_TEST_MS: '600',
  };
  const srv = spawn(process.execPath, [path.join(APP, 'server.js')], { env, stdio: 'pipe' });
  let srvLog = '';
  srv.stdout.on('data', c => { srvLog += c; });
  srv.stderr.on('data', c => { srvLog += c; });

  try {
    await waitFor(async () => { const s = await get('/api/state'); return s && s.game === 'trieu-phu-live' ? s : null; }, 'server boot', 15000);

    // vòng loại → user_a lên ghế nóng
    await waitPhase('qualifier');
    await waitOpen();
    let dbg = await get('/api/admin/state');
    sim('user_c', 'Bạn C', wrongOf(dbg.debug.correct));
    await sleep(250); sim('user_a', 'Bạn A', dbg.debug.correct);
    await waitPhase('qualifier_reveal');
    await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === 1 ? x : null; }, 'vào câu 1');

    // câu 1: ghế nóng trả lời SAI → reveal có joke (câu <5)
    await waitOpen();
    dbg = await get('/api/admin/state');
    sim('user_a', 'Bạn A', wrongOf(dbg.debug.correct, dbg.debug.removed));
    const first = await waitPhase('reveal');
    check(first.lastReveal && first.lastReveal.hotseatResult === 'wrong', 'reveal ghi nhận ghế nóng trả lời sai');
    const remain0 = first.phaseEndsAt - first.serverNow;
    check(remain0 >= 6800, `mẫu reveal đầu tiên còn ${remain0}ms (bản lỗi ~5000; cần ≥6800 = wrong 2,69s + joke ngắn nhất 4,03s + đệm)`);

    // pha reveal phải thật sự kéo dài tương ứng (không chuyển sang run_end sớm)
    const t0 = Date.now();
    await waitFor(async () => { const x = await get('/api/state'); return x.phase !== 'reveal' ? x : null; }, 'hết pha reveal', 20000);
    const span = Date.now() - t0 + (5000 - Math.min(5000, remain0)) * 0; // t0 ≈ lúc first (lệch ≤ ~200ms lấy mẫu)
    check(span >= 6500, `pha reveal kéo dài thật ${span}ms kể từ mẫu đầu tiên (cần ≥6500)`);
  } catch (e) {
    failures++;
    console.log('REVEAL-AUDIO: EXCEPTION ' + e.message);
    console.log(srvLog.slice(-1200));
  } finally {
    srv.kill('SIGKILL');
    if (hadDay) fs.copyFileSync(dayFile + '.rvbak', dayFile);
    try { fs.unlinkSync(dayFile + '.rvbak'); } catch (_) {}
  }
  console.log(failures === 0 ? 'REVEAL-AUDIO PASS' : 'REVEAL-AUDIO FAIL');
  process.exit(failures === 0 ? 0 : 1);
}
main();
