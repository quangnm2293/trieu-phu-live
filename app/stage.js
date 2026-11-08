'use strict';
/* AI LÀ TRIỆU PHÚ LIVE — logic sân khấu: nhận state qua WS, hiển thị + phát giọng MC. */
const params = new URLSearchParams(location.search);
const OBS = params.has('obs');
let muted = params.has('mute');

// ---------- co giãn khung 1080×1920 ----------
const scaler = document.getElementById('scaler');
function fit() {
  const s = Math.min(innerWidth / 1080, innerHeight / 1920);
  scaler.style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', fit); fit();

// ---------- tiện ích ----------
const $ = id => document.getElementById(id);
const fmtPts = n => String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fmtMs = ms => (ms / 1000).toFixed(2).replace('.', ',') + 's';
const AV_COLORS = ['#2743a6', '#7a2ea0', '#0e7a5f', '#a03d2e', '#8a6d1a', '#205f8a', '#93336b'];
function avColor(name) { let h = 0; for (const c of String(name || '?')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; }
function setAvatar(el, user, size) {
  const name = (user && user.nickname) || '?';
  if (user && user.avatarUrl) {
    el.outerHTML = `<img id="${el.id}" class="${el.className}" src="${user.avatarUrl}" alt="" onerror="this.outerHTML='<div id=\\'${el.id}\\' class=\\'${el.className} avatar-fallback\\' style=\\'background:${avColor(name)}\\'>${name.slice(0, 1).toUpperCase()}</div>'">`;
  } else {
    el.style.background = avColor(name);
    el.textContent = name.slice(0, 1).toUpperCase();
  }
}

// ---------- âm thanh: giọng MC (file mp3) ----------
// Engine phát — bản sửa vòng 2 (vẫn lệch tiếng/hình sau vòng 1):
// - Server gửi kèm 5 cue gần nhất trong mỗi state (audioCues); stage xử lý MỌI cue
//   có seq > mốc đã nhận THEO THỨ TỰ — hai cue bắn liên tiếp không còn ghi đè mất nhau.
//   Lần đầu nối chỉ đồng bộ mốc seq, không phát lại cue cũ.
// - Cue ƯU TIÊN (đúng/sai/chốt đáp án/lên ghế nóng/bỏ cuộc/quán quân/mốc an toàn +
//   các cue chuyển pha run-end/next-qualifier/qualifier-again): NGẮT clip đang phát
//   ngay lập tức, xoá sạch hàng đợi, phát cue này trước. Riêng 2 cue chuyển pha
//   next-qualifier/qualifier-again: phần ngắt chạy ngay khi cue tới, còn câu thoại
//   chỉ phát ở pha vòng loại (đúng thời điểm kể chuyện) nhờ cổng pha ở cueKeyFresh.
// - Trước khi phát key đang chờ, kiểm tra "độ tươi" theo NGỮ CẢNH (không theo seq):
//   clip đọc câu hỏi chỉ phát khi đúng câu đang mở; clip mở câu chỉ phát ở pha của nó.
// - DỪNG THEO PHA: mỗi state mới, nếu clip q/ đang phát thuộc câu hỏi mà sân khấu đã
//   rời (sang intermission/run_end, hoặc id câu khác hẳn) → dừng ngay + huỷ nốt các
//   key còn lại của cue đó — kể cả khi cue chuyển pha bị lỡ.
let audioUnlocked = false;
let audioQueue = [];           // [{key, seq}]
let audioPlaying = false;
let currentAudio = null;       // phần tử Audio đang phát (để ngắt ngay khi cần)
let currentEntry = null;       // {key, seq} của clip đang phát
let newestCueSeq = 0;          // seq của cue mới nhất đã nhận
let cueSynced = false;         // đã đồng bộ mốc seq ở state đầu tiên chưa
const playedLog = [];          // các key đã THỰC SỰ bắt đầu phát (theo thứ tự) — phục vụ test
const PRIORITY_KEYS = new Set([
  'mc/correct', 'mc/wrong', 'mc/locked', 'mc/hotseat-new',
  'mc/walkaway', 'mc/champion', 'mc/milestone5', 'mc/milestone10',
  'mc/run-end', 'mc/next-qualifier', 'mc/qualifier-again',
]);
// Cổng pha cho clip "mở câu": chỉ phát khi sân khấu đang ở đúng pha của nó.
// (next-qualifier/qualifier-again khi tới ở pha intermission/qualifier_reveal vẫn
// NGẮT clip cũ nhờ nhánh ưu tiên trong enqueueCue, nhưng câu thoại để dành phát
// lúc vòng loại thật sự mở — tránh đọc 2 lần.)
const OPEN_CLIP_PHASES = [
  [/^mc\/level-\d+$/, ['question']],
  [/^mc\/qualifier-intro$/, ['qualifier']],
  [/^mc\/qualifier-again$/, ['qualifier']],
  [/^mc\/next-qualifier$/, ['qualifier']],
];
function cueUrl(key) {
  if (key.startsWith('mc/')) return '/audio/mc/' + key.slice(3) + '.mp3';
  if (key.startsWith('q/')) return '/audio/questions/' + key.slice(2) + '.mp3';
  return null;
}
function stopCurrentAudio() {
  if (currentAudio) {
    try { currentAudio.onended = null; currentAudio.onerror = null; currentAudio.pause(); } catch (_) {}
    currentAudio = null;
  }
  currentEntry = null;
  audioPlaying = false;
}
function cueKeyFresh(entry) {
  if (!S) return true;
  // clip đọc câu hỏi: chỉ phát khi đúng câu đang mở trên sân khấu
  if (entry.key.startsWith('q/')) {
    if (!S.question || S.question.audioKey !== entry.key) return false;
    if (!['qualifier', 'question'].includes(S.phase)) return false;
  }
  // clip mở câu: chỉ phát ở pha của nó (xem OPEN_CLIP_PHASES)
  for (const [re, phases] of OPEN_CLIP_PHASES) {
    if (re.test(entry.key)) return phases.includes(S.phase);
  }
  return true;
}
// Dừng theo pha: clip đọc câu hỏi đang phát mà sân khấu đã rời câu hỏi đó
// (vào intermission/run_end, hoặc đã sang câu khác — trừ lúc chốt/công bố của
// CHÍNH câu đó, khi ấy cue ưu tiên sẽ tự ngắt) → dừng ngay, huỷ key cùng cue.
function enforcePhaseExitStop() {
  if (!currentEntry || !S) return;
  if (!currentEntry.key.startsWith('q/')) return;
  let stop = false;
  if (S.phase === 'intermission' || S.phase === 'run_end') stop = true;
  else {
    const curKey = S.question ? S.question.audioKey : null;
    if (curKey !== currentEntry.key && !['locked', 'reveal'].includes(S.phase)) stop = true;
  }
  if (stop) {
    const seq = currentEntry.seq;
    stopCurrentAudio();
    audioQueue = audioQueue.filter(e => e.seq !== seq);
    playNextCue();
  }
}
// ---------- tín hiệu "MC đã đọc xong câu hỏi" → server mở cửa sổ trả lời ----------
// Luật chơi: đọc câu hỏi XONG mới bắt đầu tính giờ. Stage là nơi biết chính xác khi
// nào clip đọc câu hỏi kết thúc → POST /api/stage/audio-done {qid}. Nếu stage không
// báo (mở giữa chừng, OBS không tương tác…), server tự mở theo thời lượng clip + đệm.
// Stage đang TẮT TIẾNG (mute=1 / nút 🔇): không có gì để chờ nghe → báo ngay khi cue
// của câu hỏi được xử lý (tương đương "đọc xong lập tức").
const doneSignalLog = [];      // các qid đã báo xong (theo thứ tự) — phục vụ test/gỡ lỗi
let doneSignalFor = null;      // qid đã báo cho câu hiện tại (mỗi câu báo đúng 1 lần)
function sendAudioDone(qid) {
  if (!qid || doneSignalFor === qid) return;
  doneSignalFor = qid;
  doneSignalLog.push(qid);
  try {
    fetch('/api/stage/audio-done', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qid }),
    }).catch(() => {});
  } catch (_) {}
}
// Gỡ hook kiểm thử (vô hại trên sóng): test CDP đọc trạng thái engine tiếng qua đây.
window.__tpAudio = {
  played: playedLog,
  doneSignals: doneSignalLog,
  get current() { return currentEntry ? currentEntry.key : null; },
  get queue() { return audioQueue.map(e => e.key); },
  get newestSeq() { return newestCueSeq; },
  get synced() { return cueSynced; },
};
function playNextCue() {
  if (audioPlaying || muted) return;
  while (audioQueue.length) {
    const entry = audioQueue.shift();
    if (!cueKeyFresh(entry)) continue; // clip đã lỗi thời theo ngữ cảnh → bỏ qua
    const url = cueUrl(entry.key);
    if (!url) continue;
    const a = new Audio(url);
    currentAudio = a;
    currentEntry = entry;
    audioPlaying = true;
    playedLog.push(entry.key);
    const done = () => {
      if (currentAudio === a) { currentAudio = null; currentEntry = null; }
      audioPlaying = false;
      // Clip đọc câu hỏi của ĐÚNG câu đang mở vừa kết thúc (hoặc lỗi/không có file)
      // → báo server mở cửa sổ trả lời ngay, khỏi chờ hết cửa sổ dự phòng.
      if (entry.key.startsWith('q/') && S && S.question && S.question.audioKey === entry.key) {
        sendAudioDone(entry.key.slice(2));
      }
      playNextCue();
    };
    a.onended = done;
    a.onerror = done; // clip chưa sinh → bỏ qua, không kẹt hàng đợi (và vẫn báo đọc xong ở trên)
    const p = a.play();
    if (p && p.catch) p.catch(() => { // trình duyệt chặn autoplay: chờ người dùng chạm 1 lần
      if (currentAudio === a) { currentAudio = null; currentEntry = null; }
      audioPlaying = false;
      audioQueue.unshift(entry);
      playedLog.pop();
      $('soundHint').classList.remove('got');
    });
    return;
  }
}
function enqueueCue(cue) {
  if (!cue || cue.seq <= newestCueSeq) return;
  newestCueSeq = cue.seq;
  // Đang tắt tiếng: clip không phát nên không có "đọc xong" để chờ — cue chứa clip
  // của câu đang mở thì báo đọc xong ngay (server mở cửa sổ trả lời lập tức).
  if (muted && S && S.question && cue.keys.includes(S.question.audioKey)) {
    sendAudioDone(S.question.audioKey.slice(2));
  }
  if (cue.keys.some(k => PRIORITY_KEYS.has(k))) {
    // ƯU TIÊN: ngắt ngay clip đang phát + xoá hàng đợi chờ → tiếng khớp với hình
    stopCurrentAudio();
    audioQueue = [];
  }
  for (const k of cue.keys) audioQueue.push({ key: k, seq: cue.seq });
  if (audioQueue.length > 8) audioQueue.splice(0, audioQueue.length - 8);
  playNextCue();
}
// Nhận cue từ state: xử lý LẦN LƯỢT mọi cue trong audioCues (5 cue gần nhất phía
// server) có seq lớn hơn mốc đã nhận. State đầu tiên sau khi nối chỉ đồng bộ mốc
// (không phát lại cue cũ); thiếu audioCues (server cũ) thì lùi về audioCue đơn.
function processStateCues(state) {
  const cues = Array.isArray(state.audioCues) && state.audioCues.length
    ? state.audioCues : (state.audioCue ? [state.audioCue] : []);
  if (!cues.length) return;
  if (!cueSynced) {
    newestCueSeq = Math.max(newestCueSeq, cues[cues.length - 1].seq);
    cueSynced = true;
    return;
  }
  for (const c of cues) enqueueCue(c);
}
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  $('soundHint').classList.add('got');
  ensureCtx();
  playNextCue();
}
addEventListener('pointerdown', unlockAudio);
addEventListener('keydown', unlockAudio);
if (OBS) $('soundHint').style.display = 'none';
$('muteBtn').addEventListener('click', e => {
  e.stopPropagation();
  muted = !muted;
  $('muteBtn').textContent = muted ? '🔇' : '🔊';
  if (muted) { // tắt tiếng = dừng ngay clip đang phát; nếu đang dừng clip đọc câu hỏi thì coi như đã đọc xong
    const wasQ = currentEntry && currentEntry.key.startsWith('q/') ? currentEntry.key : null;
    stopCurrentAudio(); audioQueue = [];
    if (wasQ && S && S.question && S.question.audioKey === wasQ) sendAudioDone(wasQ.slice(2));
  }
  else { unlockAudio(); }
});
if (muted) $('muteBtn').textContent = '🔇';
if (OBS) { $('muteBtn').style.display = 'none'; $('debugChip').style.display = 'none'; }

