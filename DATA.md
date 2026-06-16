# Candlekeep Sheet — 데이터 레이어 (Phase 1 완료)

노션 「캔들킵」(D&D 5e 2024 SRD 한국어) 1217 페이지 → 정규화 DB. `node tools/build.mjs`로 재생성.

## 파이프라인
```
노션 페이지  ──(fetch 워크플로)──>  data/raw/<slug>/<id>.json  ──(build.mjs+parse.mjs)──>  data/db/<kind>.json
                                    (손상분은 <id>.txt 무손실 덤프)              (verify.mjs로 QA)
```
- `tools/parse.mjs` — 페이지 → 구조화 레코드 (카테고리별 파서 + 공통 cleaner/표파서)
- `tools/build.mjs` — raw 전체 파싱 → kind별 `data/db/*.json` + 품질 리포트. glossary로 메타 조인, `.txt` 폴백.
- `tools/verify.mjs` — kind 카운트 + {{ref}} 상호참조 해소율

## DB 산출물 (data/db/, 1219 레코드)
| kind | 수 | kind | 수 |
|---|--:|---|--:|
| spell | 339 | magic-item | 182 |
| monster | 177 | rule | 186 |
| feat | 75 | subclass | 48 |
| weapon | 38 | gear | 135 |
| armor | 13 | class | 12 |
| species | 10 | background | 4 |

품질: 손상 0, 파싱 오류 0, 필수필드 누락 0.

## 레코드 스키마 (핵심 필드)
- **spell**: level, school(EN), castTime, ritual, range, area, components{v,s,m}, material, duration, concentration, higher, classes[], desc
- **weapon**: damage, damageType, properties[{name,param}], category(simple/martial), range(melee/ranged), value, weight
- **armor**: ac | acBonus(방패), armorClass(light/medium/heavy/shield), dexCap, stealthDisadvantage, strReq
- **magic-item**: rarity[], itemType[], attunement, tiers[{rarity,value}]
- **feat**: categoryKo, prereq, benefits[{name,text}]
- **species**: creatureType, size, speed, darkvision, lifespan, traits[{name,text}], lineages[{name,desc}]
- **class/subclass**: hitDie, primaryAbility, savingThrows, skillProf, weaponProf, armorProf, startingEquipment, levelTable[][], features[{level,name,text}]
- **background**: abilityScores[], originFeat, skillProf[], toolProf, equipment
- **monster**: cr, size, creatureType[], alignment, ac, hp, hpFormula, speed, initiative, abilities{str..cha}, habitat[], treasure[]
- **rule**: desc (상태이상/규칙 — 툴팁 소스)
- 공통: id, en, ko, source[]

## 상호참조 {{ref:id|label}}
본문 내 `[용어](/pageid)` → `{{ref:<id>|<label>}}` 보존 (Pathforge `{{condition:X}}` 대응).
**해소율 96.2%** (4770개 중): ID 직접 2527 + 라벨 매핑 1812 + 기술맵 248.
- 같은 개념이 인라인에서 다른 page ID로 링크됨 → **앱 리졸버는 ID→라벨(ko)→기술맵 순 폴백**, 라벨의 이탤릭 `*` 제거.
- 기술 18종은 노션이 단일 "기술 숙련" 페이지로 링크 → 개별 엔트리 없음, 라벨로 식별 (verify.mjs의 SKILLS).
- 잔여 ~4%(일반 "규칙 용어집" 라벨·세부 규칙어·일부 몬스터명)는 평문 폴백.

## 데이터 정정 노트 (정본 재대조로 발견)
- **Conjuration = 창조술** (소환술 아님) — 헤더 실측 8학파 확정
- 손상 26건(에이전트 JSON 수작업 시 `미리보기` 인코딩 URL escape 깨짐) → `.txt` 무손실 재페치로 복구
- 배경은 "Background Descriptions" 한 페이지에 4개 번들 / "Species Descriptions"는 종족 중복 번들(문서 처리)
