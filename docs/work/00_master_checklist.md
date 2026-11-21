# jblog 전체 작업 체크리스트

> 작업이 하나 끝날 때마다 체크한다. 이 문서는 진행 상황 기록이며, 작업 내용의 기준은 각 기획 문서다.
> 작성일 2026-11-21 · 기준 문서: [개요](../plan/00_overview.md) v0.8, [협업 아키텍처](../plan/05_collaboration_architecture.md) v0.5

## 사용법

- **체크 방법**: `dev`는 직접 push가 막혀 있으므로, **작업 PR 안에서 자기 항목을 체크**한다 (기록 단계, 검수 전 커밋). PR이 Merge되면 체크도 함께 반영되고, Merge되지 않으면 반영되지 않는다. 즉 `dev`의 체크리스트에 체크된 항목 = Merge된 작업이다.
- **표기**: 체크할 때 줄 끝에 이슈 번호와 날짜를 남긴다 (PR 번호는 이슈에 연결됨). 예: `- [x] BE-03 ... — #12 (2026-12-02)`
- **보류·제외**: 하지 않기로 했거나 미룬 항목은 체크하지 않고 줄 끝에 `⏸ 보류: <이유>`를 적는다.
- **작업 분할**: 한 항목을 여러 작업으로 나누면(예: BE-05 → BE-05-1, BE-05-2) 하위 항목을 추가해 각각 체크한다 (협업 §4.0-a).
- **갱신 담당**: 오케스트레이터(또는 docs-writer)가 작업 PR의 기록 단계에서 갱신한다. 진행 현황표(⬜/🔄/✅)는 마일스톤의 첫 작업 PR에서 🔄, 마지막 작업(마일스톤 report) PR에서 ✅로 바꾼다.

## 진행 현황

| 단계 | 상태 | 완료일 |
|---|---|---|
| 기획 | ✅ 완료 | 2026-11-21 |
| P1 협업 체계 준비 | 🔄 진행 중 (저장소 완료) | |
| M0 셋업 | 🔄 진행 중 | |
| M1 디자인 시스템 | ⬜ | |
| M2 블로그 읽기 | ⬜ | |
| M3 관리자 & 작성 | ⬜ | |
| M4 포트폴리오 | ⬜ | |
| M5 품질 & 릴리스 준비 (MVP 완료) | ⬜ | |
| M6 조회수·좋아요 | ⬜ | |
| M7 AI 자동 작성 | ⬜ | |
| M-Deploy 배포 | ⏸ 인프라 결정 후 | |

상태 표기: ⬜ 시작 전 · 🔄 진행 중 · ✅ 완료 · ⏸ 보류

---

## 기획 (완료)

- [x] UI 디자인 기획서 (`docs/ui_design/ui_design_spec.md`) — 2026-11-20
- [x] 개요·백엔드·프론트엔드 기획서 (00~02) — 2026-11-20
- [x] AI 자동 작성 기획서 (03) — 2026-11-20
- [x] 접근 통제·복사 방지 기획서 (04) — 2026-11-20
- [x] 협업 아키텍처 기획서 (05) — 2026-11-21
- [x] 1·2·3·4차 검토 피드백 반영 — 2026-11-21
- [x] 에이전트 팀 가이드 검토 반영 — 2026-11-21
- [x] 배포 보류, 공개 저장소, 민감 정보 관리 규칙 반영 — 2026-11-21

---

## P1. 협업 체계 준비 (M0 첫 작업)

> 저장소가 아직 없으므로 이 단계만 `dev` 직접 커밋을 허용하고, 끝나면 브랜치 보호를 켠다. (협업 §5.1, §12)

