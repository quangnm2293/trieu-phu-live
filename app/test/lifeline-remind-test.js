'use strict';
/**
 * TEST — tính năng "MC nhắc dùng quyền trợ giúp khi sắp hết giờ" (yêu cầu đại ca 09/11/2026):
 * trong câu hỏi ghế nóng, khi thời gian còn ≤ LIFELINE_REMIND_MS mà ghế nóng CHƯA trả lời
 * và VẪN CÒN ≥1 quyền trợ giúp → MC nhắc đúng 1 lần/câu (cue 'mc/lifeline-remind' + announce).
 *
 * Kịch bản (QUESTION_TIME_MS=12000, LIFELINE_REMIND_MS=4000):
 *  (a) ghế nóng không trả lời → cue nhắc xuất hiện ĐÚNG 1 lần, lúc còn ≤4s;
 *  (b) ghế nóng trả lời sớm (trước mốc nhắc) → KHÔNG có cue nhắc;
 *  (c) ghế nóng dùng HẾT 3 trợ giúp trước mốc nhắc → KHÔNG nhắc kể cả khi sắp hết giờ.
 * Chạy: node test/lifeline-remind-test.js → "LIFELINE-REMIND PASS" / "LIFELINE-REMIND FAIL".
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const PORT = 3110;
const BASE = `http://localhost:${PORT}`;
const REMIND_KEY = 'mc/lifeline-remind';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function check(cond, label) {
  console.log(`LIFELINE-REMIND: ${label} ${cond ? 'OK' : 'FAIL'}`);
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
    await sleep(120);
  }
  throw new Error('timeout chờ: ' + desc);
}
const waitPhase = (phase, timeout) => waitFor(async () => { const s = await get('/api/state'); return s.phase === phase ? s : null; }, 'phase=' + phase, timeout);
const wrongOf = (correct, removed = []) => ['A', 'B', 'C', 'D'].find(l => l !== correct && !removed.includes(l));

// --- thu thập MỌI cue từ /api/state (audioCues chỉ giữ 5 cue gần nhất → poll nhanh) ---
const collected = []; // {seq, keys, remainingMs, announcements}
let lastSeq = 0;
let collecting = false;
async function collectLoop() {
  while (collecting) {
    try {
      const s = await get('/api/state');
      const cues = s.audioCues || [];
      for (const c of cues) {
        if (c.seq > lastSeq) {
          lastSeq = c.seq;
          collected.push({ seq: c.seq, keys: c.keys || [], remainingMs: s.phaseEndsAt - s.serverNow, phase: s.phase, announcements: s.announcements || [] });
        }
      }
      if (s.audioCue && s.audioCue.seq > lastSeq) lastSeq = s.audioCue.seq;
    } catch (_) {}
    await sleep(80);
  }
}
const remindCues = () => collected.filter(c => c.keys.includes(REMIND_KEY));

/** Đưa 1 user lên ghế nóng qua vòng loại: user khác trả lời sai trước, user đích trả lời đúng duy nhất. */
async function seatHotseat(uid, nickname, fillerUid) {
  await waitPhase('qualifier');
  await waitFor(async () => { const s = await get('/api/state'); return s.phase === 'qualifier' && s.question && s.question.answersOpen ? s : null; }, 'cửa sổ vòng loại mở');
  const dbg = await get('/api/admin/state');
  sim(fillerUid, 'Khán giả', wrongOf(dbg.debug.correct));
  await sleep(250);
  sim(uid, nickname, dbg.debug.correct);
  await waitFor(async () => { const s = await get('/api/state'); return s.phase === 'question' && s.hotseat && s.hotseat.level === 1 ? s : null; }, 'vào câu 1 ghế nóng', 30000);
}
const waitQuestionOpen = (level, timeout = 30000) => waitFor(async () => {
  const s = await get('/api/state');
  return s.phase === 'question' && s.question && s.question.answersOpen && s.hotseat && s.hotseat.level === level ? s : null;
}, 'cửa sổ câu ' + level + ' mở', timeout);

