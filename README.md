# Candlekeep Sheet — D&D 5e (2024) 한국어 캐릭터 시트

D&D Beyond 형태의 웹 기반 D&D 5e (2024) **한국어** 캐릭터 시트. 핸드폰/PC에서 동작.
데이터는 노션 「캔들킵」(D&D 5e 2024 SRD 한국어 번역)에서 추출, 아키텍처는 [Pathforge](https://github.com/sepi-toolbox/PF2e)(PF2e 빌더) 참조.

## 사용

브라우저로 [`web/index.html`](web/index.html)를 열면 됩니다 (오프라인 동작 — fetch 미사용).
배포본: **https://sepi-toolbox.github.io/candlekeep-sheet/web/**

- 빌더 탭에서 레벨·클래스·서브클래스·종족·배경·능력치·숙련 설정
- AC·HP·내성·기술·명중·주문 DC가 자동 계산
- 주문/재주/장비를 DB에서 검색·추가, 캐릭터는 브라우저에 자동 저장(localStorage)

## 구조

| 경로 | 내용 |
|---|---|
| `web/` | 앱 — `index.html` + `data.js`(DB 번들) + `cs_data.js`/`cs_calc.js`/`cs_ui.js`/`app.js` |
| `data/db/*.json` | 정규화 DB 12종 (주문 339·마법아이템 182·몬스터 177·규칙 186·기타장비 135·재주 75·서브클래스 48·무기 38·갑옷 13·클래스 12·종족 10·배경 4) |
| `data/raw/` | 노션 페이지 원본 (크롤 산출물) |
| `tools/` | `parse.mjs`·`build.mjs`·`verify.mjs`·`emit_web.mjs` |
| `SCHEMA.md` `DATA.md` `PLAN.md` | 스키마·데이터·계획 문서 |

## 데이터 재생성

```bash
node tools/build.mjs     # data/raw → data/db/*.json
node tools/verify.mjs    # 검증 (카운트 + 상호참조 해소율)
node tools/emit_web.mjs  # data/db → web/data.js
```

## 라이선스/출처

게임 규칙 데이터는 D&D 5e (2024) SRD 기반 한국어 번역(노션 「캔들킵」 프로젝트). 비영리 팬 번역.
