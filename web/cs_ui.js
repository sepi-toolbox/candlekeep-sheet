/* Candlekeep Sheet — 렌더링 + 빌더 UI */

const TABS = [
  { id: 'build', ko: '빌더', ic: '🛠' },
  { id: 'abilities', ko: '능력', ic: '📊' },
  { id: 'combat', ko: '전투', ic: '⚔️' },
  { id: 'spells', ko: '주문', ic: '✨' },
  { id: 'features', ko: '특성', ic: '⭐' },
  { id: 'inventory', ko: '장비', ic: '🎒' },
];
let activeTab = 'build';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// {{ref:id|label}} → 골드 span (별표 이탤릭 제거)
const refs = (s) => esc(s || '').replace(/\{\{ref:[0-9a-f]+\|([^}]+)\}\}/g, (_, l) => `<span class="ref">${esc(l.replace(/^\*+|\*+$/g, ''))}</span>`);

// ───────── 헤더 / 탭 ─────────
function renderShell() {
  document.getElementById('tabs').innerHTML = TABS.map(t =>
    `<button class="tab ${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}">${t.ko}</button>`).join('');
  document.getElementById('bnav').innerHTML = TABS.map(t =>
    `<button class="${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}"><span class="ic">${t.ic}</span>${t.ko}</button>`).join('');
}
function renderHeader() {
  const d = derived();
  const cls = getClass(state.classId), sp = getSpecies(state.speciesId);
  document.getElementById('charMeta').textContent =
    [sp && sp.ko, cls && cls.ko, `${state.level}레벨`].filter(Boolean).join(' · ') || '미설정';
  const stats = [
    ['AC', d.ac.value], ['HP', d.hp || '-'], ['선제권', sgn(d.init)],
    ['속도', d.speed + 'ft'], ['숙련', sgn(d.pb)], ['수동 감지', d.passivePerc],
  ];
  if (d.spellDC) stats.push(['주문 DC', d.spellDC], ['주문 명중', sgn(d.spellAtk)]);
  document.getElementById('statbar').innerHTML = stats.map(([l, v]) =>
    `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');
}

// ───────── 빌더 ─────────
function tabBuild() {
  const opt = (arr, sel, fmt) => arr.map(x => `<option value="${x.id}" ${String(x.id) === String(sel) ? 'selected' : ''}>${esc(fmt(x))}</option>`).join('');
  const cls = getClass(state.classId);
  const subs = cls ? DB.subclasses.filter(s => true) : []; // 서브클래스 전체(클래스 연결 정보 부재 → 전체 노출)
  let h = `<div class="card"><h2>기본</h2>
    <div class="field"><label>레벨 (1–20)</label><input type="number" min="1" max="20" id="b-level" value="${state.level}"></div>
    <div class="field"><label>클래스</label><select id="b-class"><option value="">— 선택 —</option>${opt(DB.classes, state.classId, c => `${c.ko} (${c.en}) · d${c.hitDie || '?'}`)}</select></div>
    <div class="field"><label>서브클래스</label><select id="b-subclass"><option value="">— 선택 —</option>${opt(DB.subclasses, state.subclassId, s => `${s.ko}`)}</select></div>
    <div class="field"><label>종족</label><select id="b-species"><option value="">— 선택 —</option>${opt(DB.species, state.speciesId, s => `${s.ko} (${s.en})`)}</select></div>
    <div class="field"><label>배경</label><select id="b-background"><option value="">— 선택 —</option>${DB.backgrounds.map(b => `<option value="${b.id}" ${b.id === state.backgroundId ? 'selected' : ''}>${esc(b.ko)}</option>`).join('')}</select></div>
  </div>`;

  if (cls) {
    h += `<div class="card"><h2>${esc(cls.ko)} 핵심</h2>
      <div class="line"><span class="muted">히트 다이스</span><span>d${cls.hitDie}</span></div>
      <div class="line"><span class="muted">주요 능력치</span><span>${esc(cls.primaryAbility || '-')}</span></div>
      <div class="line"><span class="muted">내성 굴림</span><span>${esc(cls.savingThrows || '-')}</span></div>
      <div class="line"><span class="muted">무기 숙련</span><span>${refs(cls.weaponProf || '-')}</span></div>
      <div class="line"><span class="muted">방어구 훈련</span><span>${refs(cls.armorProf || '-')}</span></div>
      <div class="line"><span class="muted">기술 숙련</span><span style="text-align:right;max-width:60%">${refs(cls.skillProf || '-')}</span></div>
    </div>`;
  }

  // 능력치
  h += `<div class="card"><h2>능력치</h2><div class="abils">` + ABILITIES.map(a =>
    `<div class="abil"><div class="name">${ABILITY_KO[a]}</div><div class="mod">${sgn(mod(state.abilities[a]))}</div>
      <input type="number" min="1" max="30" data-abil="${a}" value="${state.abilities[a]}"></div>`).join('') + `</div></div>`;

  // 내성/기술 숙련 지정
  h += `<div class="card"><h2>내성 숙련</h2><div class="row">` + ABILITIES.map(a =>
    `<label class="pill" style="padding:5px 8px"><input type="checkbox" class="chk" data-save="${a}" ${state.saveProf[a] ? 'checked' : ''}> ${ABILITY_KO[a]}</label>`).join(' ') + `</div></div>`;

  h += `<div class="card"><h2>기술 숙련</h2>` + SKILLS.map(s =>
    `<div class="line"><span>${esc(s.ko)} <span class="muted">(${ABILITY_KO[s.ability]})</span></span>
      <select data-skill="${s.id}" class="btn sm">
        <option value="">없음</option>
        <option value="prof" ${state.skillProf[s.id] === 'prof' ? 'selected' : ''}>숙련</option>
        <option value="expert" ${state.skillProf[s.id] === 'expert' ? 'selected' : ''}>전문</option>
      </select></div>`).join('') + `</div>`;
  return h;
}

// ───────── 능력/내성/기술 ─────────
function tabAbilities() {
  const d = derived();
  let h = `<div class="card"><h2>능력치</h2><div class="abils">` + ABILITIES.map(a =>
    `<div class="abil"><div class="name">${ABILITY_KO[a]}</div><div class="mod">${sgn(d.mods[a])}</div><div class="muted">${state.abilities[a]}</div></div>`).join('') + `</div></div>`;
  h += `<div class="card"><h2>내성 굴림</h2>` + ABILITIES.map(a =>
    `<div class="line"><span>${ABILITY_KO[a]} ${state.saveProf[a] ? '<span class="pill">숙련</span>' : ''}</span><span class="bonus">${sgn(d.saves[a])}</span></div>`).join('') + `</div>`;
  h += `<div class="card"><h2>기술</h2>` + SKILLS.map(s => {
    const p = state.skillProf[s.id];
    return `<div class="line"><span>${esc(s.ko)} <span class="muted">${ABILITY_KO[s.ability]}</span> ${p ? `<span class="pill">${p === 'expert' ? '전문' : '숙련'}</span>` : ''}</span><span class="bonus">${sgn(d.skills[s.id])}</span></div>`;
  }).join('') + `<div class="line"><span class="muted">수동 감지(포착)</span><span class="bonus">${d.passivePerc}</span></div></div>`;
  return h;
}

// ───────── 전투 ─────────
function tabCombat() {
  const d = derived();
  let h = `<div class="card"><h2>방어</h2>
    <div class="line"><span>AC <span class="muted">(${esc(d.ac.label)})</span></span><span class="bonus">${d.ac.value}</span></div>
    <div class="line"><span>최대 HP</span><span class="bonus">${d.hp}</span></div>
    <div class="row" style="margin-top:6px"><label class="muted">현재 HP</label><input type="number" id="hp-cur" value="${state.hpCurrent == null ? d.hp : state.hpCurrent}" style="width:70px">
      <label class="muted">임시</label><input type="number" id="hp-temp" value="${state.hpTemp}" style="width:60px"></div>
    <div class="line"><span>선제권</span><span class="bonus">${sgn(d.init)}</span></div>
    <div class="line"><span>속도</span><span class="bonus">${d.speed}ft</span></div>
    <div class="line"><span>숙련 보너스</span><span class="bonus">${sgn(d.pb)}</span></div>
  </div>`;
  if (d.spellDC) h += `<div class="card"><h2>주문시전</h2>
    <div class="line"><span>시전 능력치</span><span>${ABILITY_KO[d.castAbility]}</span></div>
    <div class="line"><span>주문 내성 DC</span><span class="bonus">${d.spellDC}</span></div>
    <div class="line"><span>주문 명중</span><span class="bonus">${sgn(d.spellAtk)}</span></div></div>`;
  // 공격 (장착 무기)
  const weps = state.inventory.map(i => getEquip(i.id)).filter(e => e && e.kind === 'weapon');
  h += `<div class="card"><h2>공격</h2>`;
  h += weps.length ? weps.map(w => { const a = weaponAttack(w); return `<div class="line"><span>${esc(w.ko)}</span><span>명중 <b class="bonus">${sgn(a.hit)}</b> · ${esc(a.dmg)}</span></div>`; }).join('')
    : `<div class="muted">장비 탭에서 무기를 추가하세요.</div>`;
  h += `</div>`;
  return h;
}

// ───────── 주문 ─────────
function tabSpells() {
  const cls = getClass(state.classId);
  const d = derived();
  let h = '';
  if (d.spellDC) h += `<div class="card"><div class="row"><span>주문 내성 DC <b class="bonus">${d.spellDC}</b></span><span>주문 명중 <b class="bonus">${sgn(d.spellAtk)}</b></span></div></div>`;
  // 내 클래스 주문 목록
  const clsKo = cls && cls.ko;
  let pool = DB.spells;
  if (clsKo) pool = DB.spells.filter(s => (s.classes || []).some(c => c.includes(clsKo)));
  h += `<input class="search" id="spell-search" placeholder="주문 검색 (${clsKo ? clsKo + ' ' : ''}${pool.length}개)">`;
  const known = new Set(state.spells.map(x => String(x.id)));
  // 알고 있는 주문 먼저
  h += `<div class="card"><h2>준비/습득 (${state.spells.length})</h2>` +
    (state.spells.length ? state.spells.map(x => { const s = getSpell(x.id); return s ? spellRow(s, true) : ''; }).join('') : `<div class="muted">아래 목록에서 주문을 추가하세요.</div>`) + `</div>`;
  h += `<div id="spell-list">` + spellListHTML(pool, known, '') + `</div>`;
  return h;
}
function spellListHTML(pool, known, q) {
  const f = q ? pool.filter(s => (s.ko || '').includes(q) || (s.en || '').toLowerCase().includes(q.toLowerCase())) : pool;
  const byLv = {};
  for (const s of f) (byLv[s.level ?? 0] = byLv[s.level ?? 0] || []).push(s);
  let h = '';
  for (let lv = 0; lv <= 9; lv++) {
    if (!byLv[lv]) continue;
    h += `<h3>${SPELL_LEVEL_KO[lv]} (${byLv[lv].length})</h3>`;
    h += byLv[lv].sort((a, b) => (a.ko || '').localeCompare(b.ko || '')).map(s => spellRow(s, known.has(String(s.id)))).join('');
  }
  return h || `<div class="muted">결과 없음</div>`;
}
function spellRow(s, isKnown) {
  return `<details><summary><span>${esc(s.ko)} <span class="muted">${esc(s.en || '')}</span> ${s.concentration ? '<span class="pill">집중</span>' : ''}${s.ritual ? '<span class="pill">의식</span>' : ''}</span>
    <button class="btn sm ${isKnown ? '' : 'gold'}" data-spell="${s.id}">${isKnown ? '제거' : '추가'}</button></summary>
    <div class="body"><div class="tag">${(s.school || '')} · ${SPELL_LEVEL_KO[s.level ?? 0]} · 시전 ${esc(s.castTime || '-')} · 사거리 ${esc(s.range || '-')}${s.area ? '/' + esc(s.area) : ''} · ${esc(s.duration || '-')}</div>
    <div style="margin-top:6px">${refs(s.desc)}</div>${s.higher ? `<div style="margin-top:6px"><b>고등 시전:</b> ${refs(s.higher)}</div>` : ''}</div></details>`;
}

// ───────── 특성 ─────────
function tabFeatures() {
  const cls = getClass(state.classId), sub = getSubclass(state.subclassId), sp = getSpecies(state.speciesId), bg = getBackground(state.backgroundId);
  let h = '';
  if (cls) {
    const feats = (cls.features || []).filter(f => f.level <= state.level);
    h += `<div class="card"><h2>${esc(cls.ko)} 특성 (≤${state.level}레벨)</h2>` +
      feats.map(f => `<details><summary><span><b>${f.level}레벨</b> · ${esc(f.name)}</span></summary><div class="body">${refs(f.text)}</div></details>`).join('') + `</div>`;
  }
  if (sub) h += `<div class="card"><h2>서브클래스 · ${esc(sub.ko)}</h2>` +
    (sub.features || []).filter(f => f.level <= state.level).map(f => `<details><summary><span><b>${f.level}레벨</b> · ${esc(f.name)}</span></summary><div class="body">${refs(f.text)}</div></details>`).join('') + `</div>`;
  if (sp) h += `<div class="card"><h2>종족 · ${esc(sp.ko)} 특성</h2>` +
    (sp.traits || []).map(t => `<details><summary>${esc(t.name)}</summary><div class="body">${refs(t.text)}</div></details>`).join('') + `</div>`;
  if (bg) h += `<div class="card"><h2>배경 · ${esc(bg.ko)}</h2>
    <div class="line"><span class="muted">능력 점수</span><span>${(bg.abilityScores || []).join(', ')}</span></div>
    <div class="line"><span class="muted">기원 재주</span><span>${esc(bg.originFeat || '-')}</span></div>
    <div class="line"><span class="muted">기술 숙련</span><span>${(bg.skillProf || []).join(', ')}</span></div></div>`;
  // 재주
  const myFeats = new Set(state.feats.map(String));
  h += `<div class="card"><h2>재주 (${state.feats.length})</h2>`;
  h += state.feats.map(id => { const f = getFeat(id); return f ? featRow(f, true) : ''; }).join('');
  h += `<input class="search" id="feat-search" placeholder="재주 검색 (${DB.feats.length}개)" style="margin-top:8px">`;
  h += `<div id="feat-list">${DB.feats.slice(0, 30).map(f => featRow(f, myFeats.has(String(f.id)))).join('')}</div></div>`;
  return h;
}
function featRow(f, mine) {
  return `<details><summary><span>${esc(f.ko)} <span class="muted">${esc(f.categoryKo || '')}</span></span>
    <button class="btn sm ${mine ? '' : 'gold'}" data-feat="${f.id}">${mine ? '제거' : '추가'}</button></summary>
    <div class="body">${f.prereq ? `<div class="muted">필요: ${esc(f.prereq)}</div>` : ''}${(f.benefits || []).map(b => `<div><b>${esc(b.name)}.</b> ${refs(b.text)}</div>`).join('') || refs(f.desc)}</div></details>`;
}

// ───────── 장비 ─────────
function tabInventory() {
  let h = `<div class="card"><h2>소지품 (${state.inventory.length})</h2>`;
  h += state.inventory.length ? state.inventory.map((it, idx) => {
    const e = getEquip(it.id); if (!e) return '';
    const canEquip = e.kind === 'weapon' || e.kind === 'armor';
    return `<div class="line"><span>${esc(e.ko)} ${e.kind === 'weapon' ? `<span class="tag">${esc(e.damage || '')} ${esc(e.damageType || '')}</span>` : ''} ${e.kind === 'armor' ? `<span class="tag">AC ${e.ac ?? '+' + e.acBonus}</span>` : ''}</span>
      <span>${canEquip ? `<button class="btn sm ${it.equipped ? 'gold' : ''}" data-equip-idx="${idx}">${it.equipped ? '장착됨' : '장착'}</button>` : ''}
      <button class="btn sm" data-rm-idx="${idx}">✕</button></span></div>`;
  }).join('') : `<div class="muted">아래에서 장비를 추가하세요.</div>`;
  h += `</div>`;
  h += `<input class="search" id="equip-search" placeholder="장비 검색 (무기/갑옷/장비/마법아이템)">`;
  h += `<div id="equip-list">${equipListHTML('')}</div>`;
  return h;
}
function equipListHTML(q) {
  const pool = allEquip();
  const f = q ? pool.filter(e => (e.ko || '').includes(q) || (e.en || '').toLowerCase().includes(q.toLowerCase())) : pool.slice(0, 40);
  return f.slice(0, 60).map(e => `<div class="line"><span>${esc(e.ko)} <span class="muted">${e.kind === 'weapon' ? '무기' : e.kind === 'armor' ? '갑옷' : e.kind === 'magic-item' ? '마법' : '장비'}</span></span>
    <button class="btn sm gold" data-add-equip="${e.id}">추가</button></div>`).join('') || `<div class="muted">결과 없음</div>`;
}

// ───────── 메인 렌더 ─────────
function render() {
  renderShell(); renderHeader();
  const R = { build: tabBuild, abilities: tabAbilities, combat: tabCombat, spells: tabSpells, features: tabFeatures, inventory: tabInventory };
  document.getElementById('view').innerHTML = (R[activeTab] || tabBuild)();
  if (typeof wireView === 'function') wireView();
}