**저장소** — https://github.com/cheolho37773/jblog
- [x] `git init`, `.gitignore` (`.env`, `.env.*` 무시, `!.env.example` 예외, node_modules, .next, dist, 업로드 폴더) — 2026-11-21
- [x] 공개 GitHub 저장소 생성, 첫 커밋으로 `main` 생성 — 2026-11-21
- [x] `main`에서 `dev` 생성 → GitHub 기본 브랜치를 `dev`로 변경 — 2026-11-21
- [x] 저장소 설정: squash merge만 허용, Merge 후 브랜치 자동 삭제 — 2026-11-21
- [x] Secret scanning + Push protection 켜기 — 2026-11-21
- [x] 이슈 라벨(`M0`~`M7`, `BE`, `FE`, `TEST`, `DEVOPS`, `DOCS`, `type:*`)과 이슈 템플릿 — 2026-11-21
- [x] PR 템플릿 (`.github/pull_request_template.md`, 협업 §5.5) — 2026-11-21

**에이전트·검수 설정** (협업 §11)
- [x] `.claude/agents/` 개편: architect 삭제, backend-dev·frontend-dev·devops-engineer 수정, qa-engineer → test-engineer, docs-writer 신규 — 2026-11-21
- [x] 에이전트 frontmatter `tools`·`model` 지정 (구현·테스트·DevOps sonnet, docs haiku) — 2026-11-21
- [x] `.claude/skills/` 개편: fullstack-webapp → jblog-dev, component-patterns·api-security-checklist 수정, codex-review 신규 — 2026-11-21
- [x] `.claude/CLAUDE.md` 재작성, `_workspace/` 체계 폐기 — 2026-11-21
- [x] `.claude/settings.json`: 소유권 훅(PreToolUse), 허용 명령, `.env` 읽기 차단 — 2026-11-21
- [x] 소유권 훅 `scripts/hooks/check-ownership.py` + 규칙 `scripts/ownership/roles.json` (테스트 21건 통과) — 2026-11-21
- [x] 루트 `AGENTS.md` (Codex 검수 지침: 관점, 출력 형식, 민감 정보 "높음", 코드 수정 금지) — 2026-11-21
- [x] `scripts/codex-review.sh` (dev merge-base 기준, base·head SHA 기록) — 2026-11-21
- [ ] ~~GitHub Codex PR 리뷰 연결~~ ⏸ 보류: 사용하지 않기로 결정 (협업 C1, 2026-11-21). Codex는 로컬 검수만
- [x] pre-commit 훅: 비밀정보 패턴 검사, `.env` 커밋 차단 (`.githooks/pre-commit`, 테스트 9건 통과) — 2026-11-21 · M0-02에서 Husky `.husky/pre-commit`으로 이전 (`pnpm install`이 설치)

**마무리**
- [x] 브랜치 보호 켜기 (Ruleset): `dev`·`main` PR 필수(squash만), 직접·force push·삭제 금지 — 2026-11-21
- [ ] Codex 로컬 검수 실제 1회 실행 확인 (M0 첫 작업에서)
- [x] GitHub 계정 2FA 확인 (관리자 로그인 보안의 전제, 접근 통제 §1.2) — 2026-11-21

---

## M0. 셋업

> 이 단계의 작은 작업 하나로 협업 흐름 전체를 처음 시험한다 (협업 §12 P2).
> 작업 계획: [docs/work/M0/plan.md](M0/plan.md) (작업 ID M0-01 ~ M0-09)

