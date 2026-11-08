'use strict';
/**
 * TEST HỒI QUY — lỗi live 08/11/2026: sau khi dùng trợ giúp KHÁN GIẢ ở một câu,
 * tỉ lệ phiếu của câu đó (vd 100% cho một đáp án) hiện ĐÈ lên câu MỚI ngay trong
 * lúc MC đang đọc câu mới — khán giả tưởng là kết quả thật của câu hiện tại.
 * Nguyên nhân gốc: game.lastPoll không gắn với câu đã bầu và startQuestion không xóa.
 *
 * Kịch bản: bầu phiếu ở câu 1 (100% cho một đáp án SAI) → kết quả vẫn hiện ở câu 1
 * (hành vi ĐÚNG, giữ nguyên) → ghế nóng trả lời đúng → sang câu 2: trong suốt pha
 * "MC đang đọc" của câu 2, /api/state KHÔNG được chứa poll nào nữa.
 * Chạy: node test/poll-stale-test.js → "POLL-STALE PASS" / "POLL-STALE FAIL".
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const PORT = 3101;
const BASE = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function check(cond, label) {
  console.log(`POLL-STALE: ${label} ${cond ? 'OK' : 'FAIL'}`);
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
    await sleep(120);
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
  if (hadDay) fs.copyFileSync(dayFile, dayFile + '.pollbak');

  const env = {
    ...process.env, PORT: String(PORT),
    INTERMISSION_MS: '1200', QUALIFIER_TIME_MS: '6000', QUALIFIER_MIN_MS: '1200',
    REVEAL_TIME_MS: '1500', LOCKED_MS: '300', QUESTION_TIME_MS: '20000',
    POLL_TIME_MS: '3000', RUN_END_MS: '1200',
    READING_TEST_MS: '2000',
  };
  const srv = spawn(process.execPath, [path.join(APP, 'server.js')], { env, stdio: 'pipe' });
  let srvLog = '';
  srv.stdout.on('data', c => { srvLog += c; });
  srv.stderr.on('data', c => { srvLog += c; });

  try {
    await waitFor(async () => { const s = await get('/api/state'); return s && s.game === 'trieu-phu-live' ? s : null; }, 'server boot', 15000);

    // --- vòng loại: user_a đúng + nhanh nhất → ghế nóng ---
    await waitPhase('qualifier');
    await waitOpen();
    let dbg = await get('/api/admin/state');
    sim('user_c', 'Bạn C', wrongOf(dbg.debug.correct));
    await sleep(250); sim('user_a', 'Bạn A', dbg.debug.correct);
    await waitPhase('qualifier_reveal');
    await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === 1 ? x : null; }, 'vào câu 1');

    // --- câu 1: KHÁN GIẢ, cả 2 phiếu dồn cho 1 đáp án SAI (=100%) ---
    await waitOpen();
    dbg = await get('/api/admin/state');
    const c1 = dbg.debug.correct;
    const wAll = wrongOf(c1);
    sim('user_a', 'Bạn A', 'khan gia');
    await waitFor(async () => { const x = await get('/api/state'); return x.poll && x.poll.active ? x : null; }, 'phiếu mở');
    sim('vote_1', 'Vote 1', wAll); sim('vote_2', 'Vote 2', wAll);
    const closed = await waitFor(async () => { const x = await get('/api/state'); return x.poll && !x.poll.active && x.phase === 'question' ? x : null; }, 'phiếu đóng', 15000);
    check(closed.poll.percents[wAll] === 100, `câu 1: kết quả phiếu vẫn hiện ở CHÍNH câu đã bầu (${wAll}=${closed.poll.percents[wAll]}%)`);

    // --- ghế nóng trả lời đúng → câu 2: suốt pha đọc, state không được có poll ---
    sim('user_a', 'Bạn A', c1);
    await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === 2 ? x : null; }, 'lên câu 2');
    let readingSamples = 0, pollLeaks = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 2600) {
      const x = await get('/api/state');
      if (x.question && x.question.reading) {
        readingSamples++;
        if (x.poll) pollLeaks++;
      }
      await sleep(80);
    }
    check(readingSamples >= 3, `câu 2: bắt được pha đọc trong lúc lấy mẫu (${readingSamples} mẫu)`);
    check(pollLeaks === 0, `câu 2: KHÔNG mẫu pha-đọc nào chứa tỉ lệ phiếu cũ (rò ${pollLeaks}/${readingSamples})`);
  } catch (e) {
    failures++;
    console.log('POLL-STALE: EXCEPTION ' + e.message);
    console.log(srvLog.slice(-1500));
  } finally {
    srv.kill('SIGKILL');
    if (hadDay) fs.copyFileSync(dayFile + '.pollbak', dayFile);
    try { fs.unlinkSync(dayFile + '.pollbak'); } catch (_) {}
  }
  console.log(failures === 0 ? 'POLL-STALE PASS' : 'POLL-STALE FAIL');
  process.exit(failures === 0 ? 0 : 1);
}
main();
