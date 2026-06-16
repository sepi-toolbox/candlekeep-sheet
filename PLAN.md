# Candlekeep Sheet — 프로젝트 계획

D&D Beyond 형태의 **D&D 5e (2024) 한국어 웹 캐릭터 시트**.
데이터 = 노션 「캔들킵」, 아키텍처 참조 = Pathforge(PF2e 빌더, `sepi-toolbox/PF2e`).

## 목표
핸드폰/PC에서 캐릭터 생성·관리. 클래스/종족/배경/재주/주문/장비 선택 → 자동 계산(AC·내성·명중·주문슬롯) → 클라우드 저장.

## 데이터 출처 (노션 워크스페이스 「캔들킵」)
- glossary.json: **1217 항목 이름+ID 인덱스 이미 추출 완료**(주문339/장비186/마법아이템182/몬스터177/재주75/클래스60/종족10…)
- 각 항목 = 노션 페이지. **기계 데이터는 페이지 본문**(반정형 `**라벨:**` 마커) + properties(장비/재주 컬럼).
- 출처 컬렉션 ID는 `_glossary/candlekeep/README.md`·`crawl-state.json` 참조.

## 아키텍처 결정 (기본값 — Pathforge 미러)
| 항목 | 선택 | 이유 |
|---|---|---|
| 스택 | 바닐라 HTML/JS, 빌드 무, GitHub Pages | Pathforge 검증됨, cs_session/cs_dice/cs_save 패턴 재사용 |
| 저장 | Firebase(Firestore + Google OAuth) | 멀티슬롯/세션 코드 재사용 (별도 프로젝트로 격리 권장) |
| DB | 분리 JS 파일 + id FK + `{{ref}}` 상호참조 | Pathforge DB 정규화 패턴 |
| 배포 | 새 repo `sepi-toolbox/candlekeep-sheet`, dev/ 우선 | Pathforge 운영/dev 분리 관습 |
| UI | 다크+골드 테마, 탭 + 모바일 하단 네비 | Pathforge 반응형(600/900px 분기) |

## 로드맵

### Phase 0 — 기반 착수 ✅(이번 세션)
- [x] Pathforge 아키텍처 분석 / 노션 데이터 인벤토리 / 페이지 구조 파악
- [x] 프로젝트 스켈레톤(`/Users/sepi/candlekeep-sheet`)
- [x] `SCHEMA.md` 데이터 모델 / `tools/parse.mjs` 파서 / 파일럿 4유형 검증

### Phase 1 — 데이터 추출 (다음 — 대량, Workflow 권장)
페이지별 `notion-fetch` → `data/raw/<cat>/<id>.json` → `node tools/build.mjs` → `data/db/*.json`.
- 규모: 플레이어 콘텐츠 ~860 페이지(몬스터/DM 제외). 카테고리별 서브에이전트 분할.
- ⚠️ 노션 MCP 레이트리밋: 동시 3~4개, crawl-state로 재개(캔들킵 크롤 경험 메모리 참조).
- 카테고리별 파서 확장: 주문/무기/갑옷/재주 ✅, 클래스(레벨 테이블)·종족·배경·마법아이템 추가.
- 검증: id parity, `{{ref}}` 무결성, 미파싱 0, 샘플 수동 대조.

### Phase 2 — 계산 엔진 + 앱 셸
- state 모델(능력치/숙련/레벨/선택), `recalcAll()`(AC·내성·명중·주문슬롯·HP) — Pathforge cs_calc 패턴
- 앱 셸 + 탭 + 모바일 네비 + 다크골드 테마(Pathforge CharacterSheet.html 차용)

### Phase 3 — 캐릭터 빌더
클래스/종족/배경/재주/주문/장비 선택 모달 + 레벨업. Pathforge 모달/성장계획 패턴.

### Phase 4 — 클라우드 저장 + 배포
Firebase 연동(cs_save/cs_session 차용), 멀티슬롯, GitHub Pages 배포.

## 현재 산출물
```
candlekeep-sheet/
  SCHEMA.md, PLAN.md
  tools/parse.mjs        # 노션 페이지 → 레코드 (주문/무기/갑옷/재주 검증됨)
  data/raw/_pilot/*.json # 파일럿 4페이지
  data/raw/<cat>/        # (Phase 1 채움)
  data/db/               # (Phase 1 산출)
  web/                   # (Phase 2~)
```