**검수 도구**
- [x] M0-01 `codex-review.sh` 보완: `--plan` 회차 날짜 무관 증가, Codex 실행 시간 제한, 실제 Codex 실행 파일 사용 (Issue #2) — #2 (2026-11-21)

**모노레포·도구** (DevOps)
- [x] pnpm workspace + Turborepo, `frontend/`·`backend/`·`infra/` 구조 (공용 코드 패키지 없음, 개요 D25) — #6 (2026-11-21) · `frontend/`·`backend/`·`infra/` 디렉터리는 M0-03~05에서 생성
- [x] ESLint(flat) + Prettier + 가독성 규칙(complexity 10, max-depth 3, max-params 3, no-explicit-any 등) + 설정 모듈 밖 `process.env` 금지 규칙 — #6 (2026-11-21)
- [x] Husky + lint-staged + commitlint (Conventional Commits) — #6 (2026-11-21)
- [x] 로컬 Docker Compose (PostgreSQL 17), `infra/.env.example`, `infra/README.md` — #9 (2026-11-21)
- [x] 테스트 프레임워크 공통 설정: Jest(api), Vitest(web), Playwright, `pnpm test:*` 명령 — Jest #11, Vitest·Playwright #13 (2026-11-21)
- [x] GitHub Actions CI (**작업 브랜치 push 이벤트 + `dev` 대상 pull_request 이벤트** 모두 실행): lint · typecheck · test(Testcontainers) · build · Docker 빌드 검증 · `ownership-check`(`scripts/ownership/roles.json` 사용) · 잠금 파일 검사, SHA 3종 출력, `permissions` 최소화 — #21 (2026-11-21, E2E·통합 테스트·API 계약 검사 포함)
- [x] `dev` Ruleset에 CI 잡과 `ownership-check`를 **필수 상태 검사**로 추가 (CI가 생긴 뒤) — 2026-11-22, 8개 잡(GitHub Actions 앱 한정), 최신 `dev` 기준 필수
- [x] Husky 도입 시 pre-commit이 `scripts/hooks/check-secrets.sh`를 호출하도록 이전 — #6 (2026-11-21)

**백엔드 기반**
- [x] BE-01 Nest 프로젝트, config(스키마 검증)/logging(pino redact)/helmet/ValidationPipe/Swagger(운영 비활성)/에러 필터 — #11 (2026-11-21)
- [x] BE-02 Prisma 스키마, 마이그레이션, `pg_trgm`·부분 unique 인덱스 수동 SQL, seed(더미 데이터) — #17 (2026-11-21)
- [x] `backend/.env.example` — #11, `DATABASE_URL` #17 (2026-11-21)

**프론트엔드 기반**
- [x] FE-01 Next.js 앱, Tailwind v4, 폰트, next-themes, `lib/env.ts`, api-types 연동 — #13, api-types 연동 #19 (2026-11-21)
- [x] `frontend/.env.example` — #13 (2026-11-21)
- [x] M0-07 API 타입 파이프라인 (Swagger → `backend/openapi.json` → `frontend/src/generated/api-types.ts`) — #19 (2026-11-21)
- [x] Next.js 버전 고정 + `revalidateTag` 시그니처·즉시 만료 옵션 확인 (개요 Q5) — #13 (2026-11-21, Next 16.4.6)

**협업 흐름 시험** (협업 §12 P2)
- [x] 이슈 → `dev`에서 브랜치 → 자체 검사 → Codex 최종 검수 @ SHA → push → CI → head SHA 보고 → 개발자 PR 생성·Merge → 이슈 자동 종료 — M0-01~08 (CI 단계는 #21부터)
- [x] push 이벤트로 CI가 실행되는지 — #21 (2026-11-21)
- [x] PR 본문의 `Closes #n`으로 Merge 시 이슈가 닫히는지 — #2 (2026-11-21, PR #5)
- [x] 검수 후 코드 커밋(CI 실패 수정 포함) 시 재검수 후 push되는지 — M0-04·05·07·08 (Codex 지적 수정 후 r2·r3 재검수)
- [x] 범위 밖 파일 변경 시 CI `ownership-check`가 실패하는지 — #21 (2026-11-21, 시험 브랜치로 R9·R3·R6·R7 실패 확인, R5는 Merge 후 재확인)
- [x] CI 요약에 head·base·검사 SHA가 나오는지 — #21 (run 44916562916)

**M0 완료 확인**
- [x] 빈 앱 두 개가 CI 통과 — #21 (2026-11-21)
- [x] P3: 시험 결과로 협업 문서·스킬 보정 (G2) — #23: 스킬·CLAUDE.md 반영, 협업 문서 보정은 report §8 제안(G2 대기)
- [x] `docs/work/M0/report.md` 작성, 개발자 보고 — #23 (2026-11-22)

---

## M1. 디자인 시스템

- [ ] UI 기획서 §10 미확정 9개 항목 확정 (Figma 재확인, 개요 Q4)
- [ ] FE-02 디자인 토큰(`globals.css`, Light/Dark), 타이포 유틸, 그라디언트, Atom 컴포넌트(Badge·Button·Avatar·Input·ThemeToggle), `/dev/components` 페이지
- [ ] FE-03 Navbar(모바일 메뉴·검색·테마 토글), Footer, Container/Section, PageInfo
- [ ] 디자인 검수: 원본 컴포넌트 Figma 대비 ±2px, Light/Dark (UI §11)

**M1 완료 확인**
- [ ] `/dev/components`에서 모든 공통 컴포넌트를 Light/Dark·4개 브레이크포인트로 확인
- [ ] `docs/work/M1/report.md`, 개발자 보고

---

## M2. 블로그 읽기

**백엔드**
- [ ] BE-03 Posts/Categories/Tags 공개 조회 + 검색(`pg_trgm`)
- [ ] BE-04a / SEC-05 내부 API `/internal/posts/:slug`·`/internal/projects/:slug`(메타+원문 단일 응답, 스냅샷 조회) + `InternalKeyGuard`, 응답 유형별 `Cache-Control`

**프론트엔드**
- [ ] FE-04 `frontend/src/lib/markdown` 파이프라인 + `.prose-jblog` + 한글 본문 폰트(Noto Serif KR)
- [ ] FE-05 Blog 목록/상세/검색, 태그 필터, PostCard 3종, LoadMore, TOC, slug 301 처리, SEO(메타/OG/JSON-LD)
- [ ] FE-05a / SEC-06 복사 방지(CopyGuard, 입력 요소·연락처 예외, 코드 복사 버튼, 인쇄 차단, 링크 복사)
- [ ] Home의 블로그 섹션 (Featured 조건부, Latest Post)

**M2 완료 확인**
- [ ] 시드 데이터로 공개 블로그 동작 (목록·상세·태그·검색)
- [ ] 공개 API에 `contentMd` 없음, `/internal/*` 키 없으면 401
- [ ] M3 착수 조건 확인: 작업본 필드·버전 규칙, outbox, 완료 기준, slug 정책 (개요 §8)
- [ ] `docs/work/M2/report.md`, 개발자 보고

---

## M3. 관리자 & 작성

**인증·접근 통제**
- [ ] SEC-01 GitHub OAuth + 허용 목록, state 검증, User 모델
- [ ] SEC-02 글로벌 `AuthGuard` + 인증 방식 데코레이터 + 부팅 시 검사, 경로별 CSRF
- [ ] BE-04 refresh 원자적 회전·10초 유예, logout, me, tokenVersion 즉시 차단
- [ ] SEC-03 LoginAudit, 활성 세션 목록/폐기, 모든 기기 로그아웃
- [ ] SEC-04 / FE-06 middleware JWT 검증, 로그인 페이지, AdminShell, API 클라이언트(탭 간 refresh 조정), 보안 설정 화면

**글 작성**
- [ ] BE-05 Admin Posts CRUD/발행 (작업 분할 예)
  - [ ] BE-05-1 작업본 생성·저장 (작업본 ID, `expectedPostVersion`)
  - [ ] BE-05-2 수정사항 발행·폐기·강제 발행·충돌 처리
  - [ ] BE-05-3 즉시 반영 동작(Featured·slug·예약 시각), slug 영구 예약·복귀 금지·301
- [ ] BE-06 미디어 업로드(이미지·PDF), MediaUsage 참조 추적·삭제 보호
- [ ] BE-07 캐시 갱신 outbox + 작업자, 이벤트별 태그, 예약 발행 1분 cron, 실패 배너 API
- [ ] FE-07 글 관리 + MarkdownEditor + 이미지 업로드 + 초안/작업본 자동저장 + 수정사항 발행 + 충돌 다이얼로그 + 미리보기
- [ ] FE-08 `/internal/revalidate`, 캐시 갱신 실패 배너, sitemap, RSS

**M3 완료 확인** (개요 §7)
- [ ] 발행 글을 편집해도 수정사항 발행 전에는 공개 페이지가 바뀌지 않음
- [ ] 상태 변경 시 캐시 이벤트가 같은 트랜잭션에 기록되고 재시작해도 처리됨
- [ ] 이벤트 처리 후 새 요청은 목록/상세/RSS/사이트맵 모두 최신
- [ ] 동시 실행 필수 시나리오 통과 (백엔드 §5.8)
- [ ] M4 착수 조건 확인: 프로젝트·기술스택·사이트맵 캐시 태그
- [ ] `docs/work/M3/report.md`, 개발자 보고

---

## M4. 포트폴리오

- [ ] BE-08 Profile/TechStack/Experience/Project 공개 + 관리자 API (썸네일 공개 시 필수)
- [ ] FE-09 ProfileHero(프로젝트 보기/기술 글 읽기 + 이력서·연락하기 링크), TechLogoRow, ProjectCard(요약·역할·기술), Experience, Contact, AuthorInfoBox → Home/Projects/About
- [ ] FE-10 포트폴리오 관리자 폼 (프로필+이력서 PDF, 프로젝트+본문 템플릿, 경력, 기술스택, 카테고리, 미디어 사용처)

**M4 완료 확인**
- [ ] UI 기획서의 전체 페이지 완성 (Home·Blog·Projects·About·Search·404)
- [ ] M5 착수 조건 확인: 조회수·좋아요 UI·테스트가 기능 스위치로 분리됨
- [ ] `docs/work/M4/report.md`, 개발자 보고

---

## M5. 품질 & 릴리스 준비 (MVP 완료)

- [ ] FE-12 시각 회귀(컴포넌트 ±2px / 재구성 페이지 규칙) + 디자인 차이 수정, axe, Lighthouse(모바일 Performance ≥ 90)
- [ ] BE-10 E2E 테스트, 운영용 Dockerfile·CI 빌드 검증, 헬스체크
- [ ] E2E (M5 범위, `FEATURE_REACTIONS=false`)
- [ ] SEC-07 접근 통제·복사 방지 테스트 + 운영 체크리스트(GitHub 2FA, Swagger 비활성, OAuth App 분리)
- [ ] 민감 정보 점검: 하드코딩 없음, `.env.example` 최신, 공개 저장소 이력에 비밀정보 없음

**M5 완료 확인**
- [ ] MVP 기능 전체 동작 (로컬 기준, 배포 제외)
- [ ] 후속 처리 Issue 정리
- [ ] `docs/work/M5/report.md`, 개발자 보고

---

## M6. 조회수·좋아요

- [ ] BE-09 Reactions(views·likes, 방문자 쿠키, 로그 정리), `PostViewDaily` 집계, Admin Stats, `FEATURE_REACTIONS` 스위치
- [ ] FE-11 기능 스위치, ViewTracker, LikeButton, 대시보드 통계(조회수 정의 표시)
- [ ] E2E (M6 범위, `FEATURE_REACTIONS=true`)

**M6 완료 확인**
- [ ] `FEATURE_REACTIONS=true`로 켜고 정상 동작
- [ ] `docs/work/M6/report.md`, 개발자 보고

---

## M7. AI 자동 작성 (MCP)

**선행** (M7 착수 조건)
- [ ] AI-00 비공개 미디어: `Media.isPublic` 파생값·재계산(예약 도달 포함), 인증 서브요청 200/401 + 404 변환, 인증 결과 무캐시, 비공개 이미지 `unoptimized`, 긴급 교체, 기존 미디어 마이그레이션

**MCP 서버** (BE-11)
- [ ] AI-01 스키마 변경 (source, aiEditable, aiDisclosure, Project.version, McpToken + User 관계, ProfileProposal, AiActivityLog, SiteSetting)
- [ ] AI-02 MCP 토큰 발급/검증(발급자 허용 목록 재확인), scope, Throttle
- [ ] AI-03 `McpModule` Streamable HTTP(stateless) `/mcp`
- [ ] AI-04 Tools (글·이미지(base64만)·프로젝트·경력·프로필 제안·컨텍스트) + 활동 로그
- [ ] AI-05 Prompts 4종 + 작성 가이드 기본값
- [ ] AI-06 시크릿 스캐너

**관리자 화면** (FE-13)
- [ ] AI-07 MCP 설정 (토큰, 연결 스니펫, 작성 가이드, 활동 로그)
- [ ] AI-08 AI 초안함, 프로필 diff 승인, 기술스택 제안 승인, 발행 체크리스트
- [ ] AI-09 AI 배지/필터, 대시보드 카드, 공개 페이지 AI 표기(`Post.aiDisclosure`)

**검증**
- [ ] AI-10 단위·프로토콜·보안 테스트 + Claude Code·Codex 실사용 검증(시나리오 S1~S5) + 연결 가이드 갱신

**M7 완료 확인**
- [ ] Claude Code·Codex로 초안 작성 → AI 초안함 검토 → 발행까지 동작
- [ ] `docs/work/M7/report.md`, 개발자 보고

---

## M-Deploy. 배포 (보류)

> 배포 인프라(개요 D6)가 결정된 뒤 이 섹션을 구체화한다. 기준은 개요 §6-a "인프라와 무관하게 유지하는 요구사항".

- [ ] 배포 인프라 결정 (개요 Q0) ⏸
- [ ] 도메인 결정·설정 (개요 Q1) ⏸
- [ ] BE-12 배포 스크립트, 운영 구성, 백업 자동화 ⏸
- [ ] 리버스 프록시 구성: 동일 오리진, `/internal/*` 차단, `X-Internal-Key` 제거, `X-Forwarded-For`, 업로드 서빙, `/admin` 헤더 ⏸
- [ ] HTTPS, CD 파이프라인, 모니터링 ⏸
- [ ] `dev` → `main` 첫 Merge 절차 결정 및 실행 ⏸

---

## 작업 1건 진행 체크 (복사해서 지시서 하단에 사용)

> 개별 작업을 진행할 때 단계를 놓치지 않기 위한 체크. 협업 §4.2 흐름 기준이며, [조건부] 단계는 실행 방식에 따라 생략할 수 있다.

```markdown
- [ ] 지시서 작성 (실행 방식·난도·계약 기준·필수 검증 포함) + GitHub 이슈 생성
- [ ] `dev`에서 브랜치 + worktree 생성 (`gh issue develop`)
- [ ] [조건부] Test Agent 테스트 선작성 → 의도대로 실패 확인
- [ ] 구현
- [ ] 자체 검사: lint · typecheck · test · 변경 파일 범위 (에러 수정 3회 이내)
- [ ] 민감 정보 하드코딩 없음, 새 환경변수는 `.env.example` 반영
- [ ] [조건부] Docs 기록 (검수 전에 커밋)
- [ ] 이 체크리스트(`00_master_checklist.md`)에서 해당 항목 체크 (기록 단계에 포함)
- [ ] Codex 최종 검수 @ head SHA → push 허용 조건(협업 §6.4-a) 충족, 대응 기록 작성 (push 전)
- [ ] 브랜치 push → CI 통과 (실패 시 수정 → 재검수 → 재push)
- [ ] 필수 검증 항목 전부 "완료" (실패·보류 따로 보고)
- [ ] 개발자에게 브랜치·head SHA·연결 이슈 번호 보고
- [ ] (개발자) PR 생성 → PR CI 확인 → 최신 커밋 = 보고 SHA 확인 → Squash and merge
- [ ] 이슈 자동 종료 확인 → worktree·로컬 브랜치 정리
```
