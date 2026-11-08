'use strict';
/**
 * NAME-JOKE TEST — kiểm chứng các tính năng bổ sung 08/11:
 *  (A) MC đọc TÊN người lên ghế nóng bằng TTS động (stub NAME_TTS_CMD trên Linux):
 *      thắng vòng loại → có cue 'dyn/hotseat-…' + file trong audio/dynamic/;
 *      nickname toàn emoji → không cue tên, game không lỗi; tên lẫn emoji → đọc phần chữ sạch.
 *  (B) Reveal câu ghế nóng có khán giả đúng → cue 'dyn/fastest-…' cho người nhanh nhất.
 *  (C) Sai ở câu <5 → cue ['mc/wrong','mc/joke-wrong-N'], 2 lần liên tiếp không trùng N;
 *      sai ở câu 7 → KHÔNG có joke.
 *  (D) audio-done: POST đúng qid → {opened:true}; POST lại → {opened:false}, state không hỏng;
 *      stage.js có logic gửi lại tới khi server xác nhận (đọc code).
 *  (E) Trần cửa sổ đọc dự phòng: clip 38s → readingWindowMs bị cắt ở 25.000ms (unit, env sạch).
 *  (F) Nhạc nền lúc nghỉ: state có musicEnabled + musicTracks đúng; MUSIC_ENABLED=0 → tắt;
 *      trên stage thật (CDP): nhạc phát ở intermission, dừng khi vào vòng loại.
 * Chạy: node test/name-joke-test.js → "NAME-JOKE-TEST PASS"/"FAIL".
 */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');

const APP = path.join(__dirname, '..');
const PORT = 3097;
const BASE = `http://localhost:${PORT}`;
const CDP_PORT = 9340;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function check(cond, label) {
  console.log(`NAME-JOKE-TEST: ${label} ${cond ? 'OK' : 'FAIL'}`);
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
// Tìm cue có seq > marker và chứa key khớp pattern — từ audioCues của state.
const findCue = (marker, pred) => waitFor(async () => {
  const s = await get('/api/state');
  const c = (s.audioCues || []).find(c => c.seq > marker && pred(c.keys));
  return c || null;
}, 'cue khớp pattern', 12000);
async function cueMarker() { const s = await get('/api/state'); return s.audioCue ? s.audioCue.seq : 0; }
async function endRunByWrong(uid, nickname) {
  await waitOpen();
  const dbg = await get('/api/admin/state');
  await sim(uid, nickname, wrongOf(dbg.debug.correct, dbg.debug.removed));
  await waitPhase('run_end');
}

// ---------- CDP tối thiểu (như audio-sync-test) ----------
function findChrome() {
  const roots = [path.join(os.homedir(), '.cache/puppeteer/chrome'), path.join(os.homedir(), '.cache/puppeteer/chrome-headless-shell')];
  for (const root of roots) {
    try {
      for (const ver of fs.readdirSync(root)) {
        for (const rel of ['chrome-linux64/chrome', 'chrome-headless-shell-linux64/headless_shell', 'chrome-headless-shell-linux64/chrome-headless-shell']) {
          const p = path.join(root, ver, rel);
          if (fs.existsSync(p)) return p;
        }
      }
    } catch (_) {}
  }
  return null;
}
function cdpConnect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.on('message', raw => {
      let m; try { m = JSON.parse(raw.toString()); } catch (_) { return; }
      if (m.id && pending.has(m.id)) { const { res } = pending.get(m.id); pending.delete(m.id); res(m.result || {}); }
    });
    ws.on('open', () => resolve({
      send(method, params = {}) { return new Promise(res => { const mid = ++id; pending.set(mid, { res }); ws.send(JSON.stringify({ id: mid, method, params })); }); },
      close() { try { ws.close(); } catch (_) {} },
    }));
    ws.on('error', reject);
  });
}

