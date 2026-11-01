// Validates questions.json. Run: node scripts/validate-questions.mjs
// Exits non-zero on any problem, so the Pages workflow refuses to deploy a broken file.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];

let data;
try {
  data = JSON.parse(readFileSync(join(root, 'questions.json'), 'utf8'));
} catch (e) {
  console.error(`questions.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

const list = Array.isArray(data) ? data : data.questions;
if (!Array.isArray(list)) {
  console.error('questions.json must contain a "questions" array');
  process.exit(1);
}

const seen = new Set();
for (const [i, q] of list.entries()) {
  const at = `entry ${i} (day ${q?.day ?? '?'})`;
  if (!Number.isInteger(q.day) || q.day < 1 || q.day > 24) errors.push(`${at}: "day" must be an integer 1–24`);
  if (seen.has(q.day)) errors.push(`${at}: duplicate day`);
  seen.add(q.day);
  if (typeof q.question !== 'string' || !q.question.trim()) errors.push(`${at}: "question" is empty`);
  if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6 ||
      q.options.some((o) => typeof o !== 'string' || !o.trim())) {
    errors.push(`${at}: "options" must be 2–6 non-empty strings`);
  } else if (new Set(q.options).size !== q.options.length) {
    errors.push(`${at}: duplicate options`);
  }
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options?.length ?? 0)) {
    errors.push(`${at}: "answer" must be a zero-based index into "options"`);
  }
  if (typeof q.explanation !== 'string' || !q.explanation.trim()) errors.push(`${at}: "explanation" is empty`);
  if (q.image != null) {
    if (typeof q.image !== 'string') errors.push(`${at}: "image" must be a string path or null`);
    else if (!/^https?:\/\//.test(q.image) && !existsSync(join(root, q.image))) errors.push(`${at}: image not found: ${q.image}`);
    if (!q.imageAlt) warnings.push(`${at}: has an image but no "imageAlt" text`);
    if (!q.imageCredit) warnings.push(`${at}: has an image but no "imageCredit"`);
  }
}
for (let d = 1; d <= 24; d++) if (!seen.has(d)) warnings.push(`day ${d}: no question (door will show a placeholder message)`);

warnings.forEach((w) => console.warn(`warning: ${w}`));
if (errors.length) {
  errors.forEach((e) => console.error(`error: ${e}`));
  process.exit(1);
}
console.log(`questions.json OK: ${list.length} questions.`);
