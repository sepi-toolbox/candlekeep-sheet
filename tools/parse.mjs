// Candlekeep D&D 5e (2024) — Notion page → structured DB record parser
// 입력: data/raw/**/<id>.json  ({id, category, en, ko, properties, content})
// 출력: 카테고리별 구조화 레코드. build.mjs가 이걸 호출해 data/db/<cat>.json 생성.
//
// 설계 원칙(Pathforge 참조): id 기반 FK, 인라인 상호참조는 {{ref:id|label}} 마커로 보존
// (Pathforge의 {{condition:X}} 템플릿과 동일 역할 — UI가 툴팁/링크로 렌더).

// ── 학파 한↔영 (2024) ──
// ⚠ Candlekeep 정본: Conjuration = 창조술 (소환술 아님). 헤더 실측으로 8학파 확정.
export const SCHOOL_KO2EN = {
  '방출술': 'Evocation', '방출학파': 'Evocation',
  '방호술': 'Abjuration', '방호학파': 'Abjuration',
  '사령술': 'Necromancy', '사령학파': 'Necromancy',
  '환영술': 'Illusion', '환영학파': 'Illusion',
  '예지술': 'Divination', '예지학파': 'Divination',
  '환혹술': 'Enchantment', '환혹학파': 'Enchantment',
  '변환술': 'Transmutation', '변환학파': 'Transmutation',
  '창조술': 'Conjuration', '창조학파': 'Conjuration',
};

