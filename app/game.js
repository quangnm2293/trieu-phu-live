'use strict';
/**
 * AI LÀ TRIỆU PHÚ LIVE — engine game (máy chủ giữ đáp án + bấm giờ, mục 10).
 * Vòng đời buổi live (mục 9): INTERMISSION → QUALIFIER → QUALIFIER_REVEAL
 *   → (có người thắng) lượt ghế nóng: QUESTION → LOCKED → REVEAL → QUESTION…
 *   → RUN_END → INTERMISSION → QUALIFIER … (mọi cách kết thúc lượt đều quay về vòng loại)
 */
const fs = require('fs');
const path = require('path');
const CFG = require('./config');

const LETTERS = ['A', 'B', 'C', 'D'];

function stripAccents(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}
/** Đáp án = token đầu tiên là đúng 1 chữ cái A–D (chấp nhận "A", "a", "A.", "A)"). */
function parseAnswer(text) {
  const t = String(text || '').trim();
  const m = t.match(/^([A-Da-d])(?:[.)\]:])?(?:\s|$)/);
  return m ? m[1].toUpperCase() : null;
}
/** Từ khóa trợ giúp / dừng — chuẩn hóa không dấu, không phân biệt hoa thường. */
function parseKeyword(text) {
  const raw = String(text || '').trim();
  if (raw === '50' || raw === '5050' || raw === '50:50') return 'fifty';
  const n = stripAccents(raw).toUpperCase().replace(/\s+/g, ' ');
  if (n === 'DUNG') return 'stop';
  if (n === 'KHAN GIA' || n === 'HOI KHAN GIA' || n === 'KG') return 'poll';
  if (n === 'DOI' || n === 'DOI CAU') return 'swap';
  return null;
}
function fmtPoints(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

class Engine {
  constructor(dataDir, bankPath) {
    this.dataDir = dataDir;
    this.bankPath = bankPath;
    this.bank = [];
    this.loadBank();
    this.users = new Map(); // uniqueId -> {uniqueId,nickname,avatarUrl,points,correctCount,followClaimed,lastShareAt}
    this.support = new Map(); // uniqueId -> {nickname,avatarUrl,points}
    this.usedIds = new Set();
    this.recentUsed = [];
    this.loadDay();

    this.feedStatus = 'down';
    this.viewerCount = 0;
    this.phase = 'boot';
    this.phaseEndsAt = 0;
    this.ctx = null; // ngữ cảnh câu hỏi đang mở
    this.run = null; // lượt ghế nóng đang chạy
    this.pendingHotseat = null;
    this.cooldownUid = null; // người giữ ghế lượt trước — không thắng câu loại kế tiếp
    this.qualifierFails = 0;
    this.qualifierCount = 0;
    this.lastReveal = null;
    this.lastQualifier = null;
    this.runSummary = null;
    this.lastPoll = null;
    this.likeMeter = 0;
    this.likeBonusPending = false;
    this.announcements = [];
    this.announceSeq = 0;
    this.audioSeq = 0;
    this.audioCue = null; // {seq, keys:[...]} — cue mới nhất (giữ tương thích ngược)
    this.cueLog = []; // nhật ký cue {seq, keys, ts} — state luôn kèm 5 cue gần nhất để stage không bỏ lỡ cue nào
    this.fastestRecord = null; // {ms, nickname}
    this.giftPending = new Map();
    this.bigGift = null;
    this.dirty = false;
    this.lastSave = 0;
    this.startIntermission(Date.now(), true);
  }

  // ---------- dữ liệu ----------
  loadBank() {
    try { this.bank = JSON.parse(fs.readFileSync(this.bankPath, 'utf8')); }
    catch (e) { console.error('[bank] không đọc được', this.bankPath, e.message); this.bank = []; }
  }
  dayFile() {
    const d = new Date();
    const name = `scores-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
    return path.join(this.dataDir, name);
  }
  loadDay() {
    try {
      const j = JSON.parse(fs.readFileSync(this.dayFile(), 'utf8'));
      for (const [uid, u] of Object.entries(j.audience || {})) this.users.set(uid, { uniqueId: uid, followClaimed: false, lastShareAt: 0, ...u });
      for (const [uid, s] of Object.entries(j.support || {})) this.support.set(uid, s);
      this.usedIds = new Set(j.usedIds || []);
      this.recentUsed = [...this.usedIds].slice(-20);
    } catch (_) { /* buổi đầu / file chưa có */ }
  }
  save() {
    this.dirty = false; this.lastSave = Date.now();
    const j = { date: new Date().toISOString(), audience: {}, support: {}, usedIds: [...this.usedIds] };
    for (const [uid, u] of this.users) j.audience[uid] = { nickname: u.nickname, avatarUrl: u.avatarUrl, points: u.points, correctCount: u.correctCount };
    for (const [uid, s] of this.support) j.support[uid] = s;
    try {
      fs.mkdirSync(this.dataDir, { recursive: true });
      const tmp = this.dayFile() + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(j));
      fs.renameSync(tmp, this.dayFile());
    } catch (e) { console.error('[save]', e.message); }
  }
  markDirty() { this.dirty = true; }

  ensureUser(ev) {
    const uid = ev.uniqueId || ev.nickname;
    if (!uid) return null;
    let u = this.users.get(uid);
    if (!u) {
      u = { uniqueId: uid, nickname: ev.nickname || uid, avatarUrl: ev.avatarUrl || '', points: 0, correctCount: 0, followClaimed: false, lastShareAt: 0 };
      this.users.set(uid, u);
    } else {
      if (ev.nickname) u.nickname = ev.nickname;
      if (ev.avatarUrl) u.avatarUrl = ev.avatarUrl;
    }
    return u;
  }

  // ---------- âm thanh / thông báo ----------
  cue(keys) {
    if (!keys || !keys.length) return;
    this.audioSeq++;
    this.audioCue = { seq: this.audioSeq, keys: Array.isArray(keys) ? keys : [keys], ts: Date.now() };
    // Ghi vào nhật ký (giữ tối đa 30 cue): state phát kèm 5 cue gần nhất nên 2 cue
    // bắn liên tiếp giữa hai lần đẩy state không còn ghi đè mất nhau như trước.
    this.cueLog.push(this.audioCue);
    if (this.cueLog.length > 30) this.cueLog.shift();
  }
  announce(kind, text) {
    this.announceSeq++;
    this.announcements.push({ id: this.announceSeq, kind, text, ts: Date.now() });
    if (this.announcements.length > 6) this.announcements.shift();
  }

  // ---------- rút câu hỏi ----------
  drawFrom(pool) {
    let cand = pool.filter(q => !this.usedIds.has(q.id));
    if (!cand.length) cand = pool.filter(q => !this.recentUsed.includes(q.id));
    if (!cand.length) cand = pool;
    if (!cand.length) return null;
    const q = cand[Math.floor(Math.random() * cand.length)];
    this.usedIds.add(q.id);
    this.recentUsed.push(q.id);
    if (this.recentUsed.length > 20) this.recentUsed.shift();
    this.markDirty();
    return q;
  }
  drawLevel(level) { return this.drawFrom(this.bank.filter(q => q.level === level && !q.qualifierOnly)); }
  drawQualifier() {
    const pool = this.bank.filter(q => q.qualifier === true);
    return this.drawFrom(pool.length ? pool : this.bank.filter(q => q.level >= 3 && q.level <= 6));
  }

  // ---------- các pha ----------
  startIntermission(now, first = false) {
    this.phase = 'intermission';
    this.phaseEndsAt = now + CFG.INTERMISSION_MS;
    this.ctx = null; this.run = null;
    if (first) this.cue(['mc/welcome']);
    // Cue chuyển pha ƯU TIÊN: nhiệm vụ chính là NGẮT ngay clip đọc câu hỏi còn đang
    // phát dở khi màn hình chuyển sang bảng vinh danh (trước đây pha này không có cue
    // nào nên clip cũ cứ phát tràn qua màn nghỉ).
    else this.cue(['mc/next-qualifier']);
  }
  startQualifier(now) {
    const q = this.drawQualifier();
    if (!q) { this.startIntermission(now); return; }
    this.qualifierCount++;
    this.phase = 'qualifier';
    this.ctx = this.newCtx(q, 'qualifier', 0);
    this.ctx.deadline = now + CFG.QUALIFIER_TIME_MS;
    this.phaseEndsAt = this.ctx.deadline;
    const keys = [];
    if (this.qualifierCount === 1) keys.push('mc/qualifier-intro');
    else if (this.lastQualifier && !this.lastQualifier.hadCorrect) keys.push('mc/qualifier-again');
    else keys.push('mc/next-qualifier');
    keys.push('q/' + q.id);
    this.cue(keys);
  }
  newCtx(q, kind, level) {
    return {
      qid: q.id, kind, level, category: q.category, text: q.question,
      options: { ...q.options }, correct: q.correct,
      openedAt: Date.now(), deadline: 0,
      answers: new Map(), // uid -> {letter, elapsedMs}
      removed: [], hotseatAnswer: null, hotseatResult: null,
      poll: null, bonusUsed: false, scored: false,
    };
  }
  closeQualifier(now) {
    const ctx = this.ctx;
    const res = this.scoreCtx(ctx, null); // câu loại: mọi người đều là "khán giả"
    const winnerEntry = res.correctSorted.find(e => e.uid !== this.cooldownUid);
    this.lastQualifier = {
      hadCorrect: res.correctSorted.length > 0,
      winner: winnerEntry ? this.publicUser(winnerEntry.uid) : null,
      top5: res.top5, correctCount: res.correctCount, totalAnswers: res.totalAnswers, pctCorrect: res.pctCorrect,
      correctLetter: ctx.correct, questionText: ctx.text,
    };
    if (winnerEntry) {
      this.pendingHotseat = winnerEntry.uid;
      this.qualifierFails = 0;
      const w = this.users.get(winnerEntry.uid);
      this.announce('hotseat', `👑 ${w ? w.nickname : winnerEntry.uid} giành ghế nóng với đáp án đúng sau ${fmtMs(winnerEntry.elapsedMs)}!`);
      this.cue(['mc/hotseat-new']);
    } else {
      this.pendingHotseat = null;
      this.qualifierFails++;
      // Không ai thắng vòng loại: cue ƯU TIÊN để ngắt clip câu loại đang phát dở
      // ngay tại màn công bố (khi có người thắng thì mc/hotseat-new đã làm việc này).
      this.cue(['mc/qualifier-again']);
    }
    this.phase = 'qualifier_reveal';
    this.phaseEndsAt = now + CFG.REVEAL_TIME_MS;
  }
  startRun(now, uid) {
    const u = this.users.get(uid);
    if (!u) { this.startQualifier(now); return; }
    this.run = {
      uid, level: 1, lifelines: { fifty: true, poll: true, swap: true },
      runAudience: new Map(), timeouts: 0,
    };
    this.cooldownUid = null; // ghế đã có chủ; cooldown áp dụng khi lượt này kết thúc
    this.startQuestion(now, 1);
  }
  startQuestion(now, level) {
    const q = this.drawLevel(level);
    if (!q) { this.endRun(now, 'wrong', this.milestonePoints(level - 1)); return; }
    this.run.level = level;
    this.ctx = this.newCtx(q, 'ladder', level);
    let dur = CFG.QUESTION_TIME_MS;
    // Thanh Nhiệt huyết đã đầy từ trước → cộng giờ ngay khi mở câu (tối đa 1 lần/câu)
    if (this.likeMeter >= CFG.LIKE_METER_TARGET) {
      dur += CFG.LIKE_TIME_BONUS_MS;
      this.likeMeter = 0;
      this.ctx.bonusUsed = true;
      this.announce('lifeline', `🔥 Thanh Nhiệt huyết đầy — ghế nóng được +${Math.round(CFG.LIKE_TIME_BONUS_MS / 1000)} giây cho câu này!`);
    }
    this.ctx.deadline = now + dur;
    this.phase = 'question';
    this.phaseEndsAt = this.ctx.deadline;
    this.cue([`mc/level-${level}`, 'q/' + q.id]);
  }
  milestonePoints(completedLevels) {
    if (completedLevels >= 10) return CFG.LADDER[9];
    if (completedLevels >= 5) return CFG.LADDER[4];
    return 0;
  }
  endRun(now, result, pointsKept) {
    const run = this.run;
    const u = run ? this.users.get(run.uid) : null;
    let mvp = null;
    if (run) {
      for (const [uid, pts] of run.runAudience) {
        if (!mvp || pts > mvp.points) { const mu = this.users.get(uid); mvp = { uid, nickname: mu ? mu.nickname : uid, avatarUrl: mu ? mu.avatarUrl : '', points: pts }; }
      }
    }
    this.runSummary = {
      nickname: u ? u.nickname : '', avatarUrl: u ? u.avatarUrl : '',
      result, reachedLevel: run ? run.level - (result === 'champion' ? 0 : 1) : 0,
      pointsKept, runMVP: mvp,
    };
    if (run) this.cooldownUid = run.uid;
    if (result === 'walkaway') this.cue(['mc/walkaway']);
    // Sai / hết giờ: trước đây kết thúc lượt KHÔNG có cue nào → clip câu hỏi phát tràn
    // qua màn tổng kết. Cue mc/run-end ƯU TIÊN ngắt ngay. (Walkaway dùng câu riêng ở
    // trên; quán quân đã có mc/champion ở màn công bố đáp án.)
    else if (result === 'wrong' || result === 'timeout') this.cue(['mc/run-end']);
    if (result === 'champion') this.announce('champion', `🏆 QUÁN QUÂN! ${u ? u.nickname : ''} chinh phục 150.000.000 điểm!`);
    this.run = null; this.ctx = null;
    this.phase = 'run_end';
    this.phaseEndsAt = now + CFG.RUN_END_MS;
    this.markDirty(); this.save();
  }

  // ---------- chấm điểm khán giả cho 1 câu ----------
  scoreCtx(ctx, excludeUid) {
    const correctSorted = [];
    let totalAnswers = 0;
    for (const [uid, a] of ctx.answers) {
      if (uid === excludeUid) continue;
      totalAnswers++;
      if (a.letter === ctx.correct) correctSorted.push({ uid, elapsedMs: a.elapsedMs });
    }
    correctSorted.sort((x, y) => x.elapsedMs - y.elapsedMs);
    const top5 = correctSorted.slice(0, 5).map((e, i) => {
      const u = this.users.get(e.uid);
      return { uid: e.uid, nickname: u ? u.nickname : e.uid, avatarUrl: u ? u.avatarUrl : '', elapsedMs: e.elapsedMs, bonus: CFG.AUDIENCE_SPEED_BONUS[i] || 0 };
    });
    if (!ctx.scored) {
      ctx.scored = true;
      for (const e of correctSorted) {
        const u = this.users.get(e.uid);
        if (!u) continue;
        u.points += CFG.AUDIENCE_CORRECT_POINTS;
        u.correctCount++;
        this.addRunPoints(e.uid, CFG.AUDIENCE_CORRECT_POINTS);
      }
      for (const t of top5) {
        const u = this.users.get(t.uid);
        if (!u) continue;
        u.points += t.bonus;
        this.addRunPoints(t.uid, t.bonus);
      }
      if (correctSorted.length) {
        const fastest = correctSorted[0];
        if (!this.fastestRecord || fastest.elapsedMs < this.fastestRecord.ms) {
          const u = this.users.get(fastest.uid);
          const beaten = this.fastestRecord;
          this.fastestRecord = { ms: fastest.elapsedMs, nickname: u ? u.nickname : fastest.uid };
          if (beaten) this.announce('record', `⚡ Kỷ lục tốc độ mới: ${this.fastestRecord.nickname} trả lời đúng sau ${fmtMs(fastest.elapsedMs)}!`);
        }
      }
      this.markDirty();
    }
    return {
      top5, correctCount: correctSorted.length, totalAnswers,
      pctCorrect: totalAnswers ? Math.round((correctSorted.length / totalAnswers) * 100) : 0,
      correctSorted,
    };
  }
  addRunPoints(uid, pts) {
    if (!this.run) return;
    this.run.runAudience.set(uid, (this.run.runAudience.get(uid) || 0) + pts);
  }
  publicUser(uid) {
    const u = this.users.get(uid);
    return u ? { uid, nickname: u.nickname, avatarUrl: u.avatarUrl } : { uid, nickname: uid, avatarUrl: '' };
  }

  // ---------- trợ giúp ----------
  useFifty(now) {
    const ctx = this.ctx, run = this.run;
    if (!run || !run.lifelines.fifty || ctx.hotseatAnswer) return;
    run.lifelines.fifty = false;
    const wrong = LETTERS.filter(l => l !== ctx.correct);
    // xáo trộn, lấy 2 đáp án sai để loại
    for (let i = wrong.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[wrong[i], wrong[j]] = [wrong[j], wrong[i]]; }
    ctx.removed = wrong.slice(0, 2);
    this.announce('lifeline', '🎁 Ghế nóng dùng trợ giúp 50:50!');
    this.cue(['mc/lifeline-5050']);
  }
  useSwap(now) {
    const ctx = this.ctx, run = this.run;
    if (!run || !run.lifelines.swap || ctx.hotseatAnswer) return;
    run.lifelines.swap = false;
    const q = this.drawLevel(ctx.level);
    this.announce('lifeline', '🔄 Ghế nóng đổi câu hỏi!');
    if (!q) return;
    const fresh = this.newCtx(q, 'ladder', ctx.level);
    fresh.deadline = now + CFG.QUESTION_TIME_MS;
    this.ctx = fresh;
    this.phaseEndsAt = fresh.deadline;
    this.lastPoll = null;
    this.cue(['mc/lifeline-swap', 'q/' + q.id]);
  }
  usePoll(now) {
    const ctx = this.ctx, run = this.run;
    if (!run || !run.lifelines.poll || ctx.hotseatAnswer || ctx.poll) return;
    run.lifelines.poll = false;
    ctx.poll = { votes: new Map(), endsAt: now + CFG.POLL_TIME_MS, frozenRemaining: Math.max(0, ctx.deadline - now) };
    this.phaseEndsAt = ctx.poll.endsAt;
    this.announce('lifeline', '🗳️ Ghế nóng hỏi ý kiến khán giả — cả phòng comment đáp án!');
    this.cue(['mc/lifeline-poll']);
  }
  endPoll(now) {
    const ctx = this.ctx;
    if (!ctx || !ctx.poll) return;
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    for (const letter of ctx.poll.votes.values()) counts[letter]++;
    const total = ctx.poll.votes.size;
    const percents = {};
    for (const l of LETTERS) percents[l] = total ? Math.round((counts[l] / total) * 100) : 0;
    this.lastPoll = { percents, total, at: now };
    ctx.deadline = now + ctx.poll.frozenRemaining;
    ctx.poll = null;
    this.phaseEndsAt = ctx.deadline;
  }

  // ---------- chốt đáp án ghế nóng / công bố ----------
  lockHotseat(now, letter) {
    const ctx = this.ctx;
    ctx.hotseatAnswer = letter;
    this.phase = 'locked';
    this.phaseEndsAt = now + CFG.LOCKED_MS;
    this.cue(['mc/locked']);
  }
  doReveal(now) {
    const ctx = this.ctx, run = this.run;
    const correct = ctx.hotseatAnswer === ctx.correct;
    ctx.hotseatResult = ctx.hotseatAnswer === null ? 'timeout' : (correct ? 'correct' : 'wrong');
    const res = this.scoreCtx(ctx, run ? run.uid : null);
    this.lastReveal = {
      level: ctx.level, correctLetter: ctx.correct, hotseatLetter: ctx.hotseatAnswer,
      hotseatResult: ctx.hotseatResult, top5: res.top5,
      correctCount: res.correctCount, totalAnswers: res.totalAnswers, pctCorrect: res.pctCorrect,
      questionText: ctx.text,
    };
    if (correct) {
      const keys = ['mc/correct'];
      if (ctx.level === 5) { keys.push('mc/milestone5'); this.announce('milestone', '★ ĐÃ CHẠM MỐC AN TOÀN 2.000.000 ĐIỂM!'); }
      if (ctx.level === 10) { keys.push('mc/milestone10'); this.announce('milestone', '★ ĐÃ CHẠM MỐC AN TOÀN 22.000.000 ĐIỂM!'); }
      if (ctx.level === 15) keys.push('mc/champion');
      this.cue(keys);
    } else {
      this.cue(['mc/wrong']);
    }
    this.phase = 'reveal';
    this.phaseEndsAt = now + CFG.REVEAL_TIME_MS;
  }

  // ---------- sự kiện ----------
  handleEvent(ev) {
    if (!ev || !ev.type) return;
    const now = Date.now();
    const user = ev.uniqueId || ev.nickname ? this.ensureUser(ev) : null;
    switch (ev.type) {
      case 'roomUser':
        if (Number.isFinite(ev.viewerCount)) this.viewerCount = ev.viewerCount;
        return;
      case 'like': {
        const n = Math.max(0, Number(ev.likeCount) || 1);
        this.likeMeter = Math.min(CFG.LIKE_METER_TARGET, this.likeMeter + n);
        if (this.phase === 'question' && this.ctx && !this.ctx.bonusUsed && this.likeMeter >= CFG.LIKE_METER_TARGET) {
          this.ctx.deadline += CFG.LIKE_TIME_BONUS_MS;
          this.phaseEndsAt = this.ctx.deadline;
          this.likeMeter = 0;
          this.ctx.bonusUsed = true;
          this.announce('lifeline', `🔥 Thanh Nhiệt huyết đầy — ghế nóng được +${Math.round(CFG.LIKE_TIME_BONUS_MS / 1000)} giây!`);
        }
        return;
      }
      case 'follow': {
        if (user && !user.followClaimed) {
          user.followClaimed = true;
          user.points += CFG.FOLLOW_POINTS;
          this.addRunPoints(user.uniqueId, CFG.FOLLOW_POINTS);
          this.announce('follow', `⭐ ${user.nickname} vừa follow kênh — +${CFG.FOLLOW_POINTS} điểm khán giả!`);
          this.markDirty();
        }
        return;
      }
      case 'share': {
        if (user && now - (user.lastShareAt || 0) >= CFG.SHARE_COOLDOWN_MS) {
          user.lastShareAt = now;
          user.points += CFG.SHARE_POINTS;
          this.addRunPoints(user.uniqueId, CFG.SHARE_POINTS);
          this.markDirty();
        }
        return;
      }
      case 'gift': {
        if (!user) return;
        const coins = Math.max(0, Number(ev.coins) || 0);
        if (ev.repeatEnd === false) {
          this.giftPending.set(user.uniqueId, (this.giftPending.get(user.uniqueId) || 0) + coins);
          return;
        }
        const total = (this.giftPending.get(user.uniqueId) || 0) + coins;
        this.giftPending.delete(user.uniqueId);
        if (total <= 0) return;
        const s = this.support.get(user.uniqueId) || { nickname: user.nickname, avatarUrl: user.avatarUrl, points: 0 };
        s.nickname = user.nickname; s.avatarUrl = user.avatarUrl;
        s.points += total;
        this.support.set(user.uniqueId, s);
        if (total >= CFG.BIG_GIFT_COINS) {
          this.bigGift = { nickname: user.nickname, avatarUrl: user.avatarUrl, coins: total, ts: now };
          this.announce('gift', `🎆 ${user.nickname} tặng quà lớn ${fmtPoints(total)} coin — cảm ơn bạn đã ủng hộ kênh!`);
        }
        this.markDirty();
        return;
      }
      case 'chat':
        if (user) this.handleChat(now, user, String(ev.text || ''));
        return;
      default:
        return;
    }
  }

  handleChat(now, user, text) {
    const ctx = this.ctx;
    const isHotseat = this.run && user.uniqueId === this.run.uid;

    // Người ghế nóng trong lúc câu hỏi mở: từ khóa trợ giúp / DỪNG / đáp án
    // (khi phiếu khán giả đang mở thì ghế nóng phải chờ kết quả — bỏ qua chat)
    if (this.phase === 'question' && ctx && ctx.kind === 'ladder' && isHotseat && !ctx.hotseatAnswer && !ctx.poll) {
      const kw = parseKeyword(text);
      if (kw === 'stop') { this.endRun(now, 'walkaway', ctx.level > 1 ? CFG.LADDER[ctx.level - 2] : 0); return; }
      if (kw === 'fifty') { this.useFifty(now); return; }
      if (kw === 'poll') { this.usePoll(now); return; }
      if (kw === 'swap') { this.useSwap(now); return; }
      const letter = parseAnswer(text);
      if (letter && !ctx.removed.includes(letter)) { this.lockHotseat(now, letter); return; }
      return; // comment thường của ghế nóng: bỏ qua
    }

    // Phiếu hỏi khán giả đang mở: ghi phiếu (và khóa làm đáp án khán giả nếu chưa trả lời)
    if (this.phase === 'question' && ctx && ctx.poll && !isHotseat) {
      const letter = parseAnswer(text);
      if (!letter || ctx.removed.includes(letter)) return;
      if (!ctx.poll.votes.has(user.uniqueId)) ctx.poll.votes.set(user.uniqueId, letter);
      if (!ctx.answers.has(user.uniqueId)) ctx.answers.set(user.uniqueId, { letter, elapsedMs: now - ctx.openedAt });
      return;
    }

    // Trả lời câu hỏi (loại hoặc ghế nóng) — đáp án hợp lệ đầu tiên bị khóa
    if ((this.phase === 'qualifier' || this.phase === 'question') && ctx) {
      if (ctx.kind === 'ladder' && isHotseat) return; // ghế nóng đã xử lý ở trên (hoặc đã chốt)
      const letter = parseAnswer(text);
      if (!letter || ctx.removed.includes(letter)) return;
      if (!ctx.answers.has(user.uniqueId)) ctx.answers.set(user.uniqueId, { letter, elapsedMs: now - ctx.openedAt });
    }
  }

  // ---------- vòng tick ----------
  tick(now) {
    if (this.dirty && now - this.lastSave > 10000) this.save();
    switch (this.phase) {
      case 'intermission':
        if (now >= this.phaseEndsAt) this.startQualifier(now);
        break;
      case 'qualifier': {
        const ctx = this.ctx;
        if (!ctx) { this.startQualifier(now); break; }
        const elapsed = now - ctx.openedAt;
        let hasCorrect = false;
        for (const a of ctx.answers.values()) if (a.letter === ctx.correct) { hasCorrect = true; break; }
        if ((hasCorrect && elapsed >= CFG.QUALIFIER_MIN_MS) || elapsed >= CFG.QUALIFIER_TIME_MS) this.closeQualifier(now);
        break;
      }
      case 'qualifier_reveal':
        if (now >= this.phaseEndsAt) {
          if (this.pendingHotseat) { const uid = this.pendingHotseat; this.pendingHotseat = null; this.startRun(now, uid); }
          else if (this.qualifierFails >= CFG.QUALIFIER_MAX_FAILS) { this.qualifierFails = 0; this.startIntermission(now); }
          else this.startQualifier(now);
        }
        break;
      case 'question': {
        const ctx = this.ctx;
        if (!ctx) break;
        if (ctx.poll) { if (now >= ctx.poll.endsAt) this.endPoll(now); break; }
        if (now >= ctx.deadline) {
          // hết giờ = sai (ghế nóng không chốt đáp án)
          ctx.hotseatAnswer = null;
          if (this.run) this.run.timeouts++;
          this.doReveal(now);
        }
        break;
      }
      case 'locked':
        if (now >= this.phaseEndsAt) this.doReveal(now);
        break;
      case 'reveal':
        if (now >= this.phaseEndsAt) {
          const ctx = this.ctx, run = this.run;
          if (!ctx || !run) { this.startIntermission(now); break; }
          if (ctx.hotseatResult === 'correct') {
            if (ctx.level >= 15) this.endRun(now, 'champion', CFG.LADDER[14]);
            else this.startQuestion(now, ctx.level + 1);
          } else {
            this.endRun(now, ctx.hotseatResult === 'timeout' ? 'timeout' : 'wrong', this.milestonePoints(ctx.level - 1));
          }
        }
        break;
      case 'run_end':
        if (now >= this.phaseEndsAt) this.startIntermission(now);
        break;
      default:
        this.startIntermission(now);
    }
  }

  // ---------- điều khiển từ admin / QA ----------
  forcePhase(name) {
    const now = Date.now();
    if (name === 'qualifier') { this.run = null; this.startQualifier(now); }
    if (name === 'intermission') this.startIntermission(now);
  }
  forceHotseat(u) {
    const user = this.ensureUser({ uniqueId: u.uniqueId, nickname: u.nickname, avatarUrl: u.avatarUrl || '' });
    if (!user) return false;
    this.pendingHotseat = null;
    this.startRun(Date.now(), user.uniqueId);
    return true;
  }
  resetSession() {
    for (const u of this.users.values()) { u.points = 0; u.correctCount = 0; u.followClaimed = false; u.lastShareAt = 0; }
    this.usedIds.clear(); this.recentUsed = [];
    this.fastestRecord = null;
    this.save();
    this.startIntermission(Date.now());
  }
  addQuestion(q) {
    const letters = ['A', 'B', 'C', 'D'];
    if (!q || !Number.isInteger(q.level) || q.level < 1 || q.level > 15) return { ok: false, error: 'level phải là số nguyên 1–15' };
    if (!q.question || !String(q.question).trim()) return { ok: false, error: 'thiếu nội dung câu hỏi' };
    const opts = q.options || {};
    const vals = letters.map(l => String(opts[l] || '').trim());
    if (vals.some(v => !v)) return { ok: false, error: 'phải đủ 4 đáp án A–D' };
    if (new Set(vals).size !== 4) return { ok: false, error: '4 đáp án phải khác nhau' };
    if (!letters.includes(q.correct)) return { ok: false, error: 'correct phải thuộc A–D' };
    const norm = String(q.question).trim().toLowerCase();
    if (this.bank.some(x => String(x.question).trim().toLowerCase() === norm)) return { ok: false, error: 'trùng câu hỏi đã có' };
    const entry = {
      id: 'custom-' + Date.now().toString(36),
      level: q.level, category: String(q.category || 'Đời sống').trim(),
      question: String(q.question).trim(),
      options: { A: vals[0], B: vals[1], C: vals[2], D: vals[3] },
      correct: q.correct,
    };
    if (q.qualifier === true) entry.qualifier = true;
    this.bank.push(entry);
    try { fs.writeFileSync(this.bankPath, JSON.stringify(this.bank, null, 1)); }
    catch (e) { return { ok: false, error: 'không ghi được file ngân hàng: ' + e.message }; }
    return { ok: true, id: entry.id };
  }
  bankCounts() {
    const counts = {};
    let qualifier = 0;
    for (const q of this.bank) { counts[q.level] = (counts[q.level] || 0) + 1; if (q.qualifier) qualifier++; }
    return { total: this.bank.length, qualifier, perLevel: counts };
  }

  // ---------- trạng thái cho sân khấu ----------
  boardTop(map, n, isSupport) {
    const arr = [];
    for (const [uid, v] of map) arr.push(isSupport ? { uid, nickname: v.nickname, avatarUrl: v.avatarUrl, points: v.points } : { uid, nickname: v.nickname, avatarUrl: v.avatarUrl, points: v.points, correctCount: v.correctCount });
    arr.sort((a, b) => b.points - a.points);
    return arr.slice(0, n);
  }
  getState() {
    const now = Date.now();
    const ctx = this.ctx;
    const run = this.run;
    const hs = run ? this.users.get(run.uid) : null;
    let timer = null;
    if (ctx && (this.phase === 'question' || this.phase === 'qualifier')) {
      const inPoll = !!(ctx.poll);
      timer = {
        totalMs: ctx.kind === 'qualifier' ? CFG.QUALIFIER_TIME_MS : CFG.QUESTION_TIME_MS,
        endsAt: inPoll ? ctx.poll.endsAt : ctx.deadline,
        remainingMs: Math.max(0, (inPoll ? ctx.poll.endsAt : ctx.deadline) - now),
        frozen: inPoll,
      };
    }
    let pollState = null;
    if (ctx && ctx.poll) {
      const counts = { A: 0, B: 0, C: 0, D: 0 };
      for (const l of ctx.poll.votes.values()) counts[l]++;
      const total = ctx.poll.votes.size;
      const percents = {};
      for (const l of LETTERS) percents[l] = total ? Math.round((counts[l] / total) * 100) : 0;
      pollState = { active: true, endsAt: ctx.poll.endsAt, total, percents };
    } else if (this.lastPoll && this.phase === 'question') {
      pollState = { active: false, total: this.lastPoll.total, percents: this.lastPoll.percents };
    }
    return {
      game: 'trieu-phu-live', serverNow: now, feedStatus: this.feedStatus, viewerCount: this.viewerCount,
      phase: this.phase, phaseEndsAt: this.phaseEndsAt,
      question: ctx ? {
        kind: ctx.kind, level: ctx.level, category: ctx.category, text: ctx.text,
        options: ctx.options, removed: ctx.removed,
        hotseatLocked: ctx.hotseatAnswer, answersCount: ctx.answers.size,
        audioKey: 'q/' + ctx.qid,
      } : null,
      timer,
      hotseat: run && hs ? {
        nickname: hs.nickname, avatarUrl: hs.avatarUrl, level: run.level,
        currentPoints: run.level > 1 ? CFG.LADDER[run.level - 2] : 0,
        nextPoints: CFG.LADDER[run.level - 1],
      } : null,
      lifelines: run ? { ...run.lifelines } : null,
      poll: pollState,
      lastReveal: this.lastReveal,
      lastQualifier: this.lastQualifier,
      runSummary: this.runSummary,
      ladder: CFG.LADDER, milestoneLevels: CFG.MILESTONE_LEVELS,
      audienceBoard: this.boardTop(this.users, 10, false).filter(x => x.points > 0),
      supportBoard: this.boardTop(this.support, 10, true),
      likeMeter: { cur: this.likeMeter, target: CFG.LIKE_METER_TARGET, bonusUsedThisQuestion: !!(ctx && ctx.bonusUsed) },
      announcements: this.announcements,
      audioCue: this.audioCue,
      audioCues: this.cueLog.slice(-5), // 5 cue gần nhất — stage xử lý mọi cue có seq > mốc đã nhận, theo thứ tự
      fastestRecord: this.fastestRecord,
      bigGift: this.bigGift && now - this.bigGift.ts < 8000 ? this.bigGift : null,
    };
  }
  getDebugState() {
    const s = this.getState();
    const ctx = this.ctx;
    const answers = {};
    if (ctx) for (const [uid, a] of ctx.answers) answers[uid] = { letter: a.letter, elapsedMs: a.elapsedMs };
    s.debug = {
      correct: ctx ? ctx.correct : null,
      questionId: ctx ? ctx.qid : null,
      answers,
      hotseatUid: this.run ? this.run.uid : null,
      removed: ctx ? ctx.removed : [],
    };
    return s;
  }
}

function fmtMs(ms) {
  return (ms / 1000).toFixed(2).replace('.', ',') + 's';
}

module.exports = Engine;
module.exports.fmtPoints = fmtPoints;
module.exports.parseAnswer = parseAnswer;
module.exports.parseKeyword = parseKeyword;