async function main() {
  const d = new Date();
  const dayName = `scores-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  const dayFile = path.join(APP, 'data', dayName);
  const hadDay = fs.existsSync(dayFile);
  if (hadDay) fs.copyFileSync(dayFile, dayFile + '.remindbak');

  const env = {
    ...process.env, PORT: String(PORT),
    INTERMISSION_MS: '1000', QUALIFIER_TIME_MS: '6000', QUALIFIER_MIN_MS: '1000',
    REVEAL_TIME_MS: '1200', LOCKED_MS: '300', QUESTION_TIME_MS: '12000',
    LIFELINE_REMIND_MS: '4000', POLL_TIME_MS: '2500', RUN_END_MS: '1000',
    READING_TEST_MS: '1200',
  };
  const srv = spawn(process.execPath, [path.join(APP, 'server.js')], { env, stdio: 'pipe' });
  let srvLog = '';
  srv.stdout.on('data', c => { srvLog += c; });
  srv.stderr.on('data', c => { srvLog += c; });

  try {
    await waitFor(async () => { const s = await get('/api/state'); return s && s.game === 'trieu-phu-live' ? s : null; }, 'server boot', 15000);
    collecting = true;
    collectLoop();

    // ============ (a) không trả lời → nhắc ĐÚNG 1 lần khi còn ≤4s ============
    await seatHotseat('hs_a', 'Bạn A', 'fill_a');
    await waitQuestionOpen(1);
    const tOpenA = Date.now();
    await waitFor(async () => remindCues().length >= 1 ? true : null, 'cue nhắc xuất hiện', 20000);
    const first = remindCues()[0];
    check(first.remainingMs > 0 && first.remainingMs <= 4600, `(a) cue nhắc bắn khi còn ≤4s (đo được còn ~${Math.round(first.remainingMs)}ms)`);
    check(first.announcements.some(a => a.kind === 'lifeline' && a.text.includes('Sắp hết giờ')), '(a) kèm announce nhắc trợ giúp trên sân khấu');
    await waitPhase('reveal', 20000); // hết giờ → công bố
    await waitPhase('run_end', 15000);
    await sleep(400);
    check(remindCues().length === 1, `(a) cả câu chỉ nhắc ĐÚNG 1 lần (đếm được ${remindCues().length})`);
    check(Date.now() - tOpenA >= 11000, '(a) câu chạy hết 12s mới hết giờ (đồng hồ không bị nhắc làm lệch)');

    // ============ (b) trả lời sớm → KHÔNG nhắc ============
    const markB = remindCues().length;
    await seatHotseat('hs_b', 'Bạn B', 'fill_b');
    await waitQuestionOpen(1);
    let dbg = await get('/api/admin/state');
    sim('hs_b', 'Bạn B', dbg.debug.correct); // trả lời ngay khi cửa sổ vừa mở
    await waitQuestionOpen(2);
    dbg = await get('/api/admin/state');
    sim('hs_b', 'Bạn B', dbg.debug.correct);
    await waitQuestionOpen(3);
    await sleep(1500); // câu 3 đã mở 1,5s — vẫn xa mốc nhắc (8s)
    check(remindCues().length === markB, `(b) trả lời sớm cả 2 câu → không cue nhắc nào (thêm ${remindCues().length - markB})`);
    // kết thúc lượt của B cho sạch: trả lời sai để về vòng loại
    dbg = await get('/api/admin/state');
    sim('hs_b', 'Bạn B', wrongOf(dbg.debug.correct, dbg.debug.removed || []));
    await waitPhase('run_end', 20000);

    // ============ (c) dùng hết 3 trợ giúp trước mốc nhắc → KHÔNG nhắc ============
    const markC = remindCues().length;
    await seatHotseat('hs_c', 'Bạn C', 'fill_c');
    await waitQuestionOpen(1);
    sim('hs_c', 'Bạn C', '50');
    await waitFor(async () => { const s = await get('/api/state'); return s.lifelines && s.lifelines.fifty === false ? s : null; }, 'đã dùng 50:50');
    sim('hs_c', 'Bạn C', 'khan gia');
    await waitFor(async () => { const s = await get('/api/state'); return s.poll && s.poll.active ? s : null; }, 'phiếu khán giả mở', 15000);
    sim('vote_1', 'Vote 1', 'A'); sim('vote_2', 'Vote 2', 'B');
    await waitFor(async () => { const s = await get('/api/state'); return s.phase === 'question' && s.question && s.question.answersOpen && !(s.poll && s.poll.active) && s.lifelines && s.lifelines.poll === false ? s : null; }, 'phiếu đóng, đồng hồ chạy tiếp', 15000);
    const qidBeforeSwap = (await get('/api/admin/state')).debug.questionId;
    sim('hs_c', 'Bạn C', 'doi');
    await waitFor(async () => { const s = await get('/api/admin/state'); return s.debug.questionId && s.debug.questionId !== qidBeforeSwap ? s : null; }, 'đã đổi sang câu mới', 15000);
    const stC = await waitQuestionOpen(1);
    check(stC.lifelines && stC.lifelines.fifty === false && stC.lifelines.poll === false && stC.lifelines.swap === false, '(c) sau khi đổi câu: cả 3 trợ giúp đều đã dùng hết');
    await waitPhase('reveal', 25000); // để câu mới chạy HẾT giờ (qua mốc còn ≤4s)
    await sleep(300);
    check(remindCues().length === markC, `(c) hết trợ giúp → KHÔNG nhắc dù sắp hết giờ (thêm ${remindCues().length - markC})`);
  } catch (e) {
    failures++;
    console.log('LIFELINE-REMIND: EXCEPTION ' + e.message);
    console.log(srvLog.slice(-1500));
  } finally {
    collecting = false;
    srv.kill('SIGKILL');
    if (hadDay) fs.copyFileSync(dayFile + '.remindbak', dayFile);
    try { fs.unlinkSync(dayFile + '.remindbak'); } catch (_) {}
  }
  console.log(failures === 0 ? 'LIFELINE-REMIND PASS' : 'LIFELINE-REMIND FAIL');
  process.exit(failures === 0 ? 0 : 1);
}
main();
