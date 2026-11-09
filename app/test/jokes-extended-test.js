'use strict';
/**
 * JOKES-EXTENDED TEST — kiểm chứng mở rộng joke 09/11 (gồm bổ sung "joke thêm nhiều vào đi"):
 *  (1) JOKE_CORRECT_CHANCE=1 → trả lời ĐÚNG ở câu 3: cue có mc/correct + mc/joke-correct-N.
 *  (2) Đúng ở câu 7 → KHÔNG có joke-correct (chỉ áp dụng câu 1–5).
 *  (3) Trả lời SAI ở câu 6 → CÓ mc/joke-wrong-N (điều kiện mở rộng 1–6; test đặt JOKE_WRONG_CHANCE=1).
 *  (4) Sai ở câu 7 → KHÔNG có joke-wrong.
 *  (5) Người chơi MỚI lên ghế nóng → có cue mc/joke-welcome-N (sau chuỗi chào).
 *  (6) Server riêng: vào pha nghỉ (run_end → intermission) với JOKE_BREAK_CHANCE=1 → CÓ cue
 *      mc/joke-break-N; với JOKE_BREAK_CHANCE=0 → KHÔNG có.
 * Cách leo cấp: /api/sim/hotseat vào ghế, trả lời đúng liên tục qua /api/sim chat
 * + /api/admin/state (debug.correct) — cùng kỹ thuật name-joke-test.js.
 * Chạy: node test/jokes-extended-test.js → "JOKES-EXTENDED-TEST PASS"/"FAIL".
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const PORT = 3107;
const BASE = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function check(cond, label) {
  console.log(`JOKES-EXTENDED-TEST: ${label} ${cond ? 'OK' : 'FAIL'}`);
  if (!cond) failures++;
}
async function get(p) { const r = await fetch(BASE + p); return r.json(); }
async function post(p, body) {
  const r = await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return r.json();
}
const sim = (uid, nickname, text) => post('/api/sim', { type: 'chat', uniqueId: uid, nickname, avatarUrl: '', text });
async function waitFor(fn, desc, timeout = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { const v = await fn(); if (v) return v; } catch (_) {}
    await sleep(110);
  }
  throw new Error('timeout chờ: ' + desc);
}
const waitPhase = (phase, timeout) => waitFor(async () => { const s = await get('/api/state'); return s.phase === phase ? s : null; }, 'phase=' + phase, timeout);
const waitOpen = (timeout) => waitFor(async () => { const s = await get('/api/state'); return s.question && s.question.answersOpen ? s : null; }, 'cửa sổ trả lời mở', timeout);
const wrongOf = (correct, removed = []) => ['A', 'B', 'C', 'D'].find(l => l !== correct && !removed.includes(l));
const findCue = (marker, pred) => waitFor(async () => {
  const s = await get('/api/state');
  const c = (s.audioCues || []).find(c => c.seq > marker && pred(c.keys));
  return c || null;
}, 'cue khớp pattern', 12000);
async function cueMarker() { const s = await get('/api/state'); return s.audioCue ? s.audioCue.seq : 0; }

async function enterSeat(uid, nickname) {
  const marker = await cueMarker();
  await post('/api/sim/hotseat', { uniqueId: uid, nickname });
  await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.nickname === nickname ? x : null; }, uid + ' vào ghế');
  return marker;
}
async function climbTo(uid, nickname, targetLevel) {
  // đang ở câu 1; trả lời đúng cho tới khi lên targetLevel
  for (let lv = 1; lv < targetLevel; lv++) {
    await waitOpen();
    const dbg = await get('/api/admin/state');
    await sim(uid, nickname, dbg.debug.correct);
    await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === lv + 1 ? x : null; }, 'lên câu ' + (lv + 1));
  }
}
async function answerAt(uid, nickname, useWrong) {
  await waitOpen();
  const dbg = await get('/api/admin/state');
  const marker = await cueMarker();
  const letter = useWrong ? wrongOf(dbg.debug.correct, dbg.debug.removed) : dbg.debug.correct;
  await sim(uid, nickname, letter);
  return marker;
}

async function main() {
  const d = new Date();
  const dayName = `scores-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  const dayFile = path.join(APP, 'data', dayName);
  const hadDay = fs.existsSync(dayFile);
  if (hadDay) fs.copyFileSync(dayFile, dayFile + '.qabak');

  const env = {
    ...process.env, PORT: String(PORT),
    INTERMISSION_MS: '6000', QUALIFIER_TIME_MS: '6000', QUALIFIER_MIN_MS: '1000',
    REVEAL_TIME_MS: '2500', LOCKED_MS: '300', QUESTION_TIME_MS: '20000',
    POLL_TIME_MS: '3000', RUN_END_MS: '1500',
    READING_TEST_MS: '1500',
    JOKE_CORRECT_CHANCE: '1',
    JOKE_WRONG_CHANCE: '1', // sai cấp 1–6: joke-wrong mặc định 0.9 → test ép 1 cho chắc chắn
    NAME_TTS_CMD: '', // tắt TTS tên động cho gọn — joke-welcome không phụ thuộc clip tên
  };
  const srv = spawn(process.execPath, [path.join(APP, 'server.js')], { env, stdio: 'pipe' });
  let srvLog = '';
  srv.stdout.on('data', c => { srvLog += c; });
  srv.stderr.on('data', c => { srvLog += c; });

  try {
    await waitFor(async () => { const s = await get('/api/state'); return s && s.game === 'trieu-phu-live' ? s : null; }, 'server boot', 15000);
    check(true, 'server boot (JOKE_CORRECT_CHANCE=1)');

    // (5) ghế nóng mới → joke-welcome xuất hiện ngay khi vào ghế
    {
      const marker = await enterSeat('w_seat', 'Ghế Chào');
      const cue = await findCue(marker, keys => keys.some(k => /^mc\/joke-welcome-\d$/.test(k)));
      check(!!cue, `(5) người chơi mới lên ghế → có cue mc/joke-welcome-N (thực tế: ${cue ? cue.keys.join(' + ') : 'không thấy'})`);
      // kết lượt nhanh: sai ở câu 1
      const m2 = await answerAt('w_seat', 'Ghế Chào', true);
      await findCue(m2, keys => keys.includes('mc/wrong'));
      await waitPhase('run_end');
    }

    // (1) đúng ở câu 3 → có joke-correct
    {
      await enterSeat('c_seat', 'Ghế Đúng');
      await climbTo('c_seat', 'Ghế Đúng', 3);
      const marker = await answerAt('c_seat', 'Ghế Đúng', false);
      const cue = await findCue(marker, keys => keys.includes('mc/correct'));
      check(cue.keys.some(k => /^mc\/joke-correct-\d$/.test(k)),
        `(1) đúng ở câu 3 + chance=1 → cue có joke-correct (thực tế: ${cue.keys.join(' + ')})`);
      await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === 4 ? x : null; }, 'lên câu 4');
      const m2 = await answerAt('c_seat', 'Ghế Đúng', true);
      await findCue(m2, keys => keys.includes('mc/wrong'));
      await waitPhase('run_end');
    }

    // (2) đúng ở câu 7 → KHÔNG joke-correct
    {
      await enterSeat('c7_seat', 'Ghế Bảy');
      await climbTo('c7_seat', 'Ghế Bảy', 7);
      const marker = await answerAt('c7_seat', 'Ghế Bảy', false);
      const cue = await findCue(marker, keys => keys.includes('mc/correct'));
      check(!cue.keys.some(k => k.startsWith('mc/joke-correct-')),
        `(2) đúng ở câu 7 → cue chỉ mc/correct, KHÔNG joke-correct (thực tế: ${cue.keys.join(' + ')})`);
      await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === 8 ? x : null; }, 'lên câu 8');
      const m2 = await answerAt('c7_seat', 'Ghế Bảy', true);
      await findCue(m2, keys => keys.includes('mc/wrong'));
      await waitPhase('run_end');
    }

    // (3) sai ở câu 6 → CÓ joke-wrong (mở rộng 1–6)
    {
      await enterSeat('w6_seat', 'Ghế Sáu');
      await climbTo('w6_seat', 'Ghế Sáu', 6);
      const marker = await answerAt('w6_seat', 'Ghế Sáu', true);
      const cue = await findCue(marker, keys => keys.includes('mc/wrong'));
      check(cue.keys.some(k => k.startsWith('mc/joke-wrong-')),
        `(3) sai ở câu 6 → cue có joke-wrong (thực tế: ${cue.keys.join(' + ')})`);
      await waitPhase('run_end');
    }

    // (4) sai ở câu 7 → KHÔNG joke-wrong
    {
      await enterSeat('w7_seat', 'Ghế Sai Bảy');
      await climbTo('w7_seat', 'Ghế Sai Bảy', 7);
      const marker = await answerAt('w7_seat', 'Ghế Sai Bảy', true);
      const cue = await findCue(marker, keys => keys.includes('mc/wrong'));
      check(!cue.keys.some(k => k.startsWith('mc/joke-wrong-')),
        `(4) sai ở câu 7 → cue chỉ mc/wrong, KHÔNG joke-wrong (thực tế: ${cue.keys.join(' + ')})`);
      await waitPhase('run_end');
    }
  } catch (e) {
    failures++;
    console.log('JOKES-EXTENDED-TEST: NGOẠI LỆ — ' + e.message);
    if (srvLog) console.log('--- log server ---\n' + srvLog.slice(-1500));
  } finally {
    try { srv.kill('SIGKILL'); } catch (_) {}
    if (hadDay) { try { fs.copyFileSync(dayFile + '.qabak', dayFile); fs.unlinkSync(dayFile + '.qabak'); } catch (_) {} }
    else { try { fs.unlinkSync(dayFile); } catch (_) {} }
  }

  // (6) Joke lúc nghỉ giải lao — 2 server riêng với JOKE_BREAK_CHANCE = 1 và 0.
  // Luồng: boot vào intermission (first=true, bị loại khỏi joke-break) → vòng loại tự
  // hết giờ nhiều lần (QUALIFIER_MAX_FAILS mặc định 3) → startIntermission lần nữa
  // (KHÔNG phải first) → kiểm tra cue. Poll state liên tục, ghi lại mọi cue đã thấy.
  async function breakScenario(chance, port) {
    const envB = {
      ...process.env, PORT: String(port),
      INTERMISSION_MS: '2500', QUALIFIER_TIME_MS: '2500', QUALIFIER_MIN_MS: '600',
      REVEAL_TIME_MS: '1200', LOCKED_MS: '200', QUESTION_TIME_MS: '8000',
      POLL_TIME_MS: '2000', RUN_END_MS: '600',
      READING_TEST_MS: '900',
      JOKE_BREAK_CHANCE: String(chance),
      NAME_TTS_CMD: '',
    };
    const proc = spawn(process.execPath, [path.join(APP, 'server.js')], { env: envB, stdio: 'pipe' });
    let log = '';
    proc.stdout.on('data', c => { log += c; });
    proc.stderr.on('data', c => { log += c; });
    const seenBreak = { found: false };
    try {
      const B = `http://localhost:${port}`;
      const getB = async (p) => { const r = await fetch(B + p); return r.json(); };
      await waitFor(async () => { const s = await getB('/api/state'); return s && s.game === 'trieu-phu-live' ? s : null; }, 'boot break-server', 15000);
      let intermissions = 0; let wasInter = true; // boot đã ở intermission lần 1
      const t0 = Date.now();
      while (Date.now() - t0 < 90000) {
        const s = await getB('/api/state');
        if ((s.audioCues || []).some(c => (c.keys || []).some(k => /^mc\/joke-break-\d$/.test(k)))) { seenBreak.found = true; break; }
        const isInter = s.phase === 'intermission';
        if (isInter && !wasInter) intermissions++;
        wasInter = isInter;
        if (intermissions >= 1 && isInter) break; // đã vào nghỉ lần 2 mà không thấy cue (trường hợp chance=0)
        await sleep(120);
      }
      return { found: seenBreak.found, intermissions, log };
    } finally {
      try { proc.kill('SIGKILL'); } catch (_) {}
    }
  }
  {
    const r1 = await breakScenario(1, PORT + 101);
    check(r1.found === true, `(6a) vào nghỉ với JOKE_BREAK_CHANCE=1 → có cue mc/joke-break-N (số lần vào nghỉ quan sát: ${r1.intermissions})`);
    if (!r1.found) console.log('--- log break-server(1) ---\n' + r1.log.slice(-800));
    const r0 = await breakScenario(0, PORT + 102);
    check(r0.found === false, `(6b) vào nghỉ với JOKE_BREAK_CHANCE=0 → KHÔNG có cue mc/joke-break-N (số lần vào nghỉ quan sát: ${r0.intermissions})`);
  }

  console.log(failures === 0 ? 'JOKES-EXTENDED-TEST PASS' : `JOKES-EXTENDED-TEST FAIL (${failures} mục)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
