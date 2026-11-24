# M2-E 프론트 데이터 실행 환경: 픽스처 API 서버 · 서버/브라우저 API 연결 · API 없는 빌드 (Issue #57)

- 마일스톤: M2 · 이슈: #57 · 브랜치: `feat/M2-E-data-env` (`dev` `2ff65b3`에서 생성)
- 실행 방식: **서브에이전트 조합**
  1. test-engineer: 픽스처 데이터·서버를 만들고, 환경 검증 테스트를 먼저 작성한다
  2. devops-engineer: 픽스처 서버를 Playwright·시각 회귀 컨테이너에 연결하고, 브라우저 `/api/*` 프록시·빌드 명령·CI를 맞춘다. 1의 테스트가 의도대로 실패하는지 확인한다(구현 전)
  3. frontend-dev: 환경변수 스키마, API 클라이언트, 확인용 개발 페이지
  4. test-engineer: 독립 검증
- 참여 역할: devops-engineer, test-engineer, frontend-dev
- 선택 이유: M2 계획 §2 M2-E, G1 결정 1·6. 화면 작업(M2-06~)이 데이터를 받으려면 실행 환경이 먼저 있어야 한다. 기획 검수 r1 #2·#3에서 담당 작업이 없다는 지적이 나왔다
- 난도·모델: 보통 → Sonnet
- 계약 기준: `backend/openapi.json`, `frontend/src/generated/api-types.ts` @ `dev` `2ff65b3` (M2-01)
- 참조
  - 프론트 §4("빌드와 데이터" — 이 PR에서 갱신, 개발자 승인 G1 결정 6), §9(민감 정보)
  - 백엔드 §4.1·§4.2·§4.5
  - 개요 §6-b
  - 협업 §4.3-a(테스트 환경 책임)·§5.2
  - UI §11-6(시각 회귀 운용)
  - M1-03·M1-05 지시서(Playwright 서버 구성, 시각 회귀 컨테이너)
- 쓰기 범위
  - devops-engineer: `frontend/playwright.config.ts`, `frontend/package.json`(스크립트·devDependency, Bash로), 루트 `package.json`, `pnpm-lock.yaml`, `.github/**`, `scripts/**`(`scripts/tests/**` 제외), `frontend/Dockerfile`
  - test-engineer: `frontend/e2e/**`(픽스처 서버·데이터 포함), `frontend/**/*.spec.ts(x)`
  - frontend-dev: `frontend/**`(spec·e2e·설정 제외)
  - 오케스트레이터: `docs/plan/02_frontend_plan.md` §4(이 PR에서 반영함)
- 실행 명령: `pnpm --filter @jblog/frontend test` · `pnpm test:e2e` · `pnpm test:visual` · `pnpm verify` · `pnpm docker:build` (`nvm use` 후)
- 비밀값: `INTERNAL_API_KEY`
  - E2E와 픽스처 서버는 테스트용 더미 값을 쓴다. 비밀이 아니라는 것이 이름에 드러나야 한다. 예: `e2e-internal-key-not-secret`
  - 실제 값은 `.env`로만 주입한다
- 하지 말 것
  - 실제 데이터 페이지(`/blog` 등) 구현. M2-06 이후에 한다
  - 백엔드 코드 변경
  - 조회 실패를 빈 목록으로 삼키기
  - 개발 전용 rewrite에 기대어 E2E 통과시키기
  - 시각 회귀 기준 이미지 변경. 기존 24장은 그대로 통과해야 한다
  - `.env*` 실제 파일 접근
  - `git config` 변경

## 동작 규약 (오케스트레이터 확정)

