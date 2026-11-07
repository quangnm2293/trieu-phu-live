'use strict';
/**
 * AI LÀ TRIỆU PHÚ LIVE — server game (cổng 3021).
 * Nguồn sự kiện: (1) tiktok-live-feed ws://localhost:3010/events (chính),
 * (2) giả lập qua POST /api/sim, (3) relay cũ POST /api/relay/* (dự phòng).
 * Trang: / (sân khấu), /admin (giả lập + bot khán giả + quản trị ngân hàng).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const CFG = require('./config');
const Engine = require('./game');

const ROOT = __dirname;
const engine = new Engine(path.join(ROOT, 'data'), path.join(ROOT, CFG.BANK_PATH));

// ---------------- HTTP ----------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.mp3': 'audio/mpeg' };
function sendFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}
function readJson(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (_) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
function json(res, obj, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// ---------------- Bot khán giả (giả lập / demo / QA hình ảnh) ----------------
const BOT_NAMES = ['be_na', 'tuan_anh', 'meo_con', 'hong_nhung', 'kevin99', 'tra_xanh', 'bo_sua', 'nam_mo',
  'chi_pheo', 'luom_lua', 'su_tu_con', 'ga_rung', 'vit_bau', 'oc_tieu', 'dung_vip', 'an_nhien'];
const botCfg = { on: false, count: 12, skill: 0.55, delayMin: 500, delayMax: 8000 };
let botQuestionKey = null;
const botTimers = [];
function botIdentity(i) {
  const name = BOT_NAMES[i % BOT_NAMES.length];
  return { uniqueId: 'bot_' + name, nickname: name, avatarUrl: '' };
}
function clearBotTimers() { for (const t of botTimers) clearTimeout(t); botTimers.length = 0; }
function scheduleBots() {
  if (!botCfg.on) return;
  const dbg = engine.getDebugState();
  const st = engine.getState();
  if (!st.question || !dbg.debug || !dbg.debug.correct) return;
  const key = st.phase + ':' + dbg.debug.questionId + ':' + (st.question.level || 0);
  if (key === botQuestionKey) return; // vẫn câu cũ — giữ nguyên các timer đang chờ
  botQuestionKey = key;
  clearBotTimers(); // sang câu mới → hủy lịch trả lời của câu cũ
  const correct = dbg.debug.correct;
  const hotseatUid = dbg.debug.hotseatUid;
  const letters = ['A', 'B', 'C', 'D'];
  const removed = dbg.debug.removed || [];
  const pickAnswer = (skill) => {
    if (Math.random() < skill) return correct;
    const wrong = letters.filter(l => l !== correct && !removed.includes(l));
    return wrong[Math.floor(Math.random() * wrong.length)] || correct;
  };
  for (let i = 0; i < botCfg.count; i++) {
    const bot = botIdentity(i);
    if (Math.random() > 0.9) continue; // vài bot "đứng xem"
    const delay = botCfg.delayMin + Math.random() * (botCfg.delayMax - botCfg.delayMin);
    const isSeat = bot.uniqueId === hotseatUid;
    const t = setTimeout(() => {
      if (!botCfg.on) return;
      if (isSeat) {
        // bot giữ ghế: thỉnh thoảng dùng 50:50 trước khi trả lời câu khó
        const stNow = engine.getState();
        if (stNow.lifelines && stNow.lifelines.fifty && stNow.question && stNow.question.level >= 4 && Math.random() < 0.15) {
          engine.handleEvent({ ...bot, type: 'chat', text: '50' });
          setTimeout(() => engine.handleEvent({ ...bot, type: 'chat', text: pickAnswer(botCfg.skill) }), 700);
          return;
        }
      }
      engine.handleEvent({ ...bot, type: 'chat', text: pickAnswer(isSeat ? botCfg.skill : botCfg.skill * 0.95) });
      // thỉnh thoảng thả like / follow / share / quà nhỏ cho sân khấu sống động
      const roll = Math.random();
      if (roll < 0.18) engine.handleEvent({ ...bot, type: 'like', likeCount: 20 + Math.floor(Math.random() * 80) });
      else if (roll < 0.21) engine.handleEvent({ ...bot, type: 'follow' });
      else if (roll < 0.24) engine.handleEvent({ ...bot, type: 'share' });
      else if (roll < 0.27) engine.handleEvent({ ...bot, type: 'gift', giftName: 'Quà live', coins: [1, 5, 10, 25, 50, 99, 250][Math.floor(Math.random() * 7)], repeatEnd: true });
    }, delay);
    botTimers.push(t);
  }
}
setInterval(scheduleBots, 400);

// ---------------- Relay cũ (shape extension quét DOM) ----------------
function relayToEvent(kind, b) {
  const p = b.player || {};
  const base = { uniqueId: p.uniqueId || p.id, nickname: p.nickname || p.uniqueId, avatarUrl: p.avatarUrl || '' };
  if (kind === 'chat') return { ...base, type: 'chat', text: b.comment || '' };
  if (kind === 'gift') return { ...base, type: 'gift', giftName: b.giftName || 'Quà', coins: Number(b.diamonds) || 0, repeatEnd: true };
  if (kind === 'like') return { ...base, type: 'like', likeCount: Number(b.likeCount || b.count) || 1 };
  if (kind === 'follow') return { ...base, type: 'follow' };
  if (kind === 'share') return { ...base, type: 'share' };
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (p === '/' || p === '/stage') return sendFile(res, path.join(ROOT, 'stage.html'));
  if (p === '/stage.js') return sendFile(res, path.join(ROOT, 'stage.js'));
  if (p === '/stage.css') return sendFile(res, path.join(ROOT, 'stage.css'));
  if (p === '/admin') return sendFile(res, path.join(ROOT, 'admin.html'));
  if (p.startsWith('/audio/')) {
    const file = path.join(ROOT, 'audio', path.normalize(p.slice('/audio/'.length)));
    if (!file.startsWith(path.join(ROOT, 'audio'))) { res.writeHead(403); return res.end('forbidden'); }
    return sendFile(res, file);
  }
  if (p === '/api/state') return json(res, engine.getState());
  if (p === '/api/admin/state') return json(res, engine.getDebugState());
  if (p === '/api/admin/bank' && req.method === 'GET') return json(res, engine.bankCounts());
  if (p === '/api/admin/question' && req.method === 'POST') {
    const b = await readJson(req);
    return json(res, engine.addQuestion(b));
  }
  if (p === '/api/sim' && req.method === 'POST') {
    const b = await readJson(req);
    if (b && b.type) { engine.handleEvent(b); return json(res, { ok: true }); }
    return json(res, { ok: false, error: 'missing type' }, 400);
  }
  if (p === '/api/sim/phase' && req.method === 'POST') {
    const b = await readJson(req);
    engine.forcePhase(b.phase);
    return json(res, { ok: true, phase: engine.phase });
  }
  if (p === '/api/sim/hotseat' && req.method === 'POST') {
    const b = await readJson(req);
    if (!b.uniqueId) return json(res, { ok: false, error: 'missing uniqueId' }, 400);
    const okSeat = engine.forceHotseat({ uniqueId: b.uniqueId, nickname: b.nickname || b.uniqueId, avatarUrl: b.avatarUrl || '' });
    return json(res, { ok: okSeat });
  }
  if (p === '/api/sim/reset' && req.method === 'POST') {
    engine.resetSession();
    return json(res, { ok: true });
  }
  if (p === '/api/sim/bots' && req.method === 'POST') {
    const b = await readJson(req);
    if (typeof b.on === 'boolean') botCfg.on = b.on;
    if (Number.isFinite(b.count)) botCfg.count = Math.max(0, Math.min(40, b.count));
    if (Number.isFinite(b.skill)) botCfg.skill = Math.max(0, Math.min(1, b.skill));
    if (Number.isFinite(b.delayMin)) botCfg.delayMin = Math.max(0, b.delayMin);
    if (Number.isFinite(b.delayMax)) botCfg.delayMax = Math.max(botCfg.delayMin, b.delayMax);
    if (!botCfg.on) clearBotTimers();
    botQuestionKey = null;
    return json(res, { ok: true, bots: botCfg });
  }
  if (p.startsWith('/api/relay/') && req.method === 'POST') {
    if (!CFG.RELAY_ENABLED) return json(res, { ok: false, error: 'relay disabled' }, 403);
    const kind = p.split('/').pop();
    const b = await readJson(req);
    const ev = relayToEvent(kind, b);
    if (ev) engine.handleEvent(ev);
    return json(res, { ok: !!ev });
  }
  res.writeHead(404); res.end('not found');
});

// ---------------- WS cho stage/admin ----------------
const wss = new WebSocketServer({ server });
function broadcast() {
  if (!wss.clients.size) return;
  const msg = JSON.stringify(engine.getState());
  for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(msg);
}

// ---------------- Kết nối tiktok-live-feed ----------------
function connectFeed() {
  let ws;
  try { ws = new WebSocket(CFG.FEED_URL); } catch (_) { setTimeout(connectFeed, 3000); return; }
  ws.on('open', () => { engine.feedStatus = 'up'; console.log('[feed] đã nối', CFG.FEED_URL); });
  ws.on('message', raw => {
    try {
      const ev = JSON.parse(raw.toString());
      if (ev && ev.type) engine.handleEvent(ev);
    } catch (_) { /* gói không phải JSON thì bỏ */ }
  });
  const retry = () => { engine.feedStatus = 'down'; setTimeout(connectFeed, 3000); };
  ws.on('close', retry);
  ws.on('error', () => { try { ws.close(); } catch (_) {} });
}
connectFeed();

// ---------------- Vòng tick ----------------
let last = Date.now();
setInterval(() => {
  const now = Date.now();
  last = now;
  engine.tick(now);
  broadcast();
}, CFG.TICK_MS);

server.listen(CFG.PORT, () => {
  console.log('AI LÀ TRIỆU PHÚ LIVE — server chạy tại http://localhost:' + CFG.PORT + '  (stage: /  ·  admin: /admin)');
});
