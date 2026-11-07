'use strict';
/**
 * Kiểm định ngân hàng câu hỏi: schema, số câu/cấp, trùng lặp,
 * phân bố đáp án đúng, pool câu hỏi loại.
 * Chạy: node test/validate-bank.js  (exit 0 = PASS)
 */
const fs = require('fs');
const path = require('path');

function validateBank(bank) {
  const errors = [];
  if (!Array.isArray(bank)) return { errors: ['bank không phải mảng'], counts: {}, total: 0, qualifier: 0, dist: {} };
  const ids = new Set();
  const texts = new Set();
  const counts = {};
  const dist = { A: 0, B: 0, C: 0, D: 0 };
  let qualifier = 0;
  for (const q of bank) {
    const at = q && q.id ? `[${q.id}]` : '[?]';
    if (!q.id || typeof q.id !== 'string') errors.push(`${at} thiếu id`);
    else if (ids.has(q.id)) errors.push(`${at} trùng id`);
    ids.add(q.id);
    if (!Number.isInteger(q.level) || q.level < 1 || q.level > 15) errors.push(`${at} level phải là số nguyên 1–15`);
    if (!q.category || !String(q.category).trim()) errors.push(`${at} thiếu category`);
    if (!q.question || !String(q.question).trim()) errors.push(`${at} thiếu question`);
    const normText = String(q.question || '').trim().toLowerCase();
    if (texts.has(normText)) errors.push(`${at} trùng nội dung câu hỏi`);
    texts.add(normText);
    const opts = q.options || {};
    const letters = ['A', 'B', 'C', 'D'];
    const optVals = letters.map(l => String(opts[l] || '').trim());
    if (optVals.some(v => !v)) errors.push(`${at} phải có đủ 4 đáp án A–D không rỗng`);
    if (new Set(optVals).size !== 4) errors.push(`${at} 4 đáp án phải khác nhau`);
    if (!letters.includes(q.correct)) errors.push(`${at} correct phải thuộc A–D`);
    else dist[q.correct]++;
    counts[q.level] = (counts[q.level] || 0) + 1;
    if (q.qualifier === true) qualifier++;
  }
  for (let lv = 1; lv <= 15; lv++) {
    if ((counts[lv] || 0) < 8) errors.push(`cấp ${lv} chỉ có ${counts[lv] || 0} câu (cần ≥8)`);
  }
  if (bank.length < 120) errors.push(`tổng số câu ${bank.length} < 120`);
  if (qualifier < 10) errors.push(`pool câu loại có ${qualifier} câu (cần ≥10)`);
  const totalDist = dist.A + dist.B + dist.C + dist.D;
  if (totalDist > 0) {
    for (const l of ['A', 'B', 'C', 'D']) {
      const pct = (dist[l] / totalDist) * 100;
      if (pct < 15 || pct > 35) errors.push(`đáp án đúng lệch về ${l}: ${pct.toFixed(1)}% (nên trong 15–35%)`);
    }
  }
  return { errors, counts, total: bank.length, qualifier, dist };
}

if (require.main === module) {
  const file = process.argv[2] || path.join(__dirname, '..', 'questions', 'bank.json');
  let bank;
  try { bank = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.log('BANK FAIL: không đọc được JSON — ' + e.message); process.exit(1); }
  const r = validateBank(bank);
  console.log('Ngân hàng câu hỏi:', file);
  for (let lv = 1; lv <= 15; lv++) console.log(`  Cấp ${String(lv).padStart(2)}: ${r.counts[lv] || 0} câu`);
  console.log(`  TỔNG: ${r.total} câu · câu loại (qualifier): ${r.qualifier}`);
  console.log(`  Phân bố đáp án đúng: A=${r.dist.A} B=${r.dist.B} C=${r.dist.C} D=${r.dist.D}`);
  if (r.errors.length) {
    for (const e of r.errors) console.log('  LỖI: ' + e);
    console.log('BANK FAIL');
    process.exit(1);
  }
  console.log('BANK PASS');
}
module.exports = { validateBank };