| # | 항목 | 규약 |
|---|---|---|
| 1 | 픽스처 API 서버 (test) | `frontend/e2e/fixtures/`. 고정 응답 HTTP 서버다(Node 내장 `http` 우선, 새 의존성은 꼭 필요할 때만 — devops가 추가).<br>• 응답 데이터는 `@/generated/api-types`의 타입으로 **타입 검사**한다(`satisfies`).<br>• 흉내 내는 경로: `GET /api/posts`(page·size·category·tag·featured), `/api/posts/{slug}`(이전 slug면 301), `/api/categories`, `/api/tags`, `/api/search`(q 2자 미만 400), `GET /internal/posts/{slug}`(`X-Internal-Key`가 다르면 401, 이전 slug면 `{ redirectTo }`), `/uploads/*`(커버 이미지)<br>• 응답 헤더는 백엔드 §5.7-①과 같다(공용 `public, max-age=60, stale-while-revalidate=300`, 검색 `public, max-age=30`, 내부 `private, no-store`).<br>• 데이터: 카테고리 6개 이상, 발행 글 12개 이상(featured 1개 포함), 태그 여러 개, 이전 slug 1개. 본문에는 코드 블록·콜아웃·캡션·h2/h3을 담는다.<br>• 커버 이미지는 직접 만든 단색·그라디언트 PNG를 `frontend/e2e/fixtures/assets/`에 커밋한다(G1 결정 3과 같은 원칙) |
| 2 | 서버 기동 (devops) | Playwright `webServer`에서 픽스처 서버를 **frontend 서버보다 먼저** 띄운다. prod·components·visual 프로젝트가 같은 픽스처를 쓴다. 포트는 기존과 겹치지 않는 값으로 하고, 빌드 검증용 닫힌 포트 4999와도 구분한다. 시각 회귀 컨테이너(`scripts/visual/run.sh`)에서도 같은 구성으로 돈다 |
| 3 | 브라우저 `/api/*` 연결 (devops) | standalone 서버에서 브라우저 요청(`/api/*`, `/uploads/*`)이 픽스처로 가게 한다. 운영 경로(Nginx가 `/api`를 Nest로 보냄)와 같은 구조를 흉내 내야 한다. 방법은 devops가 정한다(예: E2E 전용 작은 리버스 프록시를 앞에 두고 `baseURL`을 프록시로). 개발 전용 rewrite에는 기대지 않는다. `/internal/*`은 브라우저 경로로 노출하지 않는다(404) |
| 4 | 빌드는 API·비밀값 무의존 (devops·frontend) | `pnpm build:verify`와 `pnpm docker:build`는 백엔드 없이, 그리고 `INTERNAL_API_KEY` 없이 통과한다.<br>• `next.config.ts`가 쓰는 빌드 검증은 빌드에 필요한 변수만 본다(`parseBuildEnv`).<br>• 런타임(`env.ts`)은 `INTERNAL_API_KEY`가 없으면 서버 기동 시 실패한다 |
| 5 | 환경변수 스키마 (frontend) | `INTERNAL_API_KEY`를 **서버 스키마**에만 둔다(최소 길이 16). `NEXT_PUBLIC_*`에는 두지 않는다. 기존 `findSecretLikePublicKeys` 검사는 유지한다 |
| 6 | API 클라이언트 (frontend) | 아래 "테스트 대상 인터페이스" 표 1~3을 따른다.<br>• `createServerApi(tags)`: 공개 API용. 모든 요청에 `next: { revalidate: 3600, tags }`<br>• `createInternalApi(tags)`: 내부 API용. `X-Internal-Key` 헤더를 서버에서만 붙인다(`server-only`)<br>• `browserApi`: 상대 경로, 기존과 같다<br>• 조회 실패(네트워크 오류·5xx)는 예외로 올린다. 빈 값으로 바꾸지 않는다 |
| 7 | 확인용 개발 페이지 (frontend) | `/dev/api-check` (`*.dev.tsx`, 운영 빌드에서 404).<br>• 서버 렌더로 `/api/categories` 결과의 이름 목록을 보여 준다(`data-testid="api-check-server"`)<br>• 클라이언트 버튼(이름 "브라우저 요청")을 누르면 `browserApi`로 `/api/categories`를 불러 개수를 보여 준다(`data-testid="api-check-browser"`)<br>• 서버에서 `createInternalApi`로 `/internal/posts/{featured slug}`를 불러 제목을 보여 준다(`data-testid="api-check-internal"`).<br>이 페이지는 M2 화면 작업이 생긴 뒤에도 환경 점검용으로 남긴다 |
| 8 | 요청 시 렌더 (frontend) | 데이터를 쓰는 페이지는 빌드 때 조회하지 않게 요청 시 렌더로 둔다(Next 16 방식은 frontend-dev가 공식 문서로 확인하고 노트에 적는다). `/dev/api-check`가 첫 사례다 |

## 테스트 대상 인터페이스

| # | 진입점 | 위치 | 동작 |
|---|---|---|---|
| 1 | `createServerApi(cacheTags?: string[])` | `frontend/src/lib/api/server.ts`(기존) | openapi-fetch 클라이언트. 요청 init에 `next.revalidate = 3600`, `next.tags = cacheTags` |
| 2 | `createInternalApi(cacheTags?: string[])` | `frontend/src/lib/api/server.ts` | 1과 같고, 모든 요청에 `X-Internal-Key: env.server.INTERNAL_API_KEY` 헤더를 붙인다. 브라우저 번들에 들어가지 않는다 |
| 3 | `parseEnv(raw)` / `parseBuildEnv(raw)` | `frontend/src/lib/env.schema.ts` | `parseEnv`는 `INTERNAL_API_KEY`가 없거나 16자 미만이면 throw한다. 오류 메시지에는 이름만 담는다. `parseBuildEnv`는 `INTERNAL_API_KEY` 없이 통과한다 |
| 4 | 픽스처 서버 | `frontend/e2e/fixtures/server.ts`(test 소유) | 규약 1 |
| 5 | `/dev/api-check` | components 빌드 | 규약 7의 `data-testid`와 버튼 이름 |

## 필수 검증

- 성공
  - [ ] 픽스처 데이터가 생성 타입으로 타입 검사를 통과한다(`typecheck`)
  - [ ] components E2E에서 `/dev/api-check`의 서버 목록, 브라우저 요청 개수, 내부 API 제목이 모두 픽스처 값과 같다
  - [ ] prod·components·visual 프로젝트가 픽스처 서버를 쓰는 구성으로 돈다(`pnpm test:e2e`, `pnpm test:visual`)
  - [ ] `pnpm build:verify`와 `pnpm docker:build`가 백엔드와 `INTERNAL_API_KEY` 없이 통과한다
- 거부
  - [ ] 픽스처 서버에 `X-Internal-Key`가 틀리면 401이다. 프론트 `createInternalApi`의 키가 틀리면 페이지가 빈 값이 아니라 오류로 끝난다
  - [ ] 서버 런타임에 `INTERNAL_API_KEY`가 없으면 기동 또는 첫 요청에서 이름만 담은 오류로 실패한다(값 미노출)
  - [ ] 브라우저 번들(`.next/static/**`)에 `INTERNAL_API_KEY` 값과 `X-Internal-Key` 사용 코드가 없다
  - [ ] 운영 빌드에서 `/dev/api-check`는 404다. 브라우저 경로 `/internal/posts/x`도 404다
- 회귀
  - [ ] 기존 단위 테스트(343건), E2E(207건), 시각 회귀 24건(기준 이미지 변경 없음), `pnpm verify`가 통과한다
  - [ ] CI 필수 검사 8개의 이름과 개수가 그대로다

## 인계 노트

(단계별로 덧붙인다)
