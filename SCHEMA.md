# Candlekeep Sheet — 데이터 스키마 (D&D 5e 2024)

노션 「캔들킵」(D&D 5e 2024 SRD 한국어판) → 정규화 DB. Pathforge(PF2e) 아키텍처 차용:
분리된 JS DB 파일, `id` 기반 외래키, 인라인 상호참조 `{{ref:id|label}}` 마커(Pathforge `{{condition:X}}` 대응).

## 공통 규칙
- **PK = 노션 page id**(하이픈 제거). 모든 레코드 `id`/`en`/`ko` 보유.
- **상호참조**: 본문 내 `[용어](/pageid)` → `{{ref:<id>|<label>}}`. UI가 툴팁/링크로 렌더.
- **source**: `["SRD","PHB"]` 등 (장비/재주 properties에 있음; 주문은 본문/컬렉션에서 유도).
- 색상 span/`{color=}` 마커는 파서가 제거. 한↔영 enum 매핑은 `parse.mjs` 상수.

## 1. SPELL (주문, 339) — `db/spells.json`
| 필드 | 출처 | 예 |
|---|---|---|
| `level` | 본문 `*학파 N레벨*`, 소마법=0 | 3 |
| `school` | 본문 학파 → EN enum | Evocation |
| `castTime` | `**시전시간:**` | "1 행동" |
| `ritual` | 시전시간에 "의식" | false |
| `range`,`area` | `**사거리/범위:**` split "/" | "150 ft","20ft 반경" |
| `components`{v,s,m},`material` | `**구성요소:**` | {v,s,m}, "박쥐 구아노…" |
| `duration`,`concentration` | `**지속시간:**`("집중") | "즉시", false |
| `higher` | `**고등 시전:**` | "추가 레벨마다 1d6…" |
| `classes[]` | `**클래스:**` split | ["소서러","위저드"] |
| `desc` | 본문 | … |

## 2. WEAPON (무기, 장비 中 유형~무기) — `db/weapons.json`
`value,weight,typeKo[],source` (properties) + 본문:
`damage`(1d8), `damageType`(참격), `properties[]`{name,param}, `category`(simple/martial), `range`(melee/ranged), `mastery`(2024 — 제압/완력 등, 현재 속성에 혼재 → 분리 예정), `desc`.

## 3. ARMOR (갑옷/방패, 장비 中 유형~갑) — `db/armor.json`
`value,weight,source` + `ac`, `armorClass`(light/medium/heavy/shield), `dexCap`(유형별 규칙: 경갑=∞/평갑=2/중갑=0), `stealthDisadvantage`, `strReq`, `desc`.

## 4. GEAR (기타 장비, 186 中 나머지) — `db/gear.json`
`value,weight,typeKo[],source,desc`. (도구/소모품/탄약/보급품)

## 5. MAGIC ITEM (마법 아이템, 182) — `db/magic-items.json`
`rarity`(유형 tag: 일반/비범/희귀/매우희귀/전설/유물), `attunement`(조율 필요 여부+조건), `itemType`(무기/갑옷/반지/지팡이/물약…), `desc`, `source`.

## 6. FEAT (재주, 75) — `db/feats.json`
| 필드 | 출처 |
|---|---|
| `categoryKo` | 유형 (기원/일반/전투방식/에픽 부여) |
| `prereq` | `요구사항` property |
| `benefits[]`{name,text} | 본문 `***라벨.***` |
| `abilityIncrease` | 본문 능력치 +1 패턴(파생) |
| `desc`,`source` | |

## 7. CLASS (클래스 12, 서브클래스 48 = 60) — `db/classes.json`
큰 페이지. 별도 파서 필요:
- `hitDie`, `primaryAbility[]`, `savingThrows[]`, `proficiencies`{armor,weapon,tool,skills(택N)}
- `startingEquipment`, `subclassLevel`(서브클래스 선택 레벨), `spellcasting`(능력치/준비방식)
- `featureTable[]`: 레벨별 `{level, features[], 슬롯/특성값…}` (Pathforge `CLASS_PROF_TABLE`/`CLASS_FEATURE_NAMES` 대응)
- `subclasses[]`: id 참조 → 별도 `subclasses.json`(featureTable 동일 구조)

## 8. SPECIES (종족 10) — `db/species.json`
`size`, `speed`, `traits[]`{name,text}, `lineages[]`(드래곤본 혈통 등), `darkvision`, `languages`, `desc`.
(아시마르/드래곤본/드워프/엘프/노움/골리앗/하플링/인간/오크/티플링)

## 9. ORIGIN/BACKGROUND (캐릭터 기원 4) — `db/backgrounds.json`
`abilityScores[]`(택), `originFeat`(→feat id), `skillProf[]`, `toolProf[]`, `equipment`, `desc`.

## 10. RULES GLOSSARY (규칙 용어집 129 + 게임플레이/기본 등) — `db/rules.json`
`{id,en,ko,desc}`. 상태이상/조건(`{{ref}}` 타깃) 툴팁 소스. 캐릭터 시트의 condition/툴팁 렌더에 사용.

## 제외 (캐릭터 시트 v1 비포함)
몬스터(177), 몬스터 사용법(2), 크리처 스텟블록(5), DM 도구상자(20) — 플레이어 시트 무관. v2 컴패니언/소환수 필요 시 추가.

## 빌드 산출물 (Pathforge 식 — 앱이 직접 로드)
`db/*.json` → 웹앱에서 `spells_db.js`/`equipment_db.js`/`class_features_db.js` 등으로 묶어 로드(전역 const).
