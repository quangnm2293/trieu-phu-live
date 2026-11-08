'use strict';
/**
 * TEST HỒI QUY — lỗi live tối 08/11/2026: câu "Nhanh nhất câu này là…" lúc đọc
 * lúc không, đọc chưa xong đã sang câu mới. Nguyên nhân: hạn chờ clip tên chốt
 * cứng REVEAL_TIME_MS (5s) trong khi clip tên xếp hàng sau cue công bố, và pha
 * reveal kết thúc đúng 5s bất kể clip tên đã phát xong chưa.
 * Fix: hạn chờ = hết pha reveal; khi clip tên bắn ra, pha kéo dài thêm tới
 * (cue công bố xong + thời lượng clip tên + đệm) — thời lượng đo thật bằng
 * afinfo/ffprobe trong name-tts.
 *
 * Kịch bản (stub TTS chép locked.mp3 = 3,6s làm clip tên): khán giả Bạn E đúng
 * nhanh nhất, ghế nóng cũng đúng → reveal phải được LÊN KẾ HOẠCH ≥6,3s
 * (2,23s correct + 3,6s tên + đệm; bản lỗi đúng 5,0s) và giữ thật ≥6,0s.
 * Chạy: node test/reveal-fastest-test.js → "REVEAL-FASTEST PASS" / "FAIL".
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const APP = path.join(__dirname, '..');
const PORT = 3104;
const BASE = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function check(cond, label) {
  console.log(`REVEAL-FASTEST: ${label} ${cond ? 'OK' : 'FAIL'}`);
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
  if (hadDay) fs.copyFileSync(dayFile, dayFile + '.rfbak');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-fastest-'));
  const stubLog = path.join(tmp, 'stub-log.jsonl');
  const stubJs = path.join(tmp, 'stub-tts.js');
  fs.writeFileSync(stubJs, `'use strict';
const fs = require('fs');
const [text, out] = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(stubLog)}, JSON.stringify({ text, out }) + '\\n');
fs.copyFileSync(${JSON.stringify(path.join(APP, 'audio', 'mc', 'locked.mp3'))}, out);
`);
  const stubLines = () => { try { return fs.readFileSync(stubLog, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (_) { return []; } };
  const dynDir = path.join(APP, 'audio', 'dynamic');
  const dynBefore = new Set(fs.existsSync(dynDir) ? fs.readdirSync(dynDir) : []);

  const env = {
    ...process.env, PORT: String(PORT),
    // CỐ Ý không đặt REVEAL_TIME_MS → mặc định production 5000ms.
    INTERMISSION_MS: '1000', QUALIFIER_TIME_MS: '6000', QUALIFIER_MIN_MS: '1200',
    LOCKED_MS: '300', QUESTION_TIME_MS: '20000', RUN_END_MS: '1200',
    READING_TEST_MS: '600',
    NAME_TTS_CMD: `node ${stubJs} {text} {out}`,
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

    // câu 1: Bạn E (khán giả) đúng trước, ghế nóng đúng sau → reveal có tên nhanh nhất
    await waitOpen();
    dbg = await get('/api/admin/state');
    const c1 = dbg.debug.correct;
    const marker = (await get('/api/state')).audioCue ? (await get('/api/state')).audioCue.seq : 0;
    sim('user_e', 'Bạn E', c1);
    await sleep(200);
    sim('user_a', 'Bạn A', c1);
    const first = await waitPhase('reveal');
    const revealStartSrv = first.serverNow;
    const tReveal0 = Date.now();

    // chờ cue dyn/fastest xuất hiện trong audioCues
    const cue = await waitFor(async () => {
      const s = await get('/api/state');
      const c = (s.audioCues || []).find(c => c.seq > marker && c.keys.some(k => k.startsWith('dyn/fastest-')));
      return c || null;
    }, 'cue dyn/fastest', 12000);
    check(!!cue, 'có cue đọc tên khán giả nhanh nhất (dyn/fastest-…)');
    check(stubLines().some(l => l.text === 'Nhanh nhất câu này là Bạn E!'), 'clip tên đọc đúng người nhanh nhất (Bạn E, không phải ghế nóng)');

    // pha reveal phải được lên kế hoạch đủ dài cho correct (2,23s) + tên (3,6s) + đệm
    let maxEnds = 0;
    let lastPhase = 'reveal';
    let tEnd = 0;
    const tLoop = Date.now();
    while (Date.now() - tLoop < 12000) {
      const x = await get('/api/state');
      if (x.phase !== 'reveal') { lastPhase = x.phase; tEnd = Date.now(); break; }
      if (x.phaseEndsAt > maxEnds) maxEnds = x.phaseEndsAt;
      await sleep(100);
    }
    const planned = maxEnds - revealStartSrv;
    check(planned >= 6300, `pha reveal lên kế hoạch ${planned}ms (bản lỗi 5000; cần ≥6300 = correct 2,23s + tên 3,6s + đệm)`);
    const actual = tEnd - tReveal0;
    check(lastPhase !== 'reveal' && actual >= 6000, `pha reveal giữ thật ~${actual}ms kể từ mẫu đầu tiên rồi mới chuyển pha (${lastPhase})`);
  } catch (e) {
    failures++;
    console.log('REVEAL-FASTEST: EXCEPTION ' + e.message);
    console.log(srvLog.slice(-1200));
  } finally {
    srv.kill('SIGKILL');
    try { for (const f of fs.readdirSync(dynDir)) if (!dynBefore.has(f)) fs.unlinkSync(path.join(dynDir, f)); } catch (_) {}
    if (hadDay) fs.copyFileSync(dayFile + '.rfbak', dayFile);
    try { fs.unlinkSync(dayFile + '.rfbak'); } catch (_) {}
  }
  console.log(failures === 0 ? 'REVEAL-FASTEST PASS' : 'REVEAL-FASTEST FAIL');
  process.exit(failures === 0 ? 0 : 1);
}
main();
