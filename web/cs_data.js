/* Candlekeep Sheet — D&D 5e (2024) 상수 + 상태 모델 */

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_KO = { str: '근력', dex: '민첩', con: '건강', int: '지능', wis: '지혜', cha: '매력' };

// 기술 18종 (Candlekeep 한국어명 → 관장 능력치)
const SKILLS = [
  { id: 'acrobatics', ko: '곡예', ability: 'dex' },
  { id: 'animal', ko: '동물 조련', ability: 'wis' },
  { id: 'arcana', ko: '비전', ability: 'int' },
  { id: 'athletics', ko: '운동', ability: 'str' },
  { id: 'deception', ko: '기만', ability: 'cha' },
  { id: 'history', ko: '역사', ability: 'int' },
  { id: 'insight', ko: '통찰', ability: 'wis' },
  { id: 'intimidation', ko: '위협', ability: 'cha' },
  { id: 'investigation', ko: '수사', ability: 'int' },
  { id: 'medicine', ko: '의학', ability: 'wis' },
  { id: 'nature', ko: '자연', ability: 'int' },
  { id: 'perception', ko: '포착', ability: 'wis' },
  { id: 'performance', ko: '공연', ability: 'cha' },
  { id: 'persuasion', ko: '설득', ability: 'cha' },
  { id: 'religion', ko: '종교', ability: 'int' },
  { id: 'sleight', ko: '손속임', ability: 'dex' },
  { id: 'stealth', ko: '은신', ability: 'dex' },
  { id: 'survival', ko: '생존', ability: 'wis' },
];

// 주문 레벨 라벨
const SPELL_LEVEL_KO = ['소마법', '1레벨', '2레벨', '3레벨', '4레벨', '5레벨', '6레벨', '7레벨', '8레벨', '9레벨'];

// 시전 능력치 추정 (클래스 한국어명 → 능력치)
const CASTING_ABILITY = {
  '바드': 'cha', '클레릭': 'wis', '드루이드': 'wis', '팔라딘': 'cha', '레인저': 'wis',
  '소서러': 'cha', '워락': 'cha', '위저드': 'int',
};

// 신규 캐릭터 기본 상태
function newCharacter() {
  return {
    name: '새 캐릭터',
    level: 1,
    classId: null, subclassId: null, speciesId: null, backgroundId: null,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    skillProf: {},          // skillId → 'prof' | 'expert'
    saveProf: {},           // ability → true
    hpCurrent: null, hpTemp: 0, hpRolled: null,
    inventory: [],          // {id, qty, equipped}
    spells: [],             // {id, prepared}
    feats: [],              // feat id
    notes: '',
  };
}

let state = newCharacter();

// DB 조회 헬퍼 (window.DB)
const byId = (arr, id) => arr.find(x => String(x.id).replace(/-/g, '') === String(id).replace(/-/g, ''));
const getClass = id => byId(DB.classes, id);
const getSubclass = id => byId(DB.subclasses, id);
const getSpecies = id => byId(DB.species, id);
const getBackground = id => DB.backgrounds.find(b => b.id === id);
const getSpell = id => byId(DB.spells, id);
const getFeat = id => byId(DB.feats, id);
const allEquip = () => [...DB.weapons, ...DB.armor, ...DB.gear, ...DB.magicItems];
const getEquip = id => byId(allEquip(), id);