// ---------- hiệu ứng âm thanh tổng hợp (WebAudio) ----------
let actx = null;
function ensureCtx() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} }
  if (actx && actx.state === 'suspended') actx.resume();
}
function tone(freq, t0, dur, type = 'sine', gain = 0.12) {
  if (!actx || muted) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(gain, actx.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + t0 + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(actx.currentTime + t0); o.stop(actx.currentTime + t0 + dur);
}
const sfx = {
  correct() { tone(659, 0, .18); tone(880, .12, .3); },
  wrong() { tone(196, 0, .35, 'sawtooth', .07); tone(147, .1, .45, 'sawtooth', .07); },
  lock() { tone(520, 0, .09, 'square', .06); },
  tick() { tone(1050, 0, .05, 'square', .045); },
};

// ---------- trạng thái ----------
let S = null;
let serverOffset = 0; // serverNow - Date.now() tại lúc nhận gói
let lastPhase = null;
let lastHotseatResult = null;
let lastTickSecond = -1;

function buildLadder() {
  const el = $('ladder');
  el.innerHTML = '';
  S.ladder.forEach((pts, i) => {
    const lv = i + 1;
    const d = document.createElement('div');
    d.className = 'rung' + (S.milestoneLevels.includes(lv) ? ' milestone' : '');
    d.dataset.level = lv;
    d.innerHTML = `<span class="lv">${lv}${S.milestoneLevels.includes(lv) ? ' ★' : ''}</span><span class="pts">${fmtPts(pts)}</span>`;
    el.appendChild(d);
  });
}

function render() {
  if (!S) return;
  const phase = S.phase;
  const q = S.question;

  // Thang điểm
  if (!$('ladder').children.length) buildLadder();
  const curLevel = S.hotseat ? S.hotseat.level : (phase === 'reveal' && S.lastReveal ? S.lastReveal.level : 0);
  document.querySelectorAll('#ladder .rung').forEach(r => {
    const lv = Number(r.dataset.level);
    r.classList.toggle('current', !!S.hotseat && lv === curLevel && ['question', 'locked', 'reveal'].includes(phase));
    r.classList.toggle('passed', !!S.hotseat && lv < curLevel);
  });

  // Ghế nóng
  if (S.hotseat) {
    setAvatar($('seatAvatar'), S.hotseat);
    $('seatName').textContent = S.hotseat.nickname;
    $('seatPoints').textContent = `Đang có ${fmtPts(S.hotseat.currentPoints)} điểm · Câu này: ${fmtPts(S.hotseat.nextPoints)} điểm`;
  } else if (S.lastQualifier && S.lastQualifier.winner && phase === 'qualifier_reveal') {
    setAvatar($('seatAvatar'), S.lastQualifier.winner);
    $('seatName').textContent = S.lastQualifier.winner.nickname;
    $('seatPoints').textContent = 'Vừa giành ghế nóng 👑';
  } else {
    const av = $('seatAvatar');
    av.style.background = '#1b2a6b'; av.textContent = '?';
    $('seatName').textContent = 'GHẾ NÓNG ĐANG TRỐNG';
    $('seatPoints').textContent = phase === 'qualifier' ? 'Đang thi vòng loại…' : 'Chờ câu hỏi loại…';
  }
  // Trợ giúp
  const ll = S.lifelines;
  $('ll-fifty').classList.toggle('used', !ll || !ll.fifty);
  $('ll-poll').classList.toggle('used', !ll || !ll.poll);
  $('ll-swap').classList.toggle('used', !ll || !ll.swap);
  $('lifelines').style.visibility = ll ? 'visible' : 'hidden';

  // Thông báo mới nhất
  const ann = S.announcements && S.announcements.length ? S.announcements[S.announcements.length - 1] : null;
  if (ann) {
    $('announce').textContent = ann.text;
    $('announce').classList.add('show');
  }

  // Câu hỏi + đáp án
  const letters = ['A', 'B', 'C', 'D'];
  const showQ = !!q && ['qualifier', 'qualifier_reveal', 'question', 'locked', 'reveal'].includes(phase);
  $('winnerSpot').classList.add('hidden');
  if (phase === 'intermission' || phase === 'run_end' || phase === 'boot') {
    $('questionLabel').textContent = phase === 'run_end' ? 'TỔNG KẾT LƯỢT CHƠI' : 'NGHỈ GIẢI LAO';
    $('questionText').textContent = phase === 'run_end' ? 'Cảm ơn người chơi! Vòng loại tiếp theo sắp bắt đầu…' : 'Bảng vàng khán giả của buổi live — vòng loại sắp mở!';
  } else if (phase === 'qualifier') {
    $('questionLabel').textContent = '🏁 CÂU HỎI LOẠI — ĐÚNG & NHANH NHẤT LÊN GHẾ NÓNG';
    $('questionText').textContent = q ? q.text : '';
  } else if (phase === 'qualifier_reveal' && S.lastQualifier) {
    $('questionLabel').textContent = 'KẾT QUẢ VÒNG LOẠI';
    $('questionText').textContent = S.lastQualifier.questionText || '';
    if (S.lastQualifier.winner) {
      $('winnerSpot').classList.remove('hidden');
      setAvatar($('winnerAvatar'), S.lastQualifier.winner);
      $('winnerName').textContent = S.lastQualifier.winner.nickname;
    }
  } else if (q) {
    const val = S.ladder[q.level - 1];
    $('questionLabel').textContent = `CÂU ${q.level} · ${q.category} · TRỊ GIÁ ${fmtPts(val)} ĐIỂM`;
    $('questionText').textContent = q.text;
  }
  // Pha đọc của MC: câu hỏi + đáp án hiện sẵn nhưng đáp án MỜ chờ (chưa nhận trả
  // lời, đồng hồ chưa chạy) + huy hiệu "MC đang đọc" với thanh tiến trình đọc.
  const reading = !!(q && q.reading && ['qualifier', 'question'].includes(phase));
  $('readingBadge').classList.toggle('hidden', !reading);
  $('answers').classList.toggle('waiting', reading);
  $('answers').style.visibility = (phase === 'intermission' || phase === 'run_end' || phase === 'boot') ? 'hidden' : 'visible';
  document.querySelectorAll('#answers .answer').forEach(el => {
    const L = el.dataset.letter;
    el.querySelector('.ans-text').textContent = showQ && q ? (q.options[L] || '') : '';
    el.classList.toggle('removed', showQ && q ? q.removed.includes(L) : false);
    let cls = '';
    if ((phase === 'locked') && q && q.hotseatLocked === L) cls = 'locked';
    if (phase === 'reveal' && S.lastReveal) {
      if (S.lastReveal.correctLetter === L) cls = 'correct';
      else if (S.lastReveal.hotseatLetter === L) cls = 'wrong';
    }
    if (phase === 'qualifier_reveal' && S.lastQualifier && S.lastQualifier.correctLetter === L) cls = 'correct';
    el.classList.toggle('locked', cls === 'locked');
    el.classList.toggle('correct', cls === 'correct');
    el.classList.toggle('wrong', cls === 'wrong');
    // Thanh phiếu khán giả
    const pct = S.poll ? (S.poll.percents[L] || 0) : 0;
    el.querySelector('.poll-bar').style.width = S.poll ? pct + '%' : '0%';
    el.querySelector('.poll-pct').textContent = S.poll ? (S.poll.active ? `🗳 ${pct}%` : `${pct}%`) : '';
  });

  // Âm hiệu đúng/sai khi chuyển pha
  if (phase === 'reveal' && lastPhase !== 'reveal' && S.lastReveal) {
    if (S.lastReveal.hotseatResult === 'correct') sfx.correct(); else sfx.wrong();
  }
  if (phase === 'locked' && lastPhase !== 'locked') sfx.lock();
  lastPhase = phase;
  lastHotseatResult = S.lastReveal ? S.lastReveal.hotseatResult : lastHotseatResult;

  // Quà lớn → ánh vàng toàn màn
  $('giftGlow').classList.toggle('on', !!S.bigGift);

  // Dải dưới theo pha
  const showTop5 = (phase === 'reveal' && S.lastReveal) || (phase === 'qualifier_reveal' && S.lastQualifier);
  const showBoard = phase === 'intermission' || phase === 'run_end';
  $('panelInfo').classList.toggle('hidden', showTop5 || showBoard);
  $('panelTop5').classList.toggle('hidden', !showTop5);
  $('panelBoard').classList.toggle('hidden', !showBoard);

  if (showTop5) {
    const src = phase === 'reveal' ? S.lastReveal : S.lastQualifier;
    $('top5Title').textContent = phase === 'reveal' ? '🏆 ĐÚNG & NHANH NHẤT — CÂU NÀY' : '🏆 ĐÚNG & NHANH NHẤT — VÒNG LOẠI';
    $('top5List').innerHTML = src.top5.length ? src.top5.map((t, i) => `
      <div class="top5-row">
        <div class="rank">${i + 1}</div>
        ${t.avatarUrl ? `<img src="${t.avatarUrl}" alt="">` : `<div class="mini-fallback" style="background:${avColor(t.nickname)}">${t.nickname.slice(0, 1).toUpperCase()}</div>`}
        <div class="tname">${t.nickname}</div>
        <div class="ttime">${fmtMs(t.elapsedMs)}</div>
        <div class="tbonus">+${100 + (t.bonus || 0)}</div>
      </div>`).join('') : '<div class="board-empty">Chưa có ai trả lời đúng câu này.</div>';
    // Chỉ nêu số người trả lời ĐÚNG — không lặp lại tổng số người trả lời ở đây:
    // tổng số người trả lời của câu chỉ có MỘT chỗ hiển thị duy nhất là #answerCount (panelInfo).
    $('top5Stats').textContent = `Đáp án đúng: ${phase === 'reveal' ? S.lastReveal.correctLetter : S.lastQualifier.correctLetter} · ${src.correctCount} người trả lời đúng (${src.pctCorrect}%)`;
  }
  if (showBoard) {
    const rs = S.runSummary;
    if (phase === 'run_end' && rs) {
      const label = { champion: '👑 QUÁN QUÂN 150.000.000 ĐIỂM!', walkaway: 'Dừng cuộc chơi', wrong: 'Trả lời sai', timeout: 'Hết giờ' }[rs.result] || rs.result;
      $('runSummary').innerHTML = `${rs.nickname} — ${label}<br>Đi tới câu ${rs.reachedLevel} · Giữ được <span class="big">${fmtPts(rs.pointsKept)} điểm</span>` +
        (rs.runMVP ? `<br>MVP khán giả của lượt: <span class="big">${rs.runMVP.nickname}</span> (+${fmtPts(rs.runMVP.points)} điểm)` : '');
    } else {
      $('runSummary').innerHTML = 'Chào mừng đến với <span class="big">Ai Là Triệu Phú Live</span>! Vòng loại sắp bắt đầu…';
    }
    const board = (rows, empty) => rows.length ? rows.map((r, i) =>
      `<div class="board-row"><span class="brank">${i + 1}</span><span class="bname">${r.nickname}</span><span class="bpts">${fmtPts(r.points)}</span></div>`).join('')
      : `<div class="board-empty">${empty}</div>`;
    $('audienceBoard').innerHTML = board(S.audienceBoard, 'Chưa có điểm — hãy là người đầu tiên!');
    $('supportBoard').innerHTML = board(S.supportBoard, 'Chưa có ủng hộ hôm nay.');
  }

  // Panel thông tin thường
  $('likeBar').style.width = Math.min(100, (S.likeMeter.cur / S.likeMeter.target) * 100) + '%';
  $('likeCount').textContent = `${S.likeMeter.cur}/${fmtPts(S.likeMeter.target)}`;
  // Bộ đếm người trả lời DUY NHẤT trên sân khấu — lấy thẳng từ state của server
  // (question.answersCount = số người đã trả lời câu hiện tại, server là nguồn chuẩn).
  // Trong pha đọc đáp án chưa được nhận → chưa hiện bộ đếm.
  $('answerCount').textContent = q && q.answersOpen && ['qualifier', 'question'].includes(phase)
    ? `Đã có ${q.answersCount} người trả lời câu này` : '';
  $('instruction').textContent =
    reading ? '🎙 Nghe MC đọc xong câu hỏi — đọc xong mới bắt đầu tính giờ trả lời!' :
    phase === 'qualifier' ? 'CÂU HỎI LOẠI: Comment A / B / C / D — đúng & nhanh nhất vào GHẾ NÓNG!' :
    phase === 'question' && S.poll && S.poll.active ? '🗳 PHIẾU KHÁN GIẢ đang mở — comment đáp án để giúp ghế nóng!' :
    phase === 'question' ? 'Comment A / B / C / D để chơi cùng — đúng & nhanh nhất lên bảng! Ghế nóng gõ 50 / KHÁN GIẢ / ĐỔI để dùng trợ giúp.' :
    'Comment A / B / C / D để trả lời — ĐÚNG & NHANH NHẤT lên bảng vàng!';
  $('fastestRecord').textContent = S.fastestRecord
    ? `⚡ Kỷ lục đúng nhanh nhất buổi: ${S.fastestRecord.nickname} — ${fmtMs(S.fastestRecord.ms)} (xếp hạng theo thứ tự hệ thống ghi nhận)` : '';

  // Debug chip
  if (!OBS) $('debugChip').textContent = `phase=${S.phase} feed=${S.feedStatus} viewers=${S.viewerCount}`;

  updateTimer(); // mỗi gói state (10 lần/giây) cũng làm mới đồng hồ ngay
}

// ---------- vòng lặp hiển thị đồng hồ ----------
// Thời gian còn lại luôn TÍNH TỪ HẠN CHÓT phía server (timer.endsAt - giờ server),
// không tự đếm lùi cục bộ → không trôi, không đứng yên khi state về thưa.
// updateTimer được gọi từ 3 nguồn: rAF (mượt khi tab đang vẽ), interval 200ms
// (vẫn chạy khi rAF bị throttle ở tab nền/nguồn OBS) và cuối mỗi render().
function updateTimer() {
  if (!S) return;
  // Pha đọc: vòng quanh avatar + thanh trong huy hiệu hiển thị TIẾN TRÌNH ĐỌC
  // (theo mốc server ước lượng readingEndsAt) thay cho đồng hồ trả lời.
  if (S.question && S.question.reading && ['qualifier', 'question'].includes(S.phase)) {
    const nowSrv = Date.now() + serverOffset;
    const total = S.question.readingMs || 0;
    const remain = Math.max(0, (S.question.readingEndsAt || nowSrv) - nowSrv);
    const frac = total ? remain / total : 0;
    const ring = document.querySelector('#seatRing .ring-fg');
    ring.style.strokeDashoffset = String(578 * (1 - Math.max(0, Math.min(1, frac))));
    ring.style.stroke = '#6ec3ff';
    $('seatTimer').textContent = '🎙 ' + Math.ceil(remain / 1000) + 's';
    const bar = $('readingBar');
    if (bar) bar.style.width = String(Math.max(0, Math.min(100, (1 - frac) * 100))) + '%';
    return;
  }
  if (S.timer) {
    const remain = Math.max(0, S.timer.endsAt - (Date.now() + serverOffset));
    const frac = S.timer.totalMs ? remain / S.timer.totalMs : 0;
    const ring = document.querySelector('#seatRing .ring-fg');
    ring.style.strokeDashoffset = String(578 * (1 - Math.max(0, Math.min(1, frac))));
    ring.style.stroke = S.timer.frozen ? '#6ec3ff' : (remain < 6000 ? '#ff5d5d' : '#f7c948');
    $('seatTimer').textContent = S.timer.frozen ? '❄ ' + Math.ceil(remain / 1000) + 's' : Math.ceil(remain / 1000) + 's';
    const whole = Math.ceil(remain / 1000);
    if (S.phase === 'question' && !S.timer.frozen && whole <= 5 && whole >= 1 && whole !== lastTickSecond) { lastTickSecond = whole; sfx.tick(); }
  } else {
    $('seatTimer').textContent = S.phase === 'intermission' ? Math.max(0, Math.ceil((S.phaseEndsAt - (Date.now() + serverOffset)) / 1000)) + 's' : '';
  }
}
function raf() { updateTimer(); requestAnimationFrame(raf); }
requestAnimationFrame(raf);
setInterval(updateTimer, 200);

// ---------- kết nối WS ----------
function connect() {
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onmessage = e => {
    try {
      S = JSON.parse(e.data);
      serverOffset = S.serverNow - Date.now();
      processStateCues(S);
      enforcePhaseExitStop(); // clip đọc câu hỏi không được phát tràn sang pha khác
      render();
    } catch (_) {}
  };
  ws.onclose = () => setTimeout(connect, 1500);
  ws.onerror = () => { try { ws.close(); } catch (_) {} };
}
connect();
