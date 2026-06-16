/* Candlekeep Sheet — 계산 엔진 (D&D 5e 2024) */

const mod = (score) => Math.floor((score - 10) / 2);
const sgn = (n) => (n >= 0 ? '+' : '') + n;
const profBonus = (level) => 2 + Math.floor((Math.max(1, level) - 1) / 4);

// 능력치 수정치 맵
function abilityMods() {
  const m = {};
  for (const a of ABILITIES) m[a] = mod(state.abilities[a] || 10);
  return m;
}

// 내성 굴림: 능력치 mod + (숙련 시 prof)
function saveBonus(ability) {
  const pb = profBonus(state.level);
  return mod(state.abilities[ability] || 10) + (state.saveProf[ability] ? pb : 0);
}

// 기술 보너스: 관장 능력치 mod + 숙련(prof=1×, expert=2×)
function skillBonus(skill) {
  const pb = profBonus(state.level);
  const base = mod(state.abilities[skill.ability] || 10);
  const p = state.skillProf[skill.id];
  return base + (p === 'expert' ? 2 * pb : p === 'prof' ? pb : 0);
}

const passivePerception = () => 10 + skillBonus(SKILLS.find(s => s.id === 'perception'));
const initiative = () => mod(state.abilities.dex);

// 장착 갑옷/방패 기반 AC
function armorClass() {
  const dex = mod(state.abilities.dex);
  let base = 10 + dex, label = '비무장';
  const wornArmor = state.inventory.map(i => ({ i, e: getEquip(i.id) }))
    .find(x => x.i.equipped && x.e && x.e.kind === 'armor' && x.e.armorClass !== 'shield');
  if (wornArmor) {
    const a = wornArmor.e;
    const cap = a.dexCap; // null=무제한, 숫자=상한, 0=없음
    const dexPart = cap == null ? dex : Math.min(dex, cap);
    base = (a.ac || 10) + dexPart;
    label = a.ko;
  }
  // 방패
  const shield = state.inventory.map(i => ({ i, e: getEquip(i.id) }))
    .find(x => x.i.equipped && x.e && x.e.kind === 'armor' && x.e.armorClass === 'shield');
  let bonus = 0;
  if (shield) { bonus = shield.e.acBonus || 2; label += ' + ' + shield.e.ko; }
  return { value: base + bonus, label };
}

// HP: 1레벨 = 히트다이스 최대 + conMod, 이후 레벨 = (히트다이스 평균+1) + conMod
function maxHP() {
  const cls = getClass(state.classId);
  const conMod = mod(state.abilities.con);
  if (!cls || !cls.hitDie) return 0;
  const die = cls.hitDie;
  const lv = state.level;
  const first = die + conMod;
  const perLevel = Math.floor(die / 2) + 1 + conMod;
  return Math.max(1, first + (lv - 1) * perLevel);
}

// 시전 능력치 (클래스 기반)
function castingAbility() {
  const cls = getClass(state.classId);
  return cls ? CASTING_ABILITY[cls.ko] || null : null;
}
function spellSaveDC() {
  const ab = castingAbility(); if (!ab) return null;
  return 8 + profBonus(state.level) + mod(state.abilities[ab]);
}
function spellAttack() {
  const ab = castingAbility(); if (!ab) return null;
  return profBonus(state.level) + mod(state.abilities[ab]);
}

// 무기 명중/피해: 근거리=근력(필요시 교묘 민첩), 원거리=민첩
function weaponAttack(equip) {
  const pb = profBonus(state.level);
  const dexM = mod(state.abilities.dex), strM = mod(state.abilities.str);
  const finesse = (equip.properties || []).some(p => /교묘|민첩|finesse/i.test(p.name));
  const ranged = equip.range === 'ranged';
  const useDex = ranged || (finesse && dexM > strM);
  const abilMod = useDex ? dexM : strM;
  // 숙련은 일단 항상 적용(추후 클래스 무기숙련 반영)
  return { hit: pb + abilMod, dmg: `${equip.damage || '-'}${abilMod ? sgn(abilMod) : ''} ${equip.damageType || ''}`.trim() };
}

// 종합 파생값
function derived() {
  const m = abilityMods();
  return {
    mods: m, pb: profBonus(state.level),
    ac: armorClass(), hp: maxHP(),
    init: initiative(), passivePerc: passivePerception(),
    saves: Object.fromEntries(ABILITIES.map(a => [a, saveBonus(a)])),
    skills: Object.fromEntries(SKILLS.map(s => [s.id, skillBonus(s)])),
    speed: getSpecies(state.speciesId)?.speed || 30,
    spellDC: spellSaveDC(), spellAtk: spellAttack(), castAbility: castingAbility(),
  };
}
