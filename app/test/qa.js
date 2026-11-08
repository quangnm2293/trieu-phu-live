'use strict';
/**
 * QA TỰ ĐỘNG — Ai Là Triệu Phú Live.
 * Chỉขับ server qua HTTP /api/sim + /api/state + /api/admin/state (không gọi engine trực tiếp).
 * Chạy: node test/qa.js   →  in các dòng "QA:" và kết luận "QA PASS" / "QA FAIL".
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const PORT = 3099;
const BASE = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function check(cond, label) {
  console.log(`QA: ${label} ${cond ? 'OK' : 'FAIL'}`);
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
// Chờ cửa sổ trả lời MỞ (hết pha "MC đang đọc") — đáp án gửi trong lúc đọc bị engine bỏ qua.
const waitOpen = (timeout) => waitFor(async () => { const s = await get('/api/state'); return s.question && s.question.answersOpen ? s : null; }, 'cửa sổ trả lời mở', timeout);
const wrongOf = (correct, removed = []) => ['A', 'B', 'C', 'D'].find(l => l !== correct && !removed.includes(l));

async function main() {
  // --- cô lập dữ liệu ngày: sao lưu file điểm hôm nay, khôi phục sau QA ---
  const d = new Date();
  const dayName = `scores-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  const dayFile = path.join(APP, 'data', dayName);
  const hadDay = fs.existsSync(dayFile);
  if (hadDay) fs.copyFileSync(dayFile, dayFile + '.qabak');

  const env = {
    ...process.env, PORT: String(PORT),
    INTERMISSION_MS: '1200', QUALIFIER_TIME_MS: '6000', QUALIFIER_MIN_MS: '1200',
    REVEAL_TIME_MS: '1500', LOCKED_MS: '300', QUESTION_TIME_MS: '20000',
    POLL_TIME_MS: '3000', RUN_END_MS: '1200',
    LIKE_METER_TARGET: '50', LIKE_TIME_BONUS_MS: '10000',
    READING_TEST_MS: '2000', // cửa sổ "MC đang đọc" cố định 2s để QA tất định (mục 13 kiểm riêng pha đọc)
  };
  const srv = spawn(process.execPath, [path.join(APP, 'server.js')], { env, stdio: 'pipe' });
  let srvLog = '';
  srv.stdout.on('data', c => { srvLog += c; });
  srv.stderr.on('data', c => { srvLog += c; });

  try {
    await waitFor(async () => { const s = await get('/api/state'); return s && s.game === 'trieu-phu-live' ? s : null; }, 'server boot', 15000);
    check(true, 'server boot, state sẵn sàng');

    // ============ 1) VÒNG LOẠI: đúng + nhanh nhất lên ghế ============
    let s = await waitPhase('qualifier');
    await waitOpen(); // hết pha đọc mới gửi đáp án (gửi lúc đọc = bị bỏ qua)
    let dbg = await get('/api/admin/state');
    const firstQualifierId = dbg.debug.questionId;
    const qc = dbg.debug.correct;
    const qw = wrongOf(qc);
    sim('user_c', 'Bạn C', qw);                       // sai, sớm nhất
    await sleep(250); sim('user_a', 'Bạn A', qc);     // đúng, nhanh nhất
    await sleep(550); sim('user_b', 'Bạn B', qc);     // đúng, chậm hơn
    s = await waitPhase('qualifier_reveal');
    check(!!(s.lastQualifier && s.lastQualifier.winner), 'vòng loại có người thắng');
    check(s.lastQualifier.winner && s.lastQualifier.winner.uid === 'user_a', 'ghế nóng = người đúng NHANH NHẤT (user_a)');
    check(s.lastQualifier.top5.length === 2 && s.lastQualifier.top5[0].uid === 'user_a' && s.lastQualifier.top5[1].uid === 'user_b',
      'TOP 5 vòng loại xếp tăng dần theo thời gian, không có người sai');

    // ============ 2) CÂU 1: khóa đáp án đầu tiên + TOP 5/% đúng khán giả ============
    s = await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat ? x : null; }, 'vào câu 1');
    await waitOpen();
    dbg = await get('/api/admin/state');
    check(dbg.debug.hotseatUid === 'user_a', 'lượt ghế nóng bắt đầu với user_a');
    check(s.question.audioKey === 'q/' + dbg.debug.questionId, 'state có audio key của câu hiện tại (' + s.question.audioKey + ')');
    const c1 = dbg.debug.correct, w1 = wrongOf(c1);
    sim('user_d', 'Bạn D', w1);                        // D chọn sai trước
    await sleep(150); sim('user_e', 'Bạn E', c1);      // E đúng, nhanh nhất phía khán giả
    await sleep(150); sim('user_d', 'Bạn D', c1);      // D sửa đáp án → phải bị khóa, không tính
    await sleep(250); sim('user_a', 'Bạn A', c1);      // ghế nóng trả lời đúng
    s = await waitPhase('reveal');
    dbg = await get('/api/admin/state');
    check(dbg.debug.answers.user_d && dbg.debug.answers.user_d.letter === w1, 'đáp án đầu tiên của khán giả bị KHÓA (sửa sau không tính)');
    check(s.lastReveal.hotseatResult === 'correct', 'ghế nóng đúng câu 1');
    check(s.lastReveal.top5.length === 1 && s.lastReveal.top5[0].uid === 'user_e', 'TOP 5 khán giả câu 1: user_e đúng & nhanh nhất');
    check(s.lastReveal.correctCount === 1 && s.lastReveal.totalAnswers === 2 && s.lastReveal.pctCorrect === 50,
      `% đúng khán giả chính xác (${s.lastReveal.correctCount}/${s.lastReveal.totalAnswers} = ${s.lastReveal.pctCorrect}%)`);
    s = await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === 2 ? x : null; }, 'lên câu 2');
    check(true, 'đúng câu 1 → lên câu 2');

    // ============ 3) TRỢ GIÚP 50:50 ============
    dbg = await get('/api/admin/state');
    sim('user_a', 'Bạn A', '50');
    s = await waitFor(async () => { const x = await get('/api/admin/state'); return x.debug.removed.length === 2 ? x : null; }, '50:50 áp dụng');
    check(s.debug.removed.length === 2 && !s.debug.removed.includes(s.debug.correct), '50:50 loại đúng 2 đáp án SAI');
    await waitOpen();
    sim('user_a', 'Bạn A', s.debug.correct);
    s = await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === 3 ? x : null; }, 'lên câu 3');
    check(true, 'qua câu 2 bằng đáp án đúng sau 50:50');

    // ============ 4) TRỢ GIÚP HỎI KHÁN GIẢ (đóng băng giờ + % phiếu) ============
    await waitOpen(); // cần timer tồn tại (timer chỉ có khi cửa sổ đã mở)
    dbg = await get('/api/admin/state');
    const c3 = dbg.debug.correct;
    const before = await get('/api/state');
    const remainBefore = before.timer.remainingMs;
    sim('user_a', 'Bạn A', 'khan gia');
    s = await waitFor(async () => { const x = await get('/api/state'); return x.poll && x.poll.active ? x : null; }, 'phiếu khán giả mở');
    check(s.timer.frozen === true, 'đồng hồ câu hỏi ĐÓNG BĂNG trong lúc hỏi khán giả');
    const w3a = wrongOf(c3), w3b = wrongOf(c3, [w3a]);
    sim('vote_1', 'Vote 1', c3); sim('vote_2', 'Vote 2', c3); sim('vote_3', 'Vote 3', w3a); sim('vote_4', 'Vote 4', w3b);
    s = await waitFor(async () => { const x = await get('/api/state'); return x.poll && !x.poll.active && x.phase === 'question' ? x : null; }, 'phiếu đóng', 15000);
    const sumPct = Object.values(s.poll.percents).reduce((a, b) => a + b, 0);
    check(s.poll.percents[c3] === 50 && sumPct >= 99 && sumPct <= 101, `kết quả phiếu: đáp án đúng ${s.poll.percents[c3]}%, tổng ≈100% (${sumPct}%)`);
    check(s.timer.remainingMs > remainBefore - 2500, `đồng hồ chạy tiếp với thời gian còn lại sau phiếu (${s.timer.remainingMs}ms so với ${remainBefore}ms trước phiếu — không mất 3s bầu)`);
    sim('user_a', 'Bạn A', c3);
    s = await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === 4 ? x : null; }, 'lên câu 4');
    check(true, 'qua câu 3 sau khi hỏi khán giả');

    // ============ 5) TRỢ GIÚP ĐỔI CÂU ============
    dbg = await get('/api/admin/state');
    const qBeforeSwap = dbg.debug.questionId;
    sim('user_a', 'Bạn A', 'doi');
    s = await waitFor(async () => { const x = await get('/api/admin/state'); return x.debug.questionId && x.debug.questionId !== qBeforeSwap ? x : null; }, 'đổi câu');
    check(s.question.level === 4, 'đổi câu: câu mới CÙNG cấp độ (câu 4)');
    await waitOpen(); // câu mới sau ĐỔI cũng qua pha đọc trước
    sim('user_a', 'Bạn A', s.debug.correct);
    s = await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === 5 ? x : null; }, 'lên câu 5');
    check(true, 'qua câu 4 sau khi đổi câu');

    // ============ 6) LEO TỚI CÂU 7 RỒI SAI → RƠI VỀ MỐC 2.000.000 ============
    for (const lv of [5, 6]) {
      await waitOpen();
      dbg = await get('/api/admin/state');
      sim('user_a', 'Bạn A', dbg.debug.correct);
      await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === lv + 1 ? x : null; }, 'lên câu ' + (lv + 1));
    }
    check(true, 'leo qua mốc câu 5, tới câu 7');
    await waitOpen();
    dbg = await get('/api/admin/state');
    sim('user_a', 'Bạn A', wrongOf(dbg.debug.correct, dbg.debug.removed));
    s = await waitPhase('run_end');
    check(s.runSummary && s.runSummary.result === 'wrong' && s.runSummary.pointsKept === 2000000,
      `sai ở câu 7 → rơi về mốc 2.000.000 điểm (thực tế: ${s.runSummary ? s.runSummary.pointsKept : '?'})`);

    // ============ 7) SAU KHI SAI → QUAY NGAY RA VÒNG LOẠI (yêu cầu bổ sung) ============
    s = await waitPhase('qualifier');
    dbg = await get('/api/admin/state');
    check(s.question && s.question.kind === 'qualifier' && dbg.debug.questionId !== firstQualifierId,
      'sau khi ghế nóng sai → pha tiếp theo là QUALIFIER với câu loại MỚI');

    // ============ 8) DỪNG cuộc chơi ở câu 3 → giữ điểm câu 2 ============
    await post('/api/sim/hotseat', { uniqueId: 'user_x', nickname: 'Bạn X' });
    s = await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === 1 ? x : null; }, 'user_x vào ghế');
    for (const lv of [1, 2]) {
      await waitOpen();
      dbg = await get('/api/admin/state');
      sim('user_x', 'Bạn X', dbg.debug.correct);
      await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === lv + 1 ? x : null; }, 'user_x lên câu ' + (lv + 1));
    }
    sim('user_x', 'Bạn X', 'DUNG');
    s = await waitPhase('run_end');
    check(s.runSummary && s.runSummary.result === 'walkaway' && s.runSummary.pointsKept === 400000,
      `DỪNG ở câu 3 → giữ điểm câu 2 = 400.000 (thực tế: ${s.runSummary ? s.runSummary.pointsKept : '?'})`);
    s = await waitPhase('qualifier');
    check(true, 'sau khi DỪNG → cũng quay về vòng loại');

    // ============ 9) THANH NHIỆT HUYẾT: +10s đúng 1 lần/câu ============
    await post('/api/sim/hotseat', { uniqueId: 'user_y', nickname: 'Bạn Y' });
    s = await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === 1 && x.timer ? x : null; }, 'user_y vào ghế');
    const ends1 = s.timer.endsAt;
    await post('/api/sim', { type: 'like', uniqueId: 'fan_1', nickname: 'Fan 1', likeCount: 50 });
    s = await waitFor(async () => { const x = await get('/api/state'); return x.timer && x.timer.endsAt > ends1 + 8000 ? x : null; }, 'cộng giờ lần 1', 8000);
    const ends2 = s.timer.endsAt;
    check(ends2 - ends1 >= 9000, `like đầy thanh → ghế nóng +10 giây (endsAt +${ends2 - ends1}ms)`);
    await post('/api/sim', { type: 'like', uniqueId: 'fan_1', nickname: 'Fan 1', likeCount: 50 });
    await sleep(600);
    s = await get('/api/state');
    check(s.timer && s.timer.endsAt === ends2, 'đầy thanh lần 2 trong CÙNG câu → không cộng giờ nữa');
    dbg = await get('/api/admin/state');
    sim('user_y', 'Bạn Y', wrongOf(dbg.debug.correct));
    await waitPhase('run_end');

    // ============ 10) NGHỈ GIẢI LAO: bảng vàng + vòng lặp buổi ============
    s = await waitPhase('intermission');
    check(Array.isArray(s.audienceBoard) && s.audienceBoard.some(b => b.uid === 'user_e' && b.points >= 150),
      'màn nghỉ hiện Bảng vàng khán giả có user_e (đúng + thưởng tốc độ)');
    s = await waitPhase('qualifier');
    check(true, 'buổi live tự lặp: nghỉ → vòng loại tiếp theo');

    // ============ 11) AUDIO: clip MC + clip từng câu hỏi ============
    const { mcClips } = require(path.join(APP, 'tools', 'gen-audio.js'));
    const mcKeys = Object.keys(mcClips());
    const mcMissing = mcKeys.filter(k => {
      const f = path.join(APP, 'audio', 'mc', k + '.mp3');
      return !(fs.existsSync(f) && fs.statSync(f).size > 1000);
    });
    check(mcMissing.length === 0, `audio MC cố định đủ ${mcKeys.length}/${mcKeys.length} clip` + (mcMissing.length ? ' — thiếu: ' + mcMissing.join(', ') : ''));
    const bank = JSON.parse(fs.readFileSync(path.join(APP, 'questions', 'bank.json'), 'utf8'));
    const qMissing = bank.filter(q => {
      const f = path.join(APP, 'audio', 'questions', q.id + '.mp3');
      return !(fs.existsSync(f) && fs.statSync(f).size > 1000);
    }).map(q => q.id);
    console.log(`QA: audio câu hỏi có ${bank.length - qMissing.length}/${bank.length} clip` + (qMissing.length ? ' — còn thiếu: ' + qMissing.slice(0, 15).join(', ') + (qMissing.length > 15 ? ' …' : '') : ''));
    check(qMissing.length === 0, 'audio cho MỌI câu hỏi trong ngân hàng đều tồn tại');

    // ============ 12) NGÂN HÀNG CÂU HỎI ============
    const { validateBank } = require(path.join(APP, 'test', 'validate-bank.js'));
    const vr = validateBank(bank);
    check(vr.errors.length === 0, `ngân hàng hợp lệ: ${vr.total} câu, câu loại ${vr.qualifier}` + (vr.errors.length ? ' — lỗi: ' + vr.errors.join('; ') : ''));

    // ============ 13) PHA ĐỌC CỦA MC: đọc xong mới tính giờ ============
    // 13a) Vòng loại cũng đi qua đủ hai trạng thái: đang đọc (reading) → cửa sổ mở (answersOpen)
    {
      const seen = { qid: null, reading: false, open: false };
      await waitFor(async () => {
        const x = await get('/api/state');
        if (x.phase === 'qualifier' && x.question) {
          if (seen.qid !== x.question.audioKey) { seen.qid = x.question.audioKey; seen.reading = false; seen.open = false; }
          if (x.question.reading) seen.reading = true;
          if (x.question.answersOpen) seen.open = true;
          return seen.reading && seen.open ? x : null;
        }
        return null;
      }, 'vòng loại: reading → answersOpen', 40000);
      check(true, 'vòng loại cũng theo luồng đọc → mở cửa sổ (reading trước, answersOpen sau)');
    }
    // 13b) Đáp án trong lúc đọc bị BỎ QUA (khán giả + ghế nóng); audio-done sai qid không mở được cửa sổ
    await post('/api/sim/hotseat', { uniqueId: 'user_r', nickname: 'Bạn R' });
    s = await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.question && x.question.reading ? x : null; }, 'user_r vào ghế, đang đọc');
    dbg = await get('/api/admin/state');
    const rQid = dbg.debug.questionId, rc = dbg.debug.correct;
    check(s.timer === null && s.question.answersOpen === false, 'đang đọc: chưa có đồng hồ trả lời (timer=null), cửa sổ chưa mở');
    sim('fan_r', 'Fan R', rc);            // khán giả trả lời đúng TRONG lúc đọc
    sim('user_r', 'Bạn R', rc);           // ghế nóng trả lời đúng TRONG lúc đọc
    await sleep(500);
    dbg = await get('/api/admin/state');
    s = await get('/api/state');
    check(Object.keys(dbg.debug.answers).length === 0 && s.phase === 'question' && !s.question.hotseatLocked && s.question.reading,
      'đáp án gửi trong lúc MC đọc bị BỎ QUA (không khóa, không đếm — cả khán giả lẫn ghế nóng)');
    let doneRes = await post('/api/stage/audio-done', { qid: 'qid-khong-ton-tai' });
    check(doneRes.opened === false, 'audio-done với qid lạ bị bỏ qua (opened=false)');
    s = await get('/api/state');
    check(s.question.reading === true, 'cửa sổ vẫn đóng sau audio-done sai qid');
    // 13c) audio-done đúng qid → cửa sổ mở SỚM (trước hạn dự phòng 2000ms); elapsed tính từ mốc mở
    const tDone = Date.now();
    doneRes = await post('/api/stage/audio-done', { qid: rQid });
    check(doneRes.opened === true, 'audio-done đúng qid → mở cửa sổ ngay (opened=true)');
    s = await get('/api/state');
    check(s.question.answersOpen === true && !!s.timer && Date.now() - tDone < 1500,
      'cửa sổ mở sớm nhờ tín hiệu stage (không chờ hết cửa sổ dự phòng)');
    await sleep(300); sim('fan_r', 'Fan R', rc);   // chính người lúc nãy — giờ phải được tính
    dbg = await waitFor(async () => { const x = await get('/api/admin/state'); return x.debug.answers.fan_r ? x : null; }, 'đáp án fan_r sau khi mở được ghi', 6000);
    check(dbg.debug.answers.fan_r.letter === rc && dbg.debug.answers.fan_r.elapsedMs < 1500,
      `trả lời lại sau khi mở → được tính, elapsed đo từ MỐC MỞ (${dbg.debug.answers.fan_r.elapsedMs}ms — nhỏ hơn nhiều thời gian đọc 2000ms)`);
    sim('user_r', 'Bạn R', rc);
    s = await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === 2 ? x : null; }, 'user_r lên câu 2');
    check(true, 'ghế nóng qua câu 1 sau khi cửa sổ mở');
    // 13d) Không có tín hiệu nào → cửa sổ TỰ mở đúng hạn dự phòng (không sớm hơn hẳn, không kẹt)
    {
      const first = await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.question && x.question.reading ? x : null; }, 'câu 2 đang đọc');
      const t0 = Date.now();
      const opened = await waitFor(async () => { const x = await get('/api/state'); return x.question && x.question.answersOpen ? x : null; }, 'câu 2 tự mở (dự phòng)', 8000);
      const waited = Date.now() - t0;
      check(waited >= 1000 && waited <= 3600, `không có tín hiệu stage → cửa sổ tự mở theo hạn dự phòng (chờ ${waited}ms, kỳ vọng ≈2000ms)`);
      check(opened.timer && opened.timer.remainingMs > 15000, 'sau khi tự mở: đồng hồ trả lời chạy đủ 20s của QA');
    }
    // 13e) 50:50 dùng được NGAY trong lúc đọc (câu 3)
    await waitOpen();
    dbg = await get('/api/admin/state');
    sim('user_r', 'Bạn R', dbg.debug.correct);
    s = await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === 3 && x.question && x.question.reading ? x : null; }, 'user_r lên câu 3, đang đọc');
    sim('user_r', 'Bạn R', '50');
    s = await waitFor(async () => { const x = await get('/api/admin/state'); return x.debug.removed.length === 2 ? x : null; }, '50:50 trong lúc đọc', 6000);
    check(s.debug.removed.length === 2 && s.debug.reading === true, 'trợ giúp 50:50 áp dụng NGAY trong lúc MC đang đọc');
    await waitOpen();
    dbg = await get('/api/admin/state');
    sim('user_r', 'Bạn R', dbg.debug.correct);
    s = await waitFor(async () => { const x = await get('/api/state'); return x.phase === 'question' && x.hotseat && x.hotseat.level === 4 ? x : null; }, 'user_r lên câu 4');
    check(true, 'qua câu 3 bằng đáp án đúng sau 50:50 trong lúc đọc');
    // dọn lượt user_r để không ảnh hưởng phần sau (trả lời sai ở câu 4)
    await waitOpen();
    dbg = await get('/api/admin/state');
    sim('user_r', 'Bạn R', wrongOf(dbg.debug.correct, dbg.debug.removed));
    await waitPhase('run_end');
  } catch (e) {
    failures++;
    console.log('QA: NGOẠI LỆ — ' + e.message);
    if (srvLog) console.log('--- log server ---\n' + srvLog.slice(-1500));
  } finally {
    try { srv.kill('SIGKILL'); } catch (_) {}
    if (hadDay) { try { fs.copyFileSync(dayFile + '.qabak', dayFile); fs.unlinkSync(dayFile + '.qabak'); } catch (_) {} }
    else { try { fs.unlinkSync(dayFile); } catch (_) {} }
  }
  console.log(failures === 0 ? 'QA PASS' : `QA FAIL (${failures} mục)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