// ── 텍스트 클리너 ──
// 1) <span color="x">…</span> → 내용만 남김
// 2) {color="x"} 꼬리 마커 제거
// 3) [label](/pageid?pvs=..) → {{ref:pageid|label}} 로 상호참조 보존
export function cleanText(s) {
  if (!s) return '';
  let t = s;
  // 인라인 링크 먼저 (span 안에 있을 수 있으니 span 제거 전에)
  t = t.replace(/\[([^\]]+)\]\(\/?([0-9a-f-]{32,36})(?:\?[^)]*)?\)/g,
    (_, label, id) => `{{ref:${id.replace(/-/g, '')}|${label}}}`);
  // span 래퍼 제거 (내용 유지)
  t = t.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '');
  // {color="x"} / {color=x} 꼬리 마커
  t = t.replace(/\s*\{color=["']?[^}]*["']?\}/g, '');
  // synced_block(_reference) 래퍼 제거
  t = t.replace(/<synced_block[^>]*>/g, '').replace(/<\/synced_block[^>]*>/g, '');
  // 이미지 ![alt](url) 제거 (텍스트 가치 없음)
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  // synced_block 내부의 줄별 탭/공백 들여쓰기 제거 (### / ## 헤더 라인 시작 정규화)
  t = t.replace(/^[ \t]+/gm, '');
  return t.trim();
}

// <table>/<colgroup> 블록 제거 (desc 정리용 — 표 데이터가 필요하면 parseTable 사용)
function stripTables(s) {
  return (s || '').replace(/<table[\s\S]*?<\/table>/g, '').replace(/<colgroup[\s\S]*?<\/colgroup>/g, '');
}

// HTML <table> → 행 배열 (각 행 = 셀 텍스트 배열, cleanText 적용)
function parseTable(html) {
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g; let m;
  while ((m = trRe.exec(html))) {
    rows.push([...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => cleanText(c[1])));
  }
  return rows;
}
function firstTable(content) {
  const m = content.match(/<table[\s\S]*?<\/table>/);
  return m ? parseTable(m[0]) : [];
}

// 라인 단위로 **라벨:** 값  추출
function labelMap(lines) {
  const m = {};
  for (const ln of lines) {
    const mm = ln.match(/^\*\*(.+?)[:：]\s*\*\*\s*(.*)$/); // 콜론과 ** 사이 공백 허용 (**클래스: **)
    if (mm) m[mm[1].trim()] = mm[2].trim();
  }
  return m;
}

// '---' 로 섹션 분리 (탭/공백 들여쓰기 허용 — synced_block 내부 대응)
function sections(content) {
  return cleanText(content)
    .split(/\n[ \t]*-{3,}[ \t]*\n/)
    .map(s => s.split('\n').map(l => l.trim()).filter(Boolean));
}

// 본문(라벨/헤더가 아닌 줄)만 추출
function descLines(allLines) {
  return allLines.filter(l =>
    l && !/^\*\*.+?[:：]\*\*/.test(l) && !/^\*[^*].*\*$/.test(l));
}

// ─────────────────────────── SPELL ───────────────────────────
export function parseSpell(raw) {
  const secs = sections(raw.content);
  const flat = secs.flat();
  const lm = labelMap(flat);
  // 학파/레벨 헤더: 첫 *...* 줄
  let school = null, level = null;
  for (const l of flat) {
    const h = l.match(/^\*([^*]+)\*$/);
    if (h) {
      const txt = h[1];
      const sk = Object.keys(SCHOOL_KO2EN).find(k => txt.includes(k));
      if (sk) school = SCHOOL_KO2EN[sk];
      if (/소마법/.test(txt)) level = 0;
      else { const lv = txt.match(/(\d+)\s*레벨/); if (lv) level = +lv[1]; }
      if (school || level !== null) break;
    }
  }
  // 사거리/범위
  let range = null, area = null;
  if (lm['사거리/범위']) { const [r, a] = lm['사거리/범위'].split('/'); range = (r || '').trim(); area = (a || '').trim() || null; }
  // 구성요소: 음성/동작/물질 + 재료
  const compRaw = lm['구성요소'] || '';
  const comp = { v: /음성/.test(compRaw), s: /동작/.test(compRaw), m: /물질/.test(compRaw) };
  const matM = compRaw.match(/\(([^)]+)\)/); const material = matM ? matM[1] : null;
  // 지속시간 + 집중
  const dur = lm['지속시간'] || null;
  const concentration = /집중/.test(dur || '');
  const ritual = /의식/.test(lm['시전시간'] || '');
  // 클래스
  const classes = lm['클래스'] ? lm['클래스'].split(/[,،、]/).map(s => s.trim()).filter(Boolean) : [];
  // desc: 헤더 다음 섹션, 라벨/클래스/고등 제외
  const desc = descLines(flat).join('\n');
  return {
    id: raw.id, en: raw.en, ko: raw.ko, kind: 'spell',
    level, school,
    castTime: lm['시전시간'] || null,
    ritual,
    range, area,
    components: comp, material,
    duration: dur, concentration,
    higher: lm['고등 시전'] || null,
    classes,
    desc,
    source: raw.properties?.출처 || [],
  };
}

// ─────────────────────────── WEAPON / ARMOR / GEAR ───────────────────────────
const WEAPON_TYPE_RE = /무기/;
const ARMOR_TYPE_RE = /(경갑|평갑|중갑|판금|방패|갑옷)/;

export function parseEquipment(raw) {
  const p = raw.properties || {};
  const types = p.유형 || [];
  const flat = sections(raw.content).flat();
  const lm = labelMap(flat);
  const base = {
    id: raw.id, en: raw.en || p.원문, ko: raw.ko || p.이름,
    value: p.가치 ?? null, weight: p.무게 ?? null,
    typeKo: types, source: p.출처 || [],
    desc: descLines(flat).join('\n'),
  };
  if (types.some(t => WEAPON_TYPE_RE.test(t))) {
    // 피해: "1d8 참격 피해"
    const dmgRaw = lm['피해'] || '';
    const dmgM = dmgRaw.match(/(\d+d\d+|\d+)\s*(\S+?)\s*피해/); // 주사위 또는 고정값(블로건 "1") 허용
    // 속성: "다용도 (1d10), 제압"  (ref 마커 포함 가능)
    const propsRaw = lm['속성'] || '';
    const props = propsRaw.split(/,(?![^(]*\))/).map(s => s.trim()).filter(Boolean)
      .map(s => {
        const label = (s.match(/\{\{ref:[0-9a-f]+\|([^}]+)\}\}/) || [, s.replace(/\(.*\)/, '').trim()])[1];
        const param = (s.match(/\(([^)]+)\)/) || [])[1] || null;
        return { name: label.trim(), param };
      });
    const cat = types.find(t => /군용/.test(t)) ? 'martial' : (types.find(t => /일반|단순/.test(t)) ? 'simple' : null);
    const reach = types.some(t => /근거리|근접/.test(t)) ? 'melee' : (types.some(t => /원거리|장거리/.test(t)) ? 'ranged' : null);
    return { ...base, kind: 'weapon', damage: dmgM ? dmgM[1] : null, damageType: dmgM ? dmgM[2] : null, properties: props, category: cat, range: reach };
  }
  if (types.some(t => ARMOR_TYPE_RE.test(t))) {
    const acRaw = (lm['AC'] || '').trim();
    const acM = acRaw.match(/^([+-]?\d+)/);
    const armorClass = types.some(t => /경갑/.test(t)) ? 'light' : types.some(t => /중갑|판금/.test(t)) ? 'heavy' : types.some(t => /평갑|중형/.test(t)) ? 'medium' : types.some(t => /방패/.test(t)) ? 'shield' : null;
    const isShield = armorClass === 'shield';
    const dexCap = { light: null, medium: 2, heavy: 0, shield: null }[armorClass] ?? null; // null=무제한
    const stealthDis = /은신.*불리|불리.*은신/.test(base.desc);
    const strM = base.desc.match(/근력이?\s*(\d+)\s*미만/);
    const acNum = acM ? +acM[1] : null;
    return {
      ...base, kind: 'armor', armorClass,
      ac: isShield ? null : acNum,        // 기본 갑옷 = AC 기준값
      acBonus: isShield ? acNum : null,   // 방패 = +N 보너스
      dexCap, stealthDisadvantage: stealthDis, strReq: strM ? +strM[1] : null,
    };
  }
  return { ...base, kind: 'gear' };
}

