// Candlekeep Sheet — DB 검증/QA. 사용: node tools/verify.mjs
// 1) kind별 카운트 2) 필수필드 누락 3) {{ref}} 상호참조 해소율(ID→라벨→기술맵, * 제거)
import fs from 'fs';

const DB = 'data/db';
const KINDS = ['spell', 'weapon', 'armor', 'gear', 'feat', 'magic-item', 'monster', 'species', 'class', 'subclass', 'rule', 'background'];
const GLOSSARY = '/Users/sepi/Library/Mobile Documents/com~apple~CloudDocs/AIwork/01_TTRPG-Translation/_glossary/candlekeep/glossary.json';

// D&D 5e 2024 기술 18종 (노션이 단일 페이지로 링크 → 개별 엔트리 없음, 라벨로만 식별)
const SKILLS = new Set(['곡예', '동물 조련', '운동', '역사', '통찰', '위협', '수사', '의학', '자연', '포착', '설득', '종교', '손속임', '은신', '생존', '비전', '기만', '공연', '마술', '주문학']);

const ids = new Set(), koMap = new Map(), all = [];
for (const k of KINDS) {
  try {
    for (const r of JSON.parse(fs.readFileSync(`${DB}/${k}.json`, 'utf8'))) {
      if (r.id) { const cid = String(r.id).replace(/-/g, '').split('#')[0]; ids.add(cid); if (r.ko && !koMap.has(r.ko)) koMap.set(r.ko, cid); }
      all.push(r);
    }
  } catch { console.warn('missing', k); }
}
try { for (const e of JSON.parse(fs.readFileSync(GLOSSARY, 'utf8')).entries) { ids.add(String(e.id).replace(/-/g, '')); if (e.ko && !koMap.has(e.ko)) koMap.set(e.ko, String(e.id).replace(/-/g, '')); } } catch {}

// kind별
const byKind = {}; for (const r of all) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
console.log('레코드:', all.length, '\nkind별:', byKind);

// ref 해소
const norm = (s) => s.replace(/^\*+|\*+$/g, '').trim(); // 이탤릭 * 제거
let total = 0, byId = 0, byLabel = 0, bySkill = 0, unres = 0; const dang = new Map();
for (const r of all) for (const m of JSON.stringify(r).matchAll(/\{\{ref:([0-9a-f]+)\|([^}]+)\}\}/g)) {
  total++; const label = norm(m[2]);
  if (ids.has(m[1])) byId++;
  else if (koMap.has(label)) byLabel++;
  else if (SKILLS.has(label)) bySkill++;
  else { unres++; dang.set(label, (dang.get(label) || 0) + 1); }
}
const ok = byId + byLabel + bySkill;
console.log(`\n{{ref}} ${total}개: ID ${byId} + 라벨 ${byLabel} + 기술 ${bySkill} = ${ok} (${(ok / total * 100).toFixed(1)}%) | 미해소 ${unres} (distinct ${dang.size})`);
console.log('상위 미해소:', [...dang.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([l, n]) => `${l}(${n})`).join(', '));
