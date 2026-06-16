/* Candlekeep Sheet — 초기화 + 이벤트 + 저장 */

const LS_KEY = 'candlekeep_char';
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {} }, 400); }
function load() { try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (s && s.abilities) state = Object.assign(newCharacter(), s); } catch {} }

function setTab(id) { activeTab = id; render(); window.scrollTo(0, 0); }

// 탭 전환 (헤더 탭 + 모바일 하단)
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) { setTab(tabBtn.dataset.tab); return; }

  // 주문 추가/제거
  const sp = e.target.closest('[data-spell]');
  if (sp) {
    const id = sp.dataset.spell, i = state.spells.findIndex(x => String(x.id) === String(id));
    if (i >= 0) state.spells.splice(i, 1); else state.spells.push({ id, prepared: true });
    save(); render(); return;
  }
  // 재주 추가/제거
  const ft = e.target.closest('[data-feat]');
  if (ft) {
    const id = ft.dataset.feat, i = state.feats.findIndex(x => String(x) === String(id));
    if (i >= 0) state.feats.splice(i, 1); else state.feats.push(id);
    save(); render(); return;
  }
  // 장비 추가
  const ae = e.target.closest('[data-add-equip]');
  if (ae) { state.inventory.push({ id: ae.dataset.addEquip, qty: 1, equipped: false }); save(); render(); return; }
  // 장비 장착 토글
  const eq = e.target.closest('[data-equip-idx]');
  if (eq) { const it = state.inventory[+eq.dataset.equipIdx]; if (it) it.equipped = !it.equipped; save(); render(); return; }
  // 장비 제거
  const rm = e.target.closest('[data-rm-idx]');
  if (rm) { state.inventory.splice(+rm.dataset.rmIdx, 1); save(); render(); return; }
});

// 입력 변경 (빌더/HP/이름)
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'charName') { state.name = t.value; save(); return; }
  if (t.id === 'b-level') { state.level = Math.min(20, Math.max(1, +t.value || 1)); save(); render(); return; }
  if (t.id === 'b-class') { state.classId = t.value || null; state.subclassId = null; save(); render(); return; }
  if (t.id === 'b-subclass') { state.subclassId = t.value || null; save(); render(); return; }
  if (t.id === 'b-species') { state.speciesId = t.value || null; save(); render(); return; }
  if (t.id === 'b-background') { state.backgroundId = t.value || null; save(); render(); return; }
  if (t.dataset.abil) { state.abilities[t.dataset.abil] = Math.min(30, Math.max(1, +t.value || 10)); save(); render(); return; }
  if (t.dataset.save) { state.saveProf[t.dataset.save] = t.checked; save(); render(); return; }
  if (t.dataset.skill) { if (t.value) state.skillProf[t.dataset.skill] = t.value; else delete state.skillProf[t.dataset.skill]; save(); render(); return; }
  if (t.id === 'hp-cur') { state.hpCurrent = +t.value; save(); return; }
  if (t.id === 'hp-temp') { state.hpTemp = +t.value || 0; save(); return; }
});

// 검색 (주문/재주/장비) — 라이브 필터, 리렌더 없이 부분 갱신
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'spell-search') {
    const cls = getClass(state.classId), clsKo = cls && cls.ko;
    let pool = clsKo ? DB.spells.filter(s => (s.classes || []).some(c => c.includes(clsKo))) : DB.spells;
    const known = new Set(state.spells.map(x => String(x.id)));
    document.getElementById('spell-list').innerHTML = spellListHTML(pool, known, t.value.trim());
  } else if (t.id === 'feat-search') {
    const q = t.value.trim(), mine = new Set(state.feats.map(String));
    const f = q ? DB.feats.filter(x => (x.ko || '').includes(q) || (x.en || '').toLowerCase().includes(q.toLowerCase())) : DB.feats.slice(0, 30);
    document.getElementById('feat-list').innerHTML = f.map(x => featRow(x, mine.has(String(x.id)))).join('') || '<div class="muted">결과 없음</div>';
  } else if (t.id === 'equip-search') {
    document.getElementById('equip-list').innerHTML = equipListHTML(t.value.trim());
  } else if (t.id === 'charName') { state.name = t.value; save(); }
});

function wireView() { /* 위임 처리로 추가 배선 불필요 */ }

// 부팅
load();
document.getElementById('charName').value = state.name;
render();