// ─────────────────────────── FEAT ───────────────────────────
export function parseFeat(raw) {
  const p = raw.properties || {};
  const flat = sections(raw.content).flat();
  // 카테고리: 첫 *...* 줄 (예: "기원 재주") 또는 properties.유형
  let catKo = (p.유형 && p.유형[0]) || null;
  for (const l of flat) { const h = l.match(/^\*([^*]+재주)\*$/); if (h) { catKo = h[1].replace('재주', '').trim() || catKo; break; } }
  // 하위 혜택: ***라벨.*** 본문
  const benefits = [];
  for (const l of flat) {
    const b = l.match(/^\*\*\*(.+?)\.?\*\*\*\s*(.*)$/);
    if (b) benefits.push({ name: b[1].trim(), text: b[2].trim() });
  }
  const desc = descLines(flat).filter(l => !/^\*\*\*/.test(l)).join('\n');
  return {
    id: raw.id, en: raw.en || p.원문, ko: raw.ko || p.이름, kind: 'feat',
    categoryKo: catKo,
    prereq: (p.요구사항 || '').trim() || null,
    benefits, desc,
    source: p.출처 || [],
  };
}

// ─────────────────────────── MAGIC ITEM ───────────────────────────
export function parseMagicItem(raw) {
  const p = raw.properties || {};
  const cleaned = cleanText(raw.content);
  const flat = stripTables(cleaned).split('\n').map(l => l.trim()).filter(Boolean);
  const head = flat.find(l => /^\*[^*]+\*$/.test(l)) || '';
  const attunement = p.조율 === '__YES__' || /조율/.test(head);
  // 등급표(있으면): 등급→보너스 매핑
  let tiers = null;
  const t = firstTable(raw.content);
  if (t.length > 1 && /등급|보너스/.test(t[0].join(''))) tiers = t.slice(1).map(r => ({ rarity: r[0], value: r[1] }));
  const desc = flat.filter(l => l !== head && !/^\*\*.+?[:：]/.test(l)).join('\n');
  return {
    id: raw.id, en: raw.en || p.원문, ko: raw.ko || p.이름, kind: 'magic-item',
    rarity: p.등급 || [], itemType: p.유형 || [], attunement, tiers, desc,
    source: p.참조 || p.출처 || [],
  };
}

