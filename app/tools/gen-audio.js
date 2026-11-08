'use strict';
/**
 * Sinh giọng MC bằng Meta TTS (giọng avocado_v2:MAI_03 — giọng đã duyệt cho video ReviewHub)
 * qua CLI /opt/hatch/bin/tts — cùng cách gọi như ~/workspace/video-tools/engine.py.
 *
 * Xuất: app/audio/mc/<key>.mp3 (câu MC cố định) + app/audio/questions/<id>.mp3 (từng câu hỏi)
 *       + app/audio/manifest.json (thống kê sinh thành công / còn thiếu).
 * Chạy: node tools/gen-audio.js  — file đã có (>1KB) sẽ được bỏ qua; chạy lại để sinh bổ sung phần thiếu.
 * Thiếu clip nào game vẫn chạy bình thường (stage tự bỏ qua), manifest ghi rõ phần thiếu.
 */
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync, spawnSync } = require('child_process');

const APP = path.join(__dirname, '..');
const AUDIO_DIR = path.join(APP, 'audio');
const TTS = process.env.TTS_BIN || '/opt/hatch/bin/tts';
const CONCURRENCY = 4;

const ORDINALS = ['một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười',
  'mười một', 'mười hai', 'mười ba', 'mười bốn', 'mười lăm'];
const VALUE_WORDS = ['hai trăm nghìn điểm', 'bốn trăm nghìn điểm', 'sáu trăm nghìn điểm',
  'một triệu điểm', 'hai triệu điểm', 'ba triệu điểm', 'sáu triệu điểm', 'mười triệu điểm',
  'mười bốn triệu điểm', 'hai mươi hai triệu điểm', 'ba mươi triệu điểm', 'bốn mươi triệu điểm',
  'sáu mươi triệu điểm', 'tám mươi lăm triệu điểm', 'một trăm năm mươi triệu điểm'];

function mcClips() {
  const clips = {
    'welcome': 'Xin chào mừng quý vị và các bạn đến với Ai Là Triệu Phú Live! Hãy comment đáp án thật nhanh và chính xác để giành ghế nóng!',
    'qualifier-intro': 'Vòng loại bắt đầu! Tất cả quý vị hãy comment đáp án. Ai trả lời đúng và nhanh nhất sẽ ngồi vào ghế nóng!',
    'qualifier-again': 'Rất tiếc, chưa ai trả lời đúng câu hỏi loại vừa rồi. Chúng ta cùng thử một câu hỏi khác!',
    'next-qualifier': 'Chúng ta cùng đến với câu hỏi vòng loại tiếp theo, để tìm ra người ngồi ghế nóng mới!',
    'hotseat-new': 'Người chơi tiếp theo đã lộ diện! Xin chúc mừng bạn đã xuất sắc giành ghế nóng!',
    'locked': 'Đáp án đã được chốt! Chúng ta cùng hồi hộp chờ xem kết quả.',
    'correct': 'Chính xác! Đó là đáp án đúng!',
    'wrong': 'Rất tiếc! Đó chưa phải là đáp án đúng.',
    'milestone5': 'Chúc mừng! Bạn đã chạm mốc an toàn hai triệu điểm!',
    'milestone10': 'Tuyệt vời! Mốc an toàn hai mươi hai triệu điểm đã thuộc về bạn!',
    'lifeline-5050': 'Quyền trợ giúp năm mươi năm mươi đã được sử dụng! Hai đáp án sai đã bị loại bỏ.',
    'lifeline-poll': 'Người chơi hỏi ý kiến khán giả! Quý vị khán giả hãy comment đáp án để giúp người chơi nào!',
    'lifeline-swap': 'Người chơi quyết định đổi câu hỏi! Một câu hỏi mới cùng cấp độ sẽ được đưa ra.',
    'walkaway': 'Người chơi quyết định dừng cuộc chơi và bảo toàn số điểm hiện có. Xin chúc mừng!',
    'champion': 'Không thể tin được! Chúng ta đã có nhà vô địch một trăm năm mươi triệu điểm! Xin chúc mừng triệu phú của đêm nay!',
    'run-end': 'Lượt chơi đã kết thúc. Cảm ơn người chơi và toàn thể quý vị khán giả đã tham gia!',
  };
  for (let i = 0; i < 15; i++) {
    clips[`level-${i + 1}`] = `Câu hỏi số ${ORDINALS[i]}, trị giá ${VALUE_WORDS[i]}.`;
  }
  return clips;
}