async function main() {
  // --- cô lập dữ liệu ngày như qa.js ---
  const d = new Date();
  const dayName = `scores-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  const dayFile = path.join(APP, 'data', dayName);
  const hadDay = fs.existsSync(dayFile);
  if (hadDay) fs.copyFileSync(dayFile, dayFile + '.qabak');

  // --- stub TTS cho NAME_TTS_CMD: chép 1 mp3 thật nhỏ vào {out} + ghi log {text,out} ---
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-nametts-'));
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
    INTERMISSION_MS: '6000', QUALIFIER_TIME_MS: '6000', QUALIFIER_MIN_MS: '1000',
    REVEAL_TIME_MS: '2500', LOCKED_MS: '300', QUESTION_TIME_MS: '20000',
    POLL_TIME_MS: '3000', RUN_END_MS: '1500',
    READING_TEST_MS: '1500',
    NAME_TTS_CMD: `node ${stubJs} {text} {out}`,
  };
  const srv = spawn(process.execPath, [path.join(APP, 'server.js')], { env, stdio: 'pipe' });
  let srvLog = '';
  srv.stdout.on('data', c => { srvLog += c; });
  srv.stderr.on('data', c => { srvLog += c; });

  let chrome = null, cdp = null, profile = null;
  try {
    await waitFor(async () => { const s = await get('/api/state'); return s && s.game === 'trieu-phu-live' ? s : null; }, 'server boot', 15000);
    check(true, 'server boot với NAME_TTS_CMD=stub');

    // ============ (F1) state: nhạc nền ============
    {
      const s = await get('/api/state');
      check(s.musicEnabled === true && Array.isArray(s.musicTracks) && s.musicTracks.includes('/music/placeholder-remix.mp3'),
        `state có musicEnabled=true + musicTracks chứa placeholder (${JSON.stringify(s.musicTracks)})`);
      const r = await fetch(BASE + '/music/placeholder-remix.mp3');
      check(r.status === 200, 'server phục vụ được file nhạc /music/placeholder-remix.mp3');
    }

    // ============ (F2) stage thật (CDP): nhạc chỉ phát lúc nghỉ ============
    {
      const chromeBin = findChrome();
      check(!!chromeBin, 'tìm thấy Chrome headless cho mục F');
      if (chromeBin) {
        profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-chrome-music-'));
        chrome = spawn(chromeBin, [
          '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
          '--autoplay-policy=no-user-gesture-required',
          `--remote-debugging-port=${CDP_PORT}`, '--remote-debugging-address=127.0.0.1',
          `--user-data-dir=${profile}`, BASE + '/?obs=1',
        ], { stdio: 'ignore' });
        const target = await waitFor(async () => {
          const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
          const list = await r.json();
          return list.find(t => t.type === 'page' && t.url.includes(`:${PORT}`)) || null;
        }, 'CDP target', 20000);
        cdp = await cdpConnect(target.webSocketDebuggerUrl);
        await cdp.send('Runtime.enable');
        const ev = async expr => {
          const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true });
          if (r.exceptionDetails) throw new Error('evaluate lỗi: ' + (r.exceptionDetails.text || ''));
          return r.result ? r.result.value : undefined;
        };
        await post('/api/sim/phase', { phase: 'intermission' });
        await waitFor(async () => (await ev('!!(window.__tpMusic && window.__tpMusic.playing)')) === true, 'nhạc phát ở intermission', 15000);
        check(true, 'nhạc nền ĐANG PHÁT ở pha intermission trên stage thật');
        const src = await ev('window.__tpMusic.src');
        check(typeof src === 'string' && src.startsWith('/music/'), `bài đang phát thuộc playlist /music/ (${src})`);
        await post('/api/sim/phase', { phase: 'qualifier' });
        await waitFor(async () => (await ev('window.__tpMusic.on')) === false, 'nhạc tắt khi vào vòng loại', 8000);
        await sleep(1400); // chờ fade-out ~1s chạy xong
        const still = await ev('window.__tpMusic.playing');
        check(still === false, 'vào vòng loại → nhạc đã dừng hẳn (sau fade-out)');
        cdp.close(); cdp = null;
        try { chrome.kill('SIGKILL'); } catch (_) {}
        chrome = null;
      }
    }

    // ============ (A1) thắng vòng loại → cue đọc tên ghế nóng + file dynamic ============
    {
      await waitPhase('qualifier');
      await waitOpen();
      const dbg = await get('/api/admin/state');
      const qc = dbg.debug.correct;
      await sim('user_c', 'Bạn C', wrongOf(qc));
      await sleep(200);
      const marker = await cueMarker();
      await sim('fan_win', 'Minh Anh', qc); // đúng + nhanh nhất → thắng vòng loại
      const cue = await findCue(marker, keys => keys.some(k => k.startsWith('dyn/hotseat-')));
      check(!!cue, `có cue đọc tên ghế nóng (${cue ? cue.keys.join('+') : 'không thấy'})`);
      const dynKey = cue.keys.find(k => k.startsWith('dyn/hotseat-'));
      const fpath = path.join(dynDir, dynKey.slice(4));
      check(fs.existsSync(fpath) && fs.statSync(fpath).size > 1000, 'file clip tên tồn tại trong audio/dynamic/');
      check(stubLines().some(l => l.text === 'Ghế nóng thuộc về Minh Anh!'), 'stub TTS nhận đúng mẫu câu "Ghế nóng thuộc về Minh Anh!"');
      await endRunByWrong('fan_win', 'Minh Anh');
      check(true, 'kết thúc lượt của Minh Anh bình thường');
    }

    // ============ (A2) nickname toàn emoji → không cue tên, không lỗi ============
    {
      const logCount = stubLines().length;
      const marker = await cueMarker();
      await post('/api/sim/hotseat', { uniqueId: 'emoji_fan', nickname: '🔥🔥🔥' });
      const s = await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat ? x : null; }, 'emoji_fan vào ghế');
      check(s.hotseat.nickname === '🔥🔥🔥', 'người tên emoji vẫn vào ghế nóng bình thường');
      await sleep(900);
      const s2 = await get('/api/state');
      const newCues = (s2.audioCues || []).filter(c => c.seq > marker);
      check(!newCues.some(c => c.keys.some(k => k.startsWith('dyn/'))), 'nickname toàn emoji → KHÔNG có cue dyn/ nào');
      check(stubLines().length === logCount, 'stub TTS không bị gọi cho tên rỗng sau làm sạch');
      await endRunByWrong('emoji_fan', '🔥🔥🔥');
    }

    // ============ (A3) tên lẫn emoji → đọc phần chữ đã làm sạch ============
    {
      await post('/api/sim/hotseat', { uniqueId: 'mix_fan', nickname: '💥Bảo💥 Ngọc' });
      await waitFor(async () => stubLines().some(l => l.text === 'Ghế nóng thuộc về Bảo Ngọc!') ? true : null,
        'stub nhận tên đã làm sạch "Bảo Ngọc"', 10000);
      check(true, 'nickname "💥Bảo💥 Ngọc" → TTS đọc "Ghế nóng thuộc về Bảo Ngọc!" (emoji bị loại, giữ dấu tiếng Việt)');
      await endRunByWrong('mix_fan', '💥Bảo💥 Ngọc');
    }

    // ============ (B) reveal: cue đọc tên khán giả đúng + nhanh nhất ============
    {
      await post('/api/sim/hotseat', { uniqueId: 'seat_q', nickname: 'Ghế Q' });
      await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.nickname === 'Ghế Q' ? x : null; }, 'seat_q vào ghế');
      await waitOpen();
      const dbg = await get('/api/admin/state');
      const c = dbg.debug.correct;
      const marker = await cueMarker();
      await sim('aud_fast', 'Khán Giả Nhanh', c);       // khán giả đúng, duy nhất
      await sleep(200);
      await sim('seat_q', 'Ghế Q', c);                  // ghế nóng đúng → reveal
      const cue = await findCue(marker, keys => keys.some(k => k.startsWith('dyn/fastest-')));
      check(!!cue, `reveal có cue đọc tên khán giả nhanh nhất (${cue ? cue.keys.join('+') : 'không thấy'})`);
      check(stubLines().some(l => l.text === 'Nhanh nhất câu này là Khán Giả Nhanh!'),
        'stub TTS nhận đúng mẫu câu "Nhanh nhất câu này là Khán Giả Nhanh!"');
      // dọn lượt: chờ sang câu 2 rồi trả lời sai
      await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === 2 ? x : null; }, 'seat_q lên câu 2');
      await endRunByWrong('seat_q', 'Ghế Q');
    }

    // ============ (C) joke khi sai câu <5; không joke ở câu 7; không lặp N liên tiếp ============
    const jokeOf = async (uid, nickname) => {
      await post('/api/sim/hotseat', { uniqueId: uid, nickname });
      await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.nickname === nickname ? x : null; }, uid + ' vào ghế');
      await waitOpen();
      const dbg = await get('/api/admin/state');
      const marker = await cueMarker();
      await sim(uid, nickname, wrongOf(dbg.debug.correct, dbg.debug.removed));
      const cue = await findCue(marker, keys => keys.includes('mc/wrong'));
      await waitPhase('run_end');
      return cue.keys;
    };
    const keysA = await jokeOf('seat_j1', 'Ghế J1');
    const mA = keysA.join(' ').match(/mc\/joke-wrong-(\d)/);
    check(!!mA && keysA[0] === 'mc/wrong', `sai ở câu 1 → cue ['mc/wrong','mc/joke-wrong-N'] (thực tế: ${keysA.join(' + ')})`);
    const keysB = await jokeOf('seat_j2', 'Ghế J2');
    const mB = keysB.join(' ').match(/mc\/joke-wrong-(\d)/);
    check(!!mB && mB[1] !== (mA && mA[1]), `sai lần kế tiếp → joke khác lần trước (N: ${mA && mA[1]} → ${mB && mB[1]})`);
    {
      // leo tới câu 7 rồi sai → không joke
      await post('/api/sim/hotseat', { uniqueId: 'seat_j3', nickname: 'Ghế J3' });
      await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.nickname === 'Ghế J3' ? x : null; }, 'seat_j3 vào ghế');
      for (let lv = 1; lv <= 6; lv++) {
        await waitOpen();
        const dbg = await get('/api/admin/state');
        await sim('seat_j3', 'Ghế J3', dbg.debug.correct);
        await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === lv + 1 ? x : null; }, 'seat_j3 lên câu ' + (lv + 1));
      }
      await waitOpen();
      const dbg = await get('/api/admin/state');
      const marker = await cueMarker();
      await sim('seat_j3', 'Ghế J3', wrongOf(dbg.debug.correct, dbg.debug.removed));
      const cue = await findCue(marker, keys => keys.includes('mc/wrong'));
      check(cue.keys.every(k => !k.startsWith('mc/joke-wrong-')), `sai ở câu 7 → cue chỉ có mc/wrong, KHÔNG joke (thực tế: ${cue.keys.join(' + ')})`);
      await waitPhase('run_end');
    }

    // ============ (D) audio-done: mở 1 lần duy nhất + xác nhận ============
    {
      await post('/api/sim/hotseat', { uniqueId: 'seat_d', nickname: 'Ghế D' });
      await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.question && x.question.reading ? x : null; }, 'seat_d đang đọc câu 1');
      const dbg = await get('/api/admin/state');
      const qid = dbg.debug.questionId;
      const r1 = await post('/api/stage/audio-done', { qid });
      check(r1.opened === true, 'audio-done đúng qid lần 1 → {opened:true}');
      const r2 = await post('/api/stage/audio-done', { qid });
      check(r2.opened === false, 'audio-done POST lại lần 2 → {opened:false} (không mở lại)');
      const s = await get('/api/state');
      check(s.question && s.question.answersOpen === true, 'state sau POST trùng vẫn nguyên vẹn (cửa sổ đang mở)');
      const src = fs.readFileSync(path.join(APP, 'stage.js'), 'utf8');
      const mRetry = src.match(/DONE_MAX_ATTEMPTS\s*=\s*(\d+)/);
      check(!!mRetry && Number(mRetry[1]) >= 2 && src.includes('opened === true') && src.includes('DONE_RETRY_MS'),
        `stage.js có logic gửi lại audio-done tới khi server xác nhận (DONE_MAX_ATTEMPTS=${mRetry && mRetry[1]})`);
      await endRunByWrong('seat_d', 'Ghế D');
    }
  } catch (e) {
    failures++;
    console.log('NAME-JOKE-TEST: NGOẠI LỆ — ' + e.message);
    if (srvLog) console.log('--- log server ---\n' + srvLog.slice(-1500));
  } finally {
    if (cdp) cdp.close();
    if (chrome) { try { chrome.kill('SIGKILL'); } catch (_) {} }
    if (profile) { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {} }
    try { srv.kill('SIGKILL'); } catch (_) {}
    // dọn file dynamic do test sinh
    try {
      for (const f of fs.readdirSync(dynDir)) if (!dynBefore.has(f)) fs.unlinkSync(path.join(dynDir, f));
    } catch (_) {}
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
    if (hadDay) { try { fs.copyFileSync(dayFile + '.qabak', dayFile); fs.unlinkSync(dayFile + '.qabak'); } catch (_) {} }
    else { try { fs.unlinkSync(dayFile); } catch (_) {} }
  }

  // ============ (E) trần cửa sổ đọc dự phòng 25s (tiến trình con, env sạch) ============
  try {
    const unitFile = path.join(os.tmpdir(), 'tp-cap-unit.js');
    fs.writeFileSync(unitFile, `'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const Engine = require(${JSON.stringify(path.join(APP, 'game.js'))});
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-cap-data-'));
const e = new Engine(dataDir, ${JSON.stringify(path.join(APP, 'questions', 'bank.json'))});
e.durations = { capq: 38, shortq: 5 };
console.log(JSON.stringify({ cap: e.readingWindowMs('capq'), short: e.readingWindowMs('shortq') }));
`);
    const cleanEnv = { ...process.env };
    for (const k of Object.keys(cleanEnv)) if (k.startsWith('READING_')) delete cleanEnv[k];
    const out = execFileSync(process.execPath, [unitFile], { env: cleanEnv, encoding: 'utf8' });
    const r = JSON.parse(out.trim().split('\n').pop());
    check(r.cap === 25000, `clip 38s → cửa sổ dự phòng bị cắt ở trần 25.000ms (thực tế ${r.cap}ms)`);
    check(r.short === 6500, `clip 5s → cửa sổ = 5.000 + 1.500 đệm = 6.500ms, không bị trần ảnh hưởng (thực tế ${r.short}ms)`);
    try { fs.unlinkSync(unitFile); } catch (_) {}
  } catch (e) {
    failures++;
    console.log('NAME-JOKE-TEST: mục (E) lỗi — ' + e.message);
  }

  // ============ (F3) MUSIC_ENABLED=0 → state tắt nhạc ============
  try {
    const srv2 = spawn(process.execPath, [path.join(APP, 'server.js')], {
      env: { ...process.env, PORT: '3096', MUSIC_ENABLED: '0' }, stdio: 'ignore',
    });
    try {
      const s = await waitFor(async () => {
        const r = await fetch('http://localhost:3096/api/state');
        const j = await r.json();
        return j && j.game === 'trieu-phu-live' ? j : null;
      }, 'server MUSIC_ENABLED=0 boot', 15000);
      check(s.musicEnabled === false, 'MUSIC_ENABLED=0 → state.musicEnabled=false (stage không phát nhạc)');
    } finally { try { srv2.kill('SIGKILL'); } catch (_) {} }
  } catch (e) {
    failures++;
    console.log('NAME-JOKE-TEST: mục (F3) lỗi — ' + e.message);
  }

  console.log(failures === 0 ? 'NAME-JOKE-TEST PASS' : `NAME-JOKE-TEST FAIL (${failures} mục)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
