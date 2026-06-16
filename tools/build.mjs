// Candlekeep Sheet — build: data/raw/**/*.json → data/db/<kind>.json
// 사용: node tools/build.mjs   (크롤 진행 중에도 부분 빌드 가능 — 재실행 안전)
import fs from 'fs';
import path from 'path';
import { parseRecord } from './parse.mjs';

const RAW = 'data/raw';
const DB = 'data/db';
fs.mkdirSync(DB, { recursive: true });

// glossary: id → {en, ko, category, tag}  (.txt 복구 파일에 메타 채우기 + .json 보정)
const GLOSSARY = '/Users/sepi/Library/Mobile Documents/com~apple~CloudDocs/AIwork/01_TTRPG-Translation/_glossary/candlekeep/glossary.json';
const glos = new Map();
try {
  for (const e of (JSON.parse(fs.readFileSync(GLOSSARY, 'utf8')).entries || []))
    glos.set(String(e.id).replace(/-/g, ''), e);
} catch { console.warn('glossary 로드 실패 — 메타 조인 생략'); }

// raw notion-fetch text 덤프(.txt)에서 properties JSON + content 추출 (무손상 복구 포맷)
function fromText(id, text) {
  const g = glos.get(id) || {};
  let properties = {};
  const pm = text.match(/<properties>\s*([\s\S]*?)\s*<\/properties>/);
  if (pm) { try { properties = JSON.parse(pm[1]); } catch {} }
  const cm = text.match(/<content>\s*([\s\S]*?)\s*<\/content>/);
  const content = cm ? cm[1] : '';
  return { id, category: g.category, en: g.en, ko: g.ko, tag: g.tag || null, properties, content };
}

// raw 슬러그 폴더 순회 (_batches, _pilot, 인덱스파일 제외). .json 우선, 무효/부재 시 .txt 폴백.
const SKIP_DIRS = new Set(['_batches', '_pilot']);
const byId = new Map();      // id → raw (중복 시 마지막 유효본)
let badJson = 0;
for (const slug of fs.readdirSync(RAW)) {
  if (SKIP_DIRS.has(slug)) continue;
  const dir = path.join(RAW, slug);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith('_')) continue;
    const fp = path.join(dir, f);
    const id = f.replace(/\.(json|txt)$/, '');
    if (f.endsWith('.json')) {
      try { byId.set(id, JSON.parse(fs.readFileSync(fp, 'utf8'))); }
      catch { badJson++; console.warn('JSON 파싱 실패:', fp); }
    } else if (f.endsWith('.txt')) {
      if (!byId.has(id)) byId.set(id, fromText(id, fs.readFileSync(fp, 'utf8')));
    }
  }
}

const records = [];
for (const raw of byId.values()) {
  try { const r = parseRecord(raw); if (Array.isArray(r)) records.push(...r); else records.push(r); }
  catch (e) { records.push({ id: raw.id, en: raw.en, ko: raw.ko, kind: 'error', category: raw.category, error: String(e) }); }
}

// kind별 그룹 + 파일 출력
const byKind = {};
for (const r of records) (byKind[r.kind] ||= []).push(r);
for (const [kind, arr] of Object.entries(byKind)) {
  if (['pending', 'unparsed', 'error'].includes(kind)) continue;
  arr.sort((a, b) => (a.en || '').localeCompare(b.en || ''));
  fs.writeFileSync(path.join(DB, `${kind}.json`), JSON.stringify(arr, null, 1));
}

// ── 품질 리포트 ──
const stat = (k) => (byKind[k] || []).length;
console.log('총 레코드:', records.length, '| 손상(무효 JSON):', badJson);
console.log('kind별:', Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, v.length])));

const spells = byKind.spell || [];
const weapons = byKind.weapon || [];
const armor = byKind.armor || [];
const feats = byKind.feat || [];
const issues = [];
spells.forEach(s => { if (s.level == null) issues.push(`spell ${s.en}: level 누락`); if (!s.school) issues.push(`spell ${s.en}: school 누락`); if (!s.classes?.length) issues.push(`spell ${s.en}: classes 누락`); });
weapons.forEach(w => { if (!w.damage) issues.push(`weapon ${w.en}: damage 누락`); });
armor.forEach(a => { if (a.armorClass !== 'shield' && a.ac == null) issues.push(`armor ${a.en}: ac 누락`); });
feats.forEach(f => { if (!f.benefits?.length && !f.desc) issues.push(`feat ${f.en}: 본문 누락`); });

console.log('\n── 품질 이슈:', issues.length, '건 ──');
issues.slice(0, 30).forEach(i => console.log(' ⚠', i));
if (issues.length > 30) console.log(` … 외 ${issues.length - 30}건`);
if (byKind.error) byKind.error.slice(0, 10).forEach(e => console.log(' ✗ error', e.en, e.error));
console.log('\n빌드 완료 → data/db/*.json');