// ─────────────────────────── SPECIES (종족) ───────────────────────────
// 구조: 설정 산문 → ## 혈통 섹션(있으면) → ## ...특성 (라벨 크리처유형/체격/속도 + ### 특성 + 혈통표)
export function parseSpecies(raw) {
  const p = raw.properties || {};
  const cleaned = cleanText(raw.content);
  const lab = (name) => { const m = cleaned.match(new RegExp(`\\*\\*${name}\\s*[:：]\\s*\\*\\*\\s*([^\\n{<]+)`)); return m ? m[1].trim() : null; };
  const creatureType = lab('크리처 유형');
  const sizeRaw = lab('체격') || lab('크기');
  const size = sizeRaw ? ((sizeRaw.match(/(초소형|소형|중형|대형|거대형)/) || [])[1] || sizeRaw) : null;
  const speedM = cleaned.match(/\*\*속도\s*[:：]\s*\*\*\s*(\d+)\s*ft/) || cleaned.match(/속도[가는은이]?\s*(\d+)\s*ft/);
  const darkM = cleaned.match(/(\d+)\s*ft\s*범위의\s*\{\{ref:[^|]*\|암시야/) || cleaned.match(/암시야[\s\S]{0,30}?(\d+)\s*ft/);
  const lifeM = cleaned.match(/수명[은는]?\s*(?:약\s*)?(\d+)\s*년/);
  // ### 특성 추출 (h3 헤더 = 종족 특성)
  const traits = [];
  for (const part of cleaned.split(/^###\s+/m).slice(1)) {
    const nl = part.indexOf('\n');
    const name = (nl < 0 ? part : part.slice(0, nl)).replace(/\{[^}]*\}/g, '').trim();
    let body = (nl < 0 ? '' : part.slice(nl + 1));
    body = stripTables(body).split(/^##\s+/m)[0].trim();
    traits.push({ name, text: body });
  }
  // ## 혈통 섹션 (특성 섹션 제외) — 혈통 표는 raw 보존(복잡), 여기선 이름/설명만
  const lineages = [];
  for (const part of cleaned.split(/^##\s+/m).slice(1)) {
    const nl = part.indexOf('\n'); const name = (nl < 0 ? part : part.slice(0, nl)).replace(/\{[^}]*\}/g, '').trim();
    if (/특성$/.test(name)) continue;
    lineages.push({ name, desc: stripTables(nl < 0 ? '' : part.slice(nl + 1)).split(/^###\s+/m)[0].trim() });
  }
  return {
    id: raw.id, en: raw.en || p.원문, ko: raw.ko || p.이름, kind: 'species',
    creatureType: creatureType || null, size: size || null,
    speed: speedM ? +speedM[1] : null, darkvision: darkM ? +darkM[1] : null,
    lifespan: lifeM ? +lifeM[1] : null,
    traits, lineages,
    source: p.출처 || p.참조 || [],
  };
}

// ─────────────────────────── MONSTER (기본 스탯블록) ───────────────────────────
const ABIL_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export function parseMonster(raw) {
  const p = raw.properties || {};
  const cleaned = cleanText(raw.content);
  // 헤더: *중형 드래곤 (색채), 질서 악*
  const head = (cleaned.match(/^\*([^*]+)\*/) || [, ''])[1];
  const hm = head.match(/^(\S+)\s+([^,(]+?)(?:\s*\(([^)]*)\))?\s*,\s*(.+)$/);
  // 불릿/라벨 스탯
  const g = (re) => { const m = cleaned.match(re); return m ? m[1].trim() : null; };
  const ac = g(/AC[:：]\s*\**\s*(\d+)/);
  const hpM = cleaned.match(/HP[:：]\s*\**\s*(\d+)\s*(?:\(([^)]*)\))?/);
  const speed = g(/속도[:：]\s*\**\s*([^\n]+?)(?:\s*\{|$)/m);
  const init = g(/선제권[:：]\s*\**\s*([+\-]?\d+)/);
  // 능력치 표 (첫 표: 라벨행 + 점수행 + 수정치행)
  const abilities = {};
  const t = firstTable(raw.content);
  if (t.length >= 2 && /근력/.test(t[0].join(''))) {
    const scores = t[1]; ABIL_ORDER.forEach((k, i) => { if (scores[i] != null) abilities[k] = +scores[i] || scores[i]; });
  }
  return {
    id: raw.id, en: raw.en || p.원문, ko: raw.ko || p.이름, kind: 'monster',
    cr: p.도전지수 ?? null,
    size: (p.크기 && p.크기[0]) || (hm && hm[1]) || null,
    creatureType: p.종족 || (hm ? [hm[2].trim()] : []),
    alignment: hm ? hm[4].trim() : null,
    ac: ac ? +ac : null, hp: hpM ? +hpM[1] : null, hpFormula: hpM ? (hpM[2] || null) : null,
    speed, initiative: init ? +init : null, abilities,
    habitat: p.서식지 || [], treasure: p.보물 || [],
    desc: stripTables(cleaned).replace(/^\*[^*]+\*/, '').trim(),
    source: p.출처 || [],
  };
}

// ─────────────────────────── CLASS / SUBCLASS ───────────────────────────
// 구조: # 핵심 특징(header-column 표) → ## 클래스 성장(레벨 진행표) → ## N레벨: 특성 → # 서브클래스
export function parseClass(raw) {
  const p = raw.properties || {};
  const c = raw.content;
  const isSub = raw.tag === 'Subclass';
  const tabs = [...c.matchAll(/<table[\s\S]*?<\/table>/g)].map(m => m[0]);
  // 핵심 특징 표: 첫 행에 '주요 능력치' 또는 '히트 다이스' 포함하는 header-column 표
  const core = {};
  let coreTbl = tabs.find(t => /주요 능력치|히트 다이스/.test(parseTable(t).flat().slice(0, 4).join('')));
  if (coreTbl) for (const row of parseTable(coreTbl)) if (row.length >= 2) core[row[0].replace(/\*/g, '').trim()] = row.slice(1).join(' ').trim();
  // 레벨 진행표: 헤더에 '레벨'/'숙련 보너스' 포함
  const lvlTbl = tabs.find(t => { const r = parseTable(t); return r[0] && /레벨|숙련 보너스/.test(r[0].join('')) && t !== coreTbl; });
  const levelTable = lvlTbl ? parseTable(lvlTbl) : null;
  // ## N레벨: 명칭 특성 섹션
  const features = [];
  for (const part of cleanText(c).split(/^##\s+/m).slice(1)) {
    const nl = part.indexOf('\n'); const hdr = (nl < 0 ? part : part.slice(0, nl)).replace(/\*/g, '').trim();
    const lm = hdr.match(/^(\d+)\s*레벨\s*[:：]\s*(.+)$/);
    if (lm) { const body = stripTables(nl < 0 ? '' : part.slice(nl + 1)).split(/^#{1,3}\s+/m)[0].trim(); features.push({ level: +lm[1], name: lm[2].trim(), text: body }); }
  }
  const hd = (core['히트 다이스'] || '').match(/d(\d+)/i);
  return {
    id: raw.id, en: raw.en || p.원문, ko: raw.ko || p.이름,
    kind: isSub ? 'subclass' : 'class',
    hitDie: hd ? +hd[1] : null,
    primaryAbility: core['주요 능력치'] || null,
    savingThrows: core['내성 굴림'] || null,
    skillProf: core['기술 숙련'] || null,
    weaponProf: core['무기 숙련'] || null,
    armorProf: core['방어구 훈련'] || core['방어구 숙련'] || null,
    startingEquipment: core['시작 장비'] || null,
    levelTable, features,
    source: p.출처 || [],
  };
}

// ─────────────────────────── RULE / DOC ───────────────────────────
// 규칙 용어집·게임플레이·기본사항 등 — 단순 설명 페이지 (툴팁/상호참조 소스)
export function parseRule(raw) {
  return {
    id: raw.id, en: raw.en, ko: raw.ko, kind: 'rule',
    category: raw.category,
    desc: cleanText(raw.content),
    source: raw.properties?.출처 || [],
  };
}

// ─────────────────────────── BACKGROUND (캐릭터 기원) ───────────────────────────
// "Background Descriptions" 한 페이지에 4개 번들(# 군인/귀족/범죄자/학자). 배열 반환.
// 그 외 기원 카테고리 페이지(안내/종족중복)는 doc로.
export function parseBackground(raw) {
  // 실제 배경 번들만 분리 (종족 중복 번들 'Species Descriptions' 등은 문서로)
  if (raw.en !== 'Background Descriptions') return parseRule(raw);
  const c = raw.content;
  const p = raw.properties || {};
  const refsOf = (s) => s ? [...s.matchAll(/\{\{ref:[0-9a-f]+\|([^}]+)\}\}/g)].map(m => m[1]) : [];
  const out = [];
  for (const seg of cleanText(c).split(/^#\s+/m).slice(1)) {
    const nl = seg.indexOf('\n'); const name = (nl < 0 ? seg : seg.slice(0, nl)).trim();
    if (!name || /설명$/.test(name)) continue;
    const lines = (nl < 0 ? '' : seg.slice(nl + 1)).split('\n').map(l => l.trim());
    const lm = {}; for (const l of lines) { const m = l.match(/^\*\*(.+?)\s*[:：]\s*\*\*\s*(.*)$/); if (m) lm[m[1].trim()] = m[2].trim(); }
    out.push({
      id: raw.id + '#' + name, en: null, ko: name, kind: 'background',
      abilityScores: (lm['능력 점수'] || '').split(/[,，、]/).map(s => s.trim()).filter(Boolean),
      originFeat: refsOf(lm['재주'])[0] || null,
      skillProf: refsOf(lm['기술 숙련']),
      toolProf: lm['도구 숙련'] || null,
      equipment: lm['장비'] || null,
      desc: lines.filter(l => l && !/^\*\*.+?[:：]/.test(l)).join('\n').trim(),
      source: p.출처 || [],
    });
  }
  return out;
}

// ─────────────────────────── 디스패치 ───────────────────────────
// 아직 전용 파서가 없는 카테고리(크롤 진행 중이거나 구조 복잡): 'pending'으로 카운트.
const PENDING_CATS = new Set([]);
const DOC_CATS = new Set(['규칙 용어집', '게임 플레이', '기본 사항', '캐릭터 만들기', 'DM의 도구상자', '추적 시트', '크리처 스텟 블록', '몬스터 사용법']);

export function parseRecord(raw) {
  switch (raw.category) {
    case '주문': return parseSpell(raw);
    case '장비': return parseEquipment(raw);
    case '재주': return parseFeat(raw);
    case '마법 아이템': return parseMagicItem(raw);
    case '종족': return parseSpecies(raw);
    case '몬스터': return parseMonster(raw);
    case '캐릭터 클래스': return parseClass(raw);
    case '캐릭터 기원': return parseBackground(raw);
  }
  if (DOC_CATS.has(raw.category)) return parseRule(raw);
  if (PENDING_CATS.has(raw.category)) return { id: raw.id, en: raw.en, ko: raw.ko, kind: 'pending', category: raw.category };
  return { id: raw.id, en: raw.en, ko: raw.ko, kind: 'unparsed', category: raw.category };
}