const SUB_DIGITS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
function sanitize(text) {
  let t = String(text || '');
  t = t.replace(/×10²³/g, ' nhân mười mũ hai mươi ba');
  t = t.replace(/×10⁻¹¹/g, ' nhân mười mũ âm mười một');
  t = t.replace(/[₀-₉]/g, ch => SUB_DIGITS[ch] || ch);
  t = t.replace(/×/g, ' nhân ');
  t = t.replace(/π/g, 'pi');
  t = t.replace(/[·–]/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}
function questionText(q) {
  const o = q.options || {};
  return sanitize(`Câu hỏi: ${q.question} A: ${o.A}. B: ${o.B}. C: ${o.C}. D: ${o.D}.`);
}

function speak(text, out) {
  return new Promise(resolve => {
    const p = spawn(TTS, ['speak', '--text', text, '--language', 'vi', '--output', out], { stdio: 'ignore' });
    const to = setTimeout(() => { try { p.kill('SIGKILL'); } catch (_) {} resolve(false); }, 90000);
    p.on('error', () => { clearTimeout(to); resolve(false); });
    p.on('close', code => {
      clearTimeout(to);
      let ok = false;
      try { ok = code === 0 && fs.existsSync(out) && fs.statSync(out).size > 1000; } catch (_) {}
      resolve(ok);
    });
  });
}

// ---------- Sinh tách đoạn cho clip bệnh (TTS suy biến: lặp/chặt đoạn, dài 3–13 lần bình thường) ----------
// Bằng chứng (08/11): cùng một input, dịch vụ TTS trả cùng một thời lượng lỗi (deterministic theo input)
// nên chạy lại y hệt không bao giờ khỏi — phải đổi dạng input (tách câu hỏi / đáp án) và kiểm chứng từng đoạn.
// Tốc độ khỏe đo trên 1000 clip: trung vị 8,68 giây/100 ký tự. Đoạn đạt yêu cầu: rate <= 15 giây/100 ký tự
// (có sàn 3s cho đoạn rất ngắn) và tỉ lệ có tiếng (silencedetect -35dB, khoảng lặng >= 0,4s) >= 60%.
const HEALTHY_RATE = 0.0868; // giây / ký tự
const SEG_MAX_RATE = 0.15;    // giây / ký tự
const LONG_CLIP_SEC = 28;     // ngưỡng coi là clip dài bệnh → sinh tách đoạn

function probeDuration(file) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
    const d = parseFloat(out.trim());
    return Number.isFinite(d) ? d : null;
  } catch (_) { return null; }
}
function soundFraction(file) {
  const dur = probeDuration(file);
  if (!dur) return 0;
  const r = spawnSync('ffmpeg', ['-i', file, '-af', 'silencedetect=noise=-35dB:d=0.4', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let sil = 0, cur = null;
  for (const line of (r.stderr || '').split('\n')) {
    let m = line.match(/silence_start: ([\d.]+)/); if (m) cur = parseFloat(m[1]);
    m = line.match(/silence_end: ([\d.]+)/);
    if (m && cur !== null) { sil += parseFloat(m[1]) - cur; cur = null; }
  }
  if (cur !== null) sil += dur - cur;
  return Math.max(0, 1 - sil / dur);
}
function segPass(seg) {
  return seg && seg.ok && seg.dur <= Math.max(3.0, seg.chars * SEG_MAX_RATE) && seg.sndFrac >= 0.60;
}
function speakT(text, out, timeoutMs = 120000) {
  return new Promise(resolve => {
    const p = spawn(TTS, ['speak', '--text', text, '--language', 'vi', '--output', out], { stdio: 'ignore' });
    const to = setTimeout(() => { try { p.kill('SIGKILL'); } catch (_) {} resolve(false); }, timeoutMs);
    p.on('error', () => { clearTimeout(to); resolve(false); });
    p.on('close', code => {
      clearTimeout(to);
      let ok = false;
      try { ok = code === 0 && fs.existsSync(out) && fs.statSync(out).size > 400; } catch (_) {}
      resolve(ok);
    });
  });
}
async function speakSeg(text, out) {
  const okFile = await speakT(text, out);
  if (!okFile) return { ok: false, text, chars: text.length, dur: null, sndFrac: 0 };
  const dur = probeDuration(out);
  return { ok: dur !== null, text, chars: text.length, dur, sndFrac: dur ? soundFraction(out) : 0, file: out };
}
function questionParts(q) {
  const o = q.options || {};
  const optJoin = sep => sanitize(`A: ${o.A}${sep}B: ${o.B}${sep}C: ${o.C}${sep}D: ${o.D}.`);
  const single = (L, v) => [
    sanitize(`${L}: ${v}.`),
    sanitize(`Đáp án ${L} là ${v}.`),
    sanitize(`${L}, ${v}.`),
    sanitize(`Phương án ${L}: ${v}.`),
  ];
  return {
    qText: sanitize(`Câu hỏi: ${q.question}`),
    qBare: sanitize(`${q.question}`),
    opt: optJoin('. '),
    optSemi: optJoin('; '),
    ab: sanitize(`A: ${o.A}. B: ${o.B}.`),
    cd: sanitize(`C: ${o.C}. D: ${o.D}.`),
    singles: { A: single('A', o.A), B: single('B', o.B), C: single('C', o.C), D: single('D', o.D) },
    inverted: sanitize(`Các đáp án gồm: ${o.A} cho A, ${o.B} cho B, ${o.C} cho C và ${o.D} cho D.`),
  };
}
function concatParts(files, out, gapSec = 0.25) {
  // Mọi clip TTS đều là mp3 24kHz mono — ghép bằng concat filter + khoảng lặng giữa các đoạn.
  const args = ['-y', '-v', 'error'];
  for (const f of files) args.push('-i', f);
  args.push('-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono');
  const gapIdx = files.length;
  let fc = `[${gapIdx}:a]atrim=duration=${gapSec}[gap];`;
  const labels = [];
  files.forEach((_, i) => { labels.push(`[${i}:a]`); if (i < files.length - 1) labels.push('[gap]'); });
  fc += labels.join('') + `concat=n=${labels.length}:v=0:a=1[out]`;
  args.push('-filter_complex', fc, '-map', '[out]', '-codec:a', 'libmp3lame', '-b:a', '64k', out);
  execFileSync('ffmpeg', args, { stdio: 'pipe' });
  return probeDuration(out);
}
// Ghép + hậu kiểm: atempo <= 1,25x chỉ khi clip 25–32s và tiếng liên tục (không phải đoạn bệnh chặt khúc).
function finalizeClip(tmpOut, out) {
  let dur = probeDuration(tmpOut);
  if (dur && dur > 25 && dur <= 32 && soundFraction(tmpOut) >= 0.85) {
    const fixed = tmpOut + '.tempo.mp3';
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', tmpOut, '-filter:a', `atempo=${(dur / 29.5).toFixed(3)}`, '-codec:a', 'libmp3lame', '-b:a', '64k', fixed]);
    fs.renameSync(fixed, tmpOut);
    dur = probeDuration(tmpOut);
  }
  fs.copyFileSync(tmpOut, out); // copy thay rename: tmpDir có thể khác phân vùng với app/
  try { fs.unlinkSync(tmpOut); } catch (_) {}
  return dur;
}
/**
 * Sinh clip câu hỏi bằng ladder tách đoạn. Trả { ok, method, dur }.
 * ok=false nghĩa là mọi chiến lược đều không đạt chuẩn — file ở `out` là bản tốt nhất tìm được (vẫn thay bản cũ dài bệnh).
 */
async function speakQuestionSmart(q, out, tmpDir) {
  fs.mkdirSync(tmpDir, { recursive: true });
  const P = questionParts(q);
  const cache = new Map();
  const seg = async (text, name) => {
    if (cache.has(text)) return cache.get(text);
    const r = await speakSeg(text, path.join(tmpDir, name + '.mp3'));
    cache.set(text, r);
    return r;
  };
  const attempts = []; // {method, files:[seg...]}
  const tryAssemble = async (method, segs) => {
    if (!segs.every(s => s && s.ok)) return null;
    const tmp = path.join(tmpDir, 'asm-' + method + '.mp3');
    const dur = concatParts(segs.map(s => s.file), tmp);
    attempts.push({ method, dur, tmp, allPass: segs.every(segPass) });
    return attempts[attempts.length - 1];
  };
  const finish = (a, ok) => ({ ok, method: a.method, dur: finalizeClip(a.tmp, out) });

  const sQ = await seg(P.qText, 'q');
  const sQBare = segPass(sQ) ? null : await seg(P.qBare, 'qbare');
  const qSeg = segPass(sQ) ? sQ : (segPass(sQBare) ? sQBare : (sQ && sQ.ok ? sQ : sQBare));
  if (qSeg && qSeg.ok) {
    // Sinh mọi dạng đoạn đáp án; mỗi dạng là một ứng viên ghép hoàn chỉnh (đủ câu hỏi + đủ 4 đáp án)
    const sOpt = await seg(P.opt, 'opt');
    await tryAssemble('split2', [qSeg, sOpt]);
    const sSemi = await seg(P.optSemi, 'optsemi');
    await tryAssemble('split2-semi', [qSeg, sSemi]);
    const [sAB, sCD] = await Promise.all([seg(P.ab, 'ab'), seg(P.cd, 'cd')]);
    await tryAssemble('split3', [qSeg, sAB, sCD]);
    // Từng đáp án một: mỗi đáp án lấy bản đạt chuẩn đầu tiên, nếu không có thì lấy bản ngắn nhất
    const singles = [];
    for (const L of ['A', 'B', 'C', 'D']) {
      let got = null;
      for (let v = 0; v < P.singles[L].length; v++) {
        const s = await seg(P.singles[L][v], `single-${L}-${v}`);
        if (!s || !s.ok) continue;
        if (segPass(s)) { got = s; break; }
        if (!got || (s.dur !== null && (got.dur === null || s.dur < got.dur))) got = s;
      }
      singles.push(got);
    }
    if (singles.every(Boolean)) await tryAssemble('split5', [qSeg, ...singles]);
    const sInv = await seg(P.inverted, 'inv');
    await tryAssemble('split-inv', [qSeg, sInv]);

    const complete = attempts.filter(a => a.dur !== null);
    const passing = complete.filter(a => a.allPass).sort((x, y) => x.dur - y.dur);
    if (passing.length) return finish(passing[0], true);
    if (complete.length) { complete.sort((x, y) => x.dur - y.dur); return finish(complete[0], complete[0].dur <= 30); }
    // Không ghép được gì: dùng chính đoạn câu hỏi (ít nhất còn đúng phần câu hỏi) — đánh dấu hỏng để báo cáo
    fs.copyFileSync(qSeg.file, out);
    return { ok: false, method: 'question-only', dur: probeDuration(out) };
  }
  return { ok: false, method: 'question-failed', dur: null };
}

async function main() {
  const bank = JSON.parse(fs.readFileSync(path.join(APP, 'questions', 'bank.json'), 'utf8'));
  fs.mkdirSync(path.join(AUDIO_DIR, 'mc'), { recursive: true });
  fs.mkdirSync(path.join(AUDIO_DIR, 'questions'), { recursive: true });
  const jobs = [];
  const mc = mcClips();
  for (const [key, text] of Object.entries(mc)) jobs.push({ kind: 'mc', key, text, out: path.join(AUDIO_DIR, 'mc', key + '.mp3') });
  for (const q of bank) jobs.push({ kind: 'q', key: q.id, text: questionText(q), q, out: path.join(AUDIO_DIR, 'questions', q.id + '.mp3') });

  const results = { ok: [], missing: [] };
  let done = 0;
  async function worker(queue) {
    while (queue.length) {
      const job = queue.shift();
      let ok = false;
      try { ok = fs.existsSync(job.out) && fs.statSync(job.out).size > 1000; } catch (_) {}
      if (ok && job.kind === 'q') {
        // Clip đã có nhưng dài bệnh (> ngưỡng) thì coi như chưa đạt — sinh lại bằng tách đoạn
        const d = probeDuration(job.out);
        if (d !== null && d > LONG_CLIP_SEC) ok = false;
      }
      if (!ok && job.kind === 'q') {
        // Thử sinh một lượt trước (rẻ nhất); nếu kết quả vẫn dài bệnh thì chuyển sang tách đoạn
        const had = fs.existsSync(job.out);
        if (!had) { await speak(job.text, job.out); }
        const d = probeDuration(job.out);
        if (d !== null && d <= LONG_CLIP_SEC) ok = true;
        else {
          const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tp-split-'));
          const r = await speakQuestionSmart(job.q, job.out, tmpDir);
          try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
          const d2 = probeDuration(job.out);
          ok = r.ok || (d2 !== null && d2 <= 30);
          if (!ok) console.log(`  AUDIO: clip ${job.key} vẫn chưa đạt chuẩn sau tách đoạn (method=${r.method}, dur=${d2})`);
        }
      } else if (!ok) {
        ok = await speak(job.text, job.out);
      }
      (ok ? results.ok : results.missing).push((job.kind === 'mc' ? 'mc/' : 'q/') + job.key);
      done++;
      if (done % 20 === 0) console.log(`  ... ${done}/${jobs.length}`);
    }
  }
  const queue = [...jobs];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

  const manifest = {
    generatedAt: new Date().toISOString(),
    voice: 'avocado_v2:MAI_03',
    totalNeeded: jobs.length,
    generated: results.ok.length,
    missing: results.missing,
  };
  fs.writeFileSync(path.join(AUDIO_DIR, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(`AUDIO: đã sinh ${results.ok.length}/${jobs.length} clip (MC cố định ${Object.keys(mc).length} + câu hỏi ${bank.length})`);
  if (results.missing.length) console.log('AUDIO: còn thiếu ' + results.missing.length + ' clip: ' + results.missing.slice(0, 20).join(', ') + (results.missing.length > 20 ? ' …' : ''));
  console.log('AUDIO: manifest → app/audio/manifest.json');
}

if (require.main === module) main().catch(e => { console.error('AUDIO FAIL:', e.message); process.exit(0); });
module.exports = { mcClips, questionText, sanitize, questionParts, speakQuestionSmart, speakSeg, concatParts, finalizeClip, probeDuration, soundFraction, segPass, HEALTHY_RATE, LONG_CLIP_SEC };
