'use strict';
/**
 * AUDIO-SYNC TEST — kiểm chứng đồng bộ tiếng/hình của sân khấu bằng Chrome headless (CDP):
 *  (a) hai cue bắn liên tiếp (mc/hotseat-new rồi mc/level-1) đều được stage xử lý
 *      và PHÁT THEO ĐÚNG THỨ TỰ — không cue nào bị ghi đè mất như cơ chế snapshot cũ.
 *  (b) đang phát dở clip đọc câu hỏi (q/…) mà sân khấu vào intermission thì clip
 *      bị dừng trong vòng ~1 giây (cue chuyển pha ưu tiên + dừng theo pha).
 * Chỉ lái qua HTTP /api/sim + đọc hook window.__tpAudio trên trang sân khấu thật.
 * Chạy: node test/audio-sync-test.js → in "AUDIO-TEST:" + "AUDIO-TEST PASS"/"FAIL".
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');

const APP = path.join(__dirname, '..');
const PORT = 3098;
const BASE = `http://localhost:${PORT}`;
const CDP_PORT = 9339;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function check(cond, label) {
  console.log(`AUDIO-TEST: ${label} ${cond ? 'OK' : 'FAIL'}`);
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
const wrongOf = correct => ['A', 'B', 'C', 'D'].find(l => l !== correct);

function findChrome() {
  const roots = [
    path.join(os.homedir(), '.cache/puppeteer/chrome'),
    path.join(os.homedir(), '.cache/puppeteer/chrome-headless-shell'),
  ];
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

// ---------- CDP tối thiểu qua ws ----------
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
      send(method, params = {}) {
        return new Promise(res => { const mid = ++id; pending.set(mid, { res }); ws.send(JSON.stringify({ id: mid, method, params })); });
      },
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

  const chromeBin = findChrome();
  if (!chromeBin) { console.log('AUDIO-TEST: không tìm thấy Chrome headless — FAIL'); process.exit(1); }

  const env = {
    ...process.env, PORT: String(PORT),
    INTERMISSION_MS: '1200', QUALIFIER_TIME_MS: '6000', QUALIFIER_MIN_MS: '1200',
    REVEAL_TIME_MS: '1500', LOCKED_MS: '300', QUESTION_TIME_MS: '20000',
    POLL_TIME_MS: '3000', RUN_END_MS: '1200',
    LIKE_METER_TARGET: '50', LIKE_TIME_BONUS_MS: '10000',
    READING_TEST_MS: '600', // cửa sổ đọc ngắn tất định — đáp án vòng loại phải chờ cửa sổ mở
  };
  const srv = spawn(process.execPath, [path.join(APP, 'server.js')], { env, stdio: 'pipe' });
  let srvLog = '';
  srv.stdout.on('data', c => { srvLog += c; });
  srv.stderr.on('data', c => { srvLog += c; });

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-chrome-'));
  const chrome = spawn(chromeBin, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${CDP_PORT}`, '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`, BASE + '/?obs=1',
  ], { stdio: 'ignore' });

  let cdp = null;
  try {
    await waitFor(async () => { const s = await get('/api/state'); return s && s.game === 'trieu-phu-live' ? s : null; }, 'server boot', 15000);

    // chờ target trang sân khấu xuất hiện trên CDP
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
    await waitFor(async () => (await ev('!!(window.__tpAudio && window.__tpAudio.synced)')) === true, 'stage nối WS + đồng bộ mốc cue', 20000);
    check(true, 'sân khấu tải thật trên Chrome headless, engine tiếng đã đồng bộ mốc cue');

    // ============ (a) hai cue liên tiếp: hotseat-new → level-1, đúng thứ tự ============
    await waitFor(async () => { const s = await get('/api/state'); return s.phase === 'qualifier' ? s : null; }, 'vào vòng loại');
    // Chờ cửa sổ trả lời MỞ (hết pha đọc của MC) mới gửi đáp án — gửi trong lúc đọc bị bỏ qua
    await waitFor(async () => { const s = await get('/api/state'); return s.question && s.question.answersOpen ? s : null; }, 'cửa sổ vòng loại mở');
    const dbg = await get('/api/admin/state');
    const qc = dbg.debug.correct;
    sim('user_c', 'Bạn C', wrongOf(qc));
    await sleep(250); sim('user_a', 'Bạn A', qc);
    await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat ? x : null; }, 'vào câu 1 ghế nóng');
    const played = await waitFor(async () => {
      const p = await ev('window.__tpAudio.played.slice()');
      return (p.includes('mc/hotseat-new') && p.includes('mc/level-1')) ? p : null;
    }, 'cả hai cue hotseat-new + level-1 đều được phát', 30000);
    console.log('AUDIO-TEST: thứ tự đã phát: ' + played.join(' → '));
    check(played.indexOf('mc/hotseat-new') < played.indexOf('mc/level-1'),
      'hai cue bắn liên tiếp đều tới stage và phát ĐÚNG THỨ TỰ (hotseat-new trước level-1)');

    // ============ (b) vào intermission → clip q/ đang phát dừng ≤ ~1s ============
    const qKey = await waitFor(async () => {
      const cur = await ev('window.__tpAudio.current');
      return (typeof cur === 'string' && cur.startsWith('q/')) ? cur : null;
    }, 'clip đọc câu hỏi đang phát', 30000);
    console.log(`AUDIO-TEST: đang phát ${qKey} — ép chuyển intermission…`);
    const t0 = Date.now();
    await post('/api/sim/phase', { phase: 'intermission' });
    const stopMs = await waitFor(async () => {
      const cur = await ev('window.__tpAudio.current');
      return cur !== qKey ? Date.now() - t0 : null;
    }, 'clip q/ dừng sau khi vào intermission', 5000);
    console.log(`AUDIO-TEST: clip dừng sau ${stopMs}ms, clip hiện tại: ${await ev('window.__tpAudio.current')}`);
    check(stopMs <= 1000, `vào intermission → clip đọc câu hỏi dừng trong ~1s (thực tế ${stopMs}ms)`);
  } catch (e) {
    failures++;
    console.log('AUDIO-TEST: NGOẠI LỆ — ' + e.message);
    if (srvLog) console.log('--- log server ---\n' + srvLog.slice(-1200));
  } finally {
    if (cdp) cdp.close();
    try { chrome.kill('SIGKILL'); } catch (_) {}
    try { srv.kill('SIGKILL'); } catch (_) {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
    if (hadDay) { try { fs.copyFileSync(dayFile + '.qabak', dayFile); fs.unlinkSync(dayFile + '.qabak'); } catch (_) {} }
    else { try { fs.unlinkSync(dayFile); } catch (_) {} }
  }
  console.log(failures === 0 ? 'AUDIO-TEST PASS' : `AUDIO-TEST FAIL (${failures} mục)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
