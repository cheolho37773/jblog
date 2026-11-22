# M1 디자인 시스템 — 작업 계획서

> 작성 2026-11-22 · 상태: **G1 승인 대기** · Codex 기획 검수 r1 반영(Q4 영향 표, E2E 환경 devops 배정, Issue #24 분리)
> 기준: [전체 체크리스트 M1](../00_master_checklist.md#m1-디자인-시스템), [개요 §7·§8](../../plan/00_overview.md), [UI 디자인 기획서](../../ui_design/ui_design_spec.md) §3~§5·§8·§9·§10·§11·§12, [프론트엔드 기획서](../../plan/02_frontend_plan.md) §2·§3·§5, [협업 아키텍처](../../plan/05_collaboration_architecture.md) v0.9, [M0 report](../M0/report.md)

## 1. 목표

공개 사이트의 **디자인 토큰(색·타이포·간격·그라디언트, Light/Dark)과 공통 컴포넌트**(Atom, 레이아웃: Navbar·Footer·Container·PageInfo)를 만들고, `/dev/components` 페이지에서 Light/Dark × 4개 브레이크포인트로 확인한다. 원본에 그대로 있는 컴포넌트(Navbar·Footer)는 원본 대비 디자인 검수(UI §11 A)를, 나머지는 규칙 준수 검수(§11 B)를 통과한다.

**M1에서 하지 않는 것**: 글·프로젝트 카드 등 데이터가 붙는 Molecule/Organism(PostCard·ProjectCard·Hero 등 — M2·M4), 페이지 조립(M2~), Markdown 렌더링(M2), 관리자 UI·shadcn/ui(M3), API 호출.

## 2. 작업 목록

작업 단위는 "한 번에 검증할 수 있는 결과 하나"(협업 §4.0-a), 각 작업은 브랜치 1개 → PR 1개. **구현은 한 번에 1개씩** 진행한다(협업 §4.4).

| ID | 작업 | 실행 방식 · 참여 역할 | 난도 · 모델 | 의존 |
|---|---|---|---|---|
| **M1-01** | UI 기획서 §10 미확정 9개 항목 확정 (개요 Q4) → §3·§5·§10 값 갱신 | 오케스트레이터 (Figma MCP 또는 개발자 확인값) · 기획 문서 PR | 낮음 | **Figma 접근** (§7-1 결정) |
| **M1-02** | 디자인 토큰 (**공유 계약**, 브랜치 `contract/M1-02-design-tokens`): `globals.css` 시맨틱 토큰 전체 Light/Dark(UI §3.3), 그라디언트(§3.4), 타이포 유틸(§3.5, 모바일 축소 §4.2), radius·shadow·spacing(§3.6), 컨테이너·브레이크포인트(§4), 폰트(Work Sans·Source Serif 4·Plus Jakarta Sans·Poppins·JetBrains Mono, **Pretendard 로컬 woff2** — OFL 라이선스 확인·고지), 토큰 검사 테스트 | 서브에이전트 조합 · test-engineer(토큰 값·대비 테스트 선작성) → frontend-dev | 보통 · Sonnet | M0 (M1-01과 무관하게 시작 가능, §7-1) |
| **M1-03** | Atom 컴포넌트(UI §12): Badge(solid/soft), Button(primary/outline/icon/pill-solid/pill-outline), Avatar, Input, SearchInput, ThemeToggle(완성 스타일), Icon(lucide·simple-icons 래퍼) + `/dev/components` 페이지(운영 빌드에서 제외) + **E2E 실행 환경 분리**: 컴포넌트 캡처용 빌드(개발 전용 페이지 포함)와 운영 빌드(`/dev/components` 404 검증)를 각각 띄우는 Playwright 설정·CI `e2e` 잡 연결 | 서브에이전트 조합 · devops-engineer(Playwright 서버 2종·CI 연결 — 협업 §4.3-a) → test-engineer(컴포넌트 동작·접근성·404 테스트 선작성) → frontend-dev → test-engineer(독립 검증) | 보통 · Sonnet | M1-02 |
| **M1-04** | 레이아웃 컴포넌트(FE-03): Navbar(데스크톱 메뉴·검색·테마 토글, 태블릿 이하 햄버거 → MobileMenu 드로어: 포커스 트랩·ESC·스크롤 잠금), Footer(4컬럼 → 모바일 스택), Container/Section, PageInfo/Breadcrumb. `(site)` 레이아웃에 연결 | 서브에이전트 조합 · test-engineer → frontend-dev → test-engineer | 보통 · Sonnet (모바일 메뉴 접근성) | M1-03 |
| **M1-05** | 디자인 검수(UI §11): Playwright로 `/dev/components`·`(site)` 레이아웃을 1920/1440/1024/768/375 × Light/Dark 캡처 → A(Navbar·Footer)는 원본 대비 ±2px·색 일치, B는 토큰·간격 규칙 준수 → 차이 수정 → 승인한 스크린샷을 시각 회귀 기준 이미지로 확정, `@axe-core/playwright` serious/critical 0 | 서브에이전트 조합 · devops-engineer(시각 회귀 기준 이미지를 CI 러너(Linux)에서 만들고 갱신하는 방법·CI 연결) → test-engineer(캡처·비교·차이 목록) → frontend-dev(수정) → test-engineer(재비교) | 보통 · Sonnet (비교 설계는 test-engineer) | M1-04 (A 비교 원본은 §7-2) |
| **M1-07** | Issue #24: 공개 환경변수에 비밀값처럼 보이는 이름이 정의되면 모듈 로드가 실패하는지 테스트로 고정(공개 키를 주입할 수 있게 검사 함수 분리) | 서브에이전트 조합 · test-engineer → frontend-dev | 낮음 · Sonnet | M0 (토큰 작업과 무관, 순서는 §3) |
| **M1-06** | M1 report, 체크리스트 진행 현황 | 단일 실행 · docs-writer (+ 오케스트레이터 저장) | 낮음 · Sonnet | M1-05 |

- M1-02는 협업 §5.3의 "디자인 토큰" 계약이다. M1-03~05는 이 토큰만 쓴다(hex 하드코딩 금지, 스킬 `component-patterns` §4). 토큰이 더 필요하면 계약 변경으로 처리
- `/dev/components`는 개발·검수 전용이다. 운영 빌드에서 404가 되도록 하고(환경값으로 분기하지 않고 빌드 시점 구분 — 방법은 M1-03 지시서에서 확정), 검색 엔진에 노출하지 않는다

## 3. 진행 순서

```
M1-02 (토큰, 계약) → M1-07 (Issue #24) → M1-03 (Atom + E2E 환경) → M1-04 (레이아웃) → M1-05 (디자인 검수) → M1-06 (report)
M1-01 (Q4 확정): Figma 접근이 되는 시점에 끼워 넣는다 — 영향 범위는 아래 표
```

**Q4 항목별 영향과 확정 후 절차** (Codex 기획 검수 r1)

| §10 # | 항목 | 영향 대상 | M1에서 쓰는 곳 |
|---|---|---|---|
| 1 | 포트폴리오 폰트 | 토큰(폰트·타이포 유틸) | M1-02 |
| 2 | 그라디언트 3종 | 토큰 | M1-02 (사용은 M4) |
| 3 | 프로젝트 카드 radius·정보바 패딩 | ProjectCard 컴포넌트 | M4 (M1 범위 밖) |
| 4 | CTA 버튼 크기·보더 | Button `pill-*` variant 크기 | M1-03 |
| 5 | Dark navbar 색·검색 bg·토글 | 토큰 + Navbar·SearchInput·ThemeToggle | M1-02·03·04 |
| 6 | Light footer 배경·링크 색 | 토큰 + Footer | M1-02·04 |
| 7 | PageInfo/Breadcrumb 상세 | PageInfo 컴포넌트 구성 | M1-04 |
| 8 | Outline 버튼 보더 색 | 토큰 + Button `outline` | M1-02·03 |
| 9 | Dark 본문 텍스트 색 | 토큰 | M1-02 |

확정 값이 추정과 다르면: ① 토큰 값만 바뀌는지, 토큰 추가·컴포넌트 구조 변경인지 판단(추가·구조 변경은 디자인 토큰 계약 변경 — `contract/` 브랜치) → ② 관련 컴포넌트 수정 → ③ 해당 컴포넌트의 동작 테스트·디자인 검수 재실행 → ④ 시각 회귀 기준 이미지 재승인. M1-05 이후에 확정되면 이 절차를 별도 작업으로 연다

- 구현은 한 번에 1개(협업 §4.4). 앞 작업이 검토·Merge를 기다리는 동안 다음 작업의 지시서·이슈를 준비한다
- CI 8개 잡이 `dev` 필수 검사다. M1-05에서 시각 회귀 테스트가 생기면 `e2e` 잡에 포함된다(기준 이미지는 CI 러너(Linux)에서 만든 것을 쓴다 — 로컬 macOS와 폰트 렌더링이 다름. 방법은 M1-05 지시서에서 확정)

## 4. 작업별 완료 기준 (필수 검증 요약)

상세는 작업마다 지시서에 성공·거부·회귀로 적는다.

| ID | 성공 | 거부·회귀 |
|---|---|---|
| M1-01 | §10 9개 항목 값과 출처(노드)가 기획서에 기록되고 (추정) 표기 제거 | 값을 확인하지 못한 항목은 (추정) 유지 + 사유 |
| M1-02 | 모든 시맨틱 토큰이 Light/Dark CSS 변수로 존재, Tailwind 유틸로 쓸 수 있음, 텍스트 토큰 대비 AA(§9), 폰트 로드(FOUT·레이아웃 흔들림 최소화), Issue #24 테스트 | 컴포넌트 코드에 hex 직접 사용 시 lint 실패(규칙 또는 테스트), 기존 M0 테스트 회귀 없음 |
| M1-03 | 각 Atom의 variant·크기·상태(hover·focus·disabled)가 `/dev/components`에 Light/Dark로 표시, 컴포넌트 테스트(역할·이름·키보드) 통과, 컴포넌트 캡처용 서버와 운영 서버가 각각 CI `e2e` 잡에서 뜸 | 운영 빌드에서 `/dev/components` 404, 포커스 링 누락 없음 |
| M1-04 | 4개 브레이크포인트에서 Navbar·Footer 레이아웃이 UI §4.2·§5.1·§5.9와 일치, MobileMenu 포커스 트랩·ESC·스크롤 잠금, 터치 타겟 44px | 가로 스크롤 없음(375~1920), 메뉴 닫힌 상태에서 포커스가 드로어로 들어가지 않음 |
| M1-05 | A 대상 ±2px·색 일치, B 대상 규칙 위반 0, axe serious/critical 0, 기준 이미지 확정 | 시각 회귀가 의도치 않은 변경을 검출(시험용 변경으로 확인) |
| M1-07 | 비밀값처럼 보이는 공개 키를 넣으면 검사가 실패(모듈 로드 실패와 같은 경로), 안전한 키는 통과 | 기존 env 테스트·빌드 회귀 없음, Issue #24 종료 |
| M1-06 | 체크리스트 M1 전 항목 상태 확정, report | 완료·실패·보류를 섞지 않음 |

## 5. 협업 체계 시험 항목 (M1에서 처음 생기는 것)

| 항목 | 확인 시점 |
|---|---|
| 디자인 토큰 계약(`contract/` 브랜치) → 이후 작업이 토큰만 사용 | M1-02 → M1-03 |
| 디자인 검수 절차(UI §11, Test Agent 캡처·비교 → Frontend 수정) | M1-05 |
| 시각 회귀 기준 이미지의 CI 운용(Linux 기준) | M1-05 |
| 협업 v0.9 규칙(구현 1개씩, 테스트 대상 인터페이스, 수정 횟수 이번/누적) 첫 적용 | M1 전체 |

## 6. 위험과 대응

| 위험 | 대응 |
|---|---|
| Figma MCP 한도(Starter)로 §10 확인·원본 컴포넌트 재추출이 막힘 (2026-11-22 확인: 한도 초과) | §7-1·§7-2 결정. 추정값은 토큰 한 곳에서 관리해 나중에 값만 교체 |
| 원본 비교(A)의 기준 자료 부족: 로컬 참고 스크린샷(`docs/ui_design/references/`, 공개 안 함)은 페이지 단위 | 페이지 스크린샷에서 Navbar·Footer 영역을 잘라 비교. 정밀 비교가 안 되는 항목은 차이 목록에 "원본 확인 불가"로 남김 |
| 시각 회귀가 OS·폰트 렌더링 차이로 흔들림 | 기준 이미지는 CI 러너에서 생성·갱신, 허용 오차 설정, 폰트는 로컬 파일·`next/font`로 고정 |
| Pretendard 등 폰트 파일 라이선스 | OFL 1.1 확인 후 라이선스 파일을 함께 커밋, 출처 기록 |
| `/dev/components`가 운영에 노출 | 운영 빌드에서 404 테스트(M1-03 거부 항목) |

## 7. 개발자 확인이 필요한 사항 (G1)

1. **Q4(§10 미확정 9개) 처리 방법** — Figma MCP가 2026-11-22에도 Starter 한도 초과 상태다.
   - **(추천) 추정값으로 M1 진행 + M1-01은 확인 가능해질 때 처리**: 9개 값은 토큰 한 곳(M1-02)에 모여 있어 나중에 값만 바꾸면 된다. M1 종료까지 확인하지 못하면 M1 report에 보류(후속 Issue)로 남긴다
   - 개발자가 Figma 웹(Dev Mode 또는 레이어 속성)에서 9개 값을 직접 확인해 알려 주기 — 가장 정확, 개발자 시간 필요
   - Figma 플랜 업그레이드로 MCP 한도 해제 — 비용 발생
2. **원본 비교(UI §11 A) 기준 자료**: Figma 재추출이 안 되면 로컬 참고 스크린샷(페이지 단위)에서 잘라 비교하는 것으로 갈음해도 되는지
3. 작업 분할(7개)과 순서, 모델 배정(전부 Sonnet, 문서 report도 Sonnet). Issue #24는 토큰 계약과 분리해 M1-07로
4. `/dev/components`를 운영 빌드에서 404로 숨기는 것 (개발·검수 전용)
