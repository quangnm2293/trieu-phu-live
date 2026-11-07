'use strict';
/**
 * Kiểm tra đồng hồ đếm ngược của sân khấu (stage.js):
 * sân khấu tính remain = timer.endsAt - (Date.now() + serverOffset), serverOffset = serverNow - Date.now().
 * Test này xác thực các đầu vào của công thức đó từ server thật:
 *  1) endsAt CỐ ĐỊNH trong suốt 1 câu hỏi (server không "nạp lại" hạn chót).
 *  2) remainingMs giảm đúng bằng thời gian thực đã trôi (±250ms).
 *  3) endsAt - serverNow khớp remainingMs (sai số ≤ 60ms) → số giây stage tính ra là đúng.
 * Chạy: node test/timer-check.js
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 3123;
const BASE = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
function check(label, ok, extra = '') {
  console.log(`TIMER: ${label} ${ok ? 'OK' : 'FAIL ' + extra}`);
  if (!ok) failures++;
}
function req(method, p, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(BASE + p, { method, headers: { 'Content-Type': 'application/json' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (_) { resolve(d); } });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), FEED_URL: 'ws://127.0.0.1:9/events', QUESTION_TIME_MS: '9000', INTERMISSION_MS: '1200' },
    stdio: 'ignore',
  });
  try {
    // chờ server lên + ép ghế nóng để có câu hỏi đang mở
    let st = null;
    for (let i = 0; i < 30; i++) { try { st = await req('GET', '/api/state'); break; } catch (_) { await sleep(300); } }
    if (!st) throw new Error('server không lên');
    await req('POST', '/api/sim/hotseat', { uniqueId: 'timer_seat', nickname: 'Ghế Timer' });
    for (let i = 0; i < 20; i++) { st = await req('GET', '/api/state'); if (st.phase === 'question' && st.timer) break; await sleep(200); }
    if (!st.timer) throw new Error('không vào được pha question');

    const t0 = Date.now();
    const s1 = st;
    await sleep(1200);
    const s2 = await req('GET', '/api/state');
    const elapsed = Date.now() - t0;

    check('endsAt không đổi trong cùng 1 câu hỏi', s1.timer.endsAt === s2.timer.endsAt, `${s1.timer.endsAt} vs ${s2.timer.endsAt}`);
    const drop = s1.timer.remainingMs - s2.timer.remainingMs;
    check(`remainingMs giảm theo thời gian thực (giảm ${drop}ms / trôi ${elapsed}ms)`, Math.abs(drop - elapsed) <= 250);
    const formula = s2.timer.endsAt - s2.serverNow; // đúng công thức stage dùng (khi offset ≈ 0 nội bộ)
    check('endsAt - serverNow khớp remainingMs (công thức của stage)', Math.abs(formula - s2.timer.remainingMs) <= 60, `formula=${formula} remaining=${s2.timer.remainingMs}`);
    const stageSeconds = Math.ceil(Math.max(0, s2.timer.endsAt - (Date.now() + (s2.serverNow - Date.now()))) / 1000);
    check(`số giây stage hiển thị hợp lệ (=${stageSeconds}s, phải < 9 và > 0)`, stageSeconds > 0 && stageSeconds <= 9);
  } catch (e) {
    check('chạy test: ' + e.message, false);
  } finally {
    child.kill('SIGKILL');
  }
  console.log(failures ? 'TIMER FAIL' : 'TIMER PASS');
  process.exit(failures ? 1 : 0);
})();
