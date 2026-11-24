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
  - [x] 픽스처 데이터가 생성 타입으로 타입 검사를 통과한다(`typecheck`)
  - [x] components E2E에서 `/dev/api-check`의 서버 목록, 브라우저 요청 개수, 내부 API 제목이 모두 픽스처 값과 같다
  - [x] prod·components·visual 프로젝트가 픽스처 서버를 쓰는 구성으로 돈다(`pnpm test:e2e`, `pnpm test:visual`)
  - [x] `pnpm build:verify`와 `pnpm docker:build`가 백엔드와 `INTERNAL_API_KEY` 없이 통과한다
- 거부
  - [x] 픽스처 서버에 `X-Internal-Key`가 틀리면 401이다. 프론트 `createInternalApi`의 키가 틀리면 페이지가 빈 값이 아니라 오류로 끝난다
  - [x] 서버 런타임에 `INTERNAL_API_KEY`가 없으면 기동 또는 첫 요청에서 이름만 담은 오류로 실패한다(값 미노출)
  - [x] 브라우저 번들(`.next/static/**`)에 `INTERNAL_API_KEY` 값과 `X-Internal-Key` 사용 코드가 없다
  - [x] 운영 빌드에서 `/dev/api-check`는 404다. 브라우저 경로 `/internal/posts/x`도 404다
- 회귀
  - [x] 기존 단위 테스트(343건), E2E(207건), 시각 회귀 24건(기준 이미지 변경 없음), `pnpm verify`가 통과한다
  - [x] CI 필수 검사 8개의 이름과 개수가 그대로다

## 인계 노트

(단계별로 덧붙인다)

### ① 픽스처·테스트 선작성 (test-engineer)

- 픽스처 서버: `frontend/e2e/fixtures/server.ts`(데이터 포함, 파일 하나), 커버 PNG 6장 `frontend/e2e/fixtures/assets/cover-*.png`, 생성 스크립트 `frontend/e2e/fixtures/make-assets.ts`
  - 데이터 모듈을 따로 나누지 않았다. `node server.ts`로 직접 실행하려면 로컬 `.ts` import가 필요한데 `tsconfig`가 `allowImportingTsExtensions`를 허용하지 않아 `typecheck`가 깨지기 때문이다. 나누고 싶으면 devops가 그 옵션을 켠 뒤에 한다
  - 데이터: 카테고리 6, 태그 7, 발행 글 13(featured 1: `designing-cache-strategy`, 분류 없는 글 1, 이전 slug `old-internal-api-guard` → `nestjs-internal-api-guard`). 데이터는 `components['schemas']`로 `satisfies` 검사한다
  - 흉내 내는 경로: `/api/posts`, `/api/posts/{slug}`, `/api/categories`, `/api/tags`, `/api/search`, `/internal/posts/{slug}`, `/uploads/fixtures/{file}`, 상태 확인용 `/__fixture/health`(200)
- 포트·환경변수(기본값)
  - `FIXTURE_API_PORT` 기본 **4100**(3000·3100·3101·4000·4999와 겹치지 않음)
  - `FIXTURE_INTERNAL_KEY` 기본 `e2e-internal-key-not-secret`(서버가 기대하는 키. frontend 서버의 `INTERNAL_API_KEY`에도 같은 값을 넣어야 한다)
  - frontend의 `API_INTERNAL_URL`은 `http://localhost:4100`으로 맞춘다(지금 config는 4999)
- devops가 연결할 실행 명령(`frontend/`에서 실행, `webServer`에 frontend 서버보다 **먼저**)
  - `node --no-warnings e2e/fixtures/server.ts` (Node 24는 타입 제거를 기본 지원. `--no-warnings`는 "module type 미지정" 경고 숨김용). `url`은 `http://localhost:4100/__fixture/health`
  - 이 파일은 `process.env`를 읽는다. `eslint`의 `PROCESS_ENV_ALLOWED_FILES`(`scripts/eslint/base-config.mjs`)에 `frontend/e2e/fixtures/server.ts`를 넣어 주면 파일 안의 `eslint-disable no-restricted-properties` 주석을 지워도 된다
  - 브라우저 `/api/*`·`/uploads/*` 프록시는 `http://localhost:4100`으로 보낸다. `/internal/*`은 프록시하지 않는다(404)
  - 테스트가 `e2e/fixtures/server.ts`를 import해서 데이터(`CATEGORIES_RESPONSE`, `FEATURED_SLUG` 등)와 기본 키를 쓴다. 키를 환경변수로 바꿔 쓰면 `api-env.spec.ts`의 번들 검사도 같은 값을 기본으로 보므로, 기본값 그대로 쓰는 것을 권한다
- 테스트 (총 47 + 20 + 새 env 10)
  - `frontend/test/fixture-server.spec.ts` 47건(Vitest, node 환경, 서버를 포트 0으로 띄워 검사): 경로별 형태·필터·페이지네이션·301·400·401·`redirectTo`·캐시 헤더·`/uploads/*`·405·404·prev/next·related·본문 구성. `pnpm --filter @jblog/frontend test`에 포함된다
  - `frontend/e2e/components/api-check.spec.ts` 7건(components 프로젝트): `/dev/api-check` 200·noindex, 서버 목록, HTML에 서버 렌더 결과, "브라우저 요청" 버튼 → `/api/categories` 1회·개수, 내부 API 제목, 브라우저 요청에 `X-Internal-Key`·`/internal` 없음, HTML·정적 청크에 키 값 없음
  - `frontend/e2e/api-env.spec.ts` 12건(prod 프로젝트): `/dev/api-check` 404, `/internal/posts/x` 404, 올바른 키를 붙여도 `/internal/*` 404, `/api/categories`가 픽스처로 이어짐, `.next`·`.next-components`의 `static/**`에 키 값·`X-Internal-Key` 없음(검사 대상 파일이 있는지 포함), components 서버 번들에는 `X-Internal-Key`가 있음(대조군), 서버 번들에도 키 값 없음
  - `frontend/src/lib/env.schema.spec.ts`: 기존 `validRaw`에 `INTERNAL_API_KEY`를 추가하고 `parseEnv` 6건 + `parseBuildEnv` 5건 추가. `parseBuildEnv`·`INTERNAL_API_KEY` 필드는 `next build` 타입 검사가 지금 깨지지 않도록 느슨한 타입으로 읽는다(구현 후 frontend-dev가 정식 import·타입으로 바꿔도 된다)
- 확인 결과
  - 픽스처 서버 자체 테스트 47건 통과. 서버를 `node`로 직접 띄워 `/api/posts`·`/uploads`·`/internal`(키 있음 200, 없음 401)을 `curl`로 확인
  - `eslint`·`prettier --check`·`typecheck` 통과(픽스처가 생성 타입과 맞음)
  - env 단위 10건 실패(의도): `parseBuildEnv is not a function`, `INTERNAL_API_KEY`가 서버 값에 없음·검증 없음. 그 외 기존 단위 391건 통과
  - Playwright(현 config, 픽스처 연결 전, `api-env`+`api-check` 19건): 7건 실패, 12건 통과
    - 실패(의도): `/dev/api-check` 404(페이지 없음), `api-check-server`·`api-check-internal` 요소 없음, "브라우저 요청" 버튼 없음(타임아웃), `/api/categories`가 prod에서 404(프록시 없음), components 서버 번들에 `X-Internal-Key` 없음
    - 통과(이미 만족하는 거부·회귀 방어): prod `/dev/api-check` 404, `/internal/*` 404, 번들(static)에 키 값·`X-Internal-Key` 없음, 서버 번들에 키 값 없음. 구현 후에도 계속 통과해야 한다
  - 환경 메모: components 페이지·프록시 구성이 없어 서버 렌더·브라우저 요청 테스트는 devops·frontend 구현 뒤에야 통과한다. 키가 틀릴 때 페이지가 오류로 끝나는지(필수 검증 거부 항목)는 서버를 따로 띄워야 해서 ④ 독립 검증에서 다룬다

### ② 실행 환경 연결 (devops-engineer)

- 구성도 (브라우저는 프록시 주소만 안다. 운영에서 Nginx 주소로 접속하는 것과 같다)

  | 프로젝트 | 브라우저(baseURL, 프록시) | Next standalone | 픽스처 API |
  |---|---|---|---|
  | prod | `localhost:3200` | `127.0.0.1:3100` | `localhost:4100` |
  | components·visual | `localhost:3201` | `127.0.0.1:3101` | `localhost:4100` |

  - 프록시 `scripts/e2e/proxy.mjs`(Node 내장 `http`): `/api/*`·`/uploads/*` → 픽스처(4100), `/internal`·`/internal/*` → 404, 나머지 → Next. 상태 확인 `/__proxy/health`. 뒤쪽 연결 실패는 502와 로그로 드러낸다
  - `webServer` 순서: 픽스처 → Next → 프록시(components는 같은 순서로 이어서). 픽스처는 모든 프로젝트가 하나를 공유한다
  - frontend 서버 env: `API_INTERNAL_URL=http://localhost:4100`, `INTERNAL_API_KEY=e2e-internal-key-not-secret`(테스트용 더미, 비밀 아님). `NEXT_PUBLIC_SITE_URL`은 브라우저가 보는 프록시 주소
  - Next는 `HOSTNAME=127.0.0.1`로 고정했다. 시각 회귀 컨테이너에서 `localhost`가 IPv6로 풀려 프록시가 502를 받았기 때문이다(24건 모두 실패 → 고친 뒤 통과)
  - 개발 전용 rewrite(`next.config.ts`)는 그대로이며 E2E는 쓰지 않는다
- 바꾼 파일: `frontend/playwright.config.ts`, `scripts/e2e/proxy.mjs`(신규), `scripts/eslint/base-config.mjs`(`PROCESS_ENV_ALLOWED_FILES`에 `frontend/e2e/fixtures/server.ts`·`scripts/e2e/proxy.mjs`), `scripts/eslint/rules.test.mjs`(허용 경로 시험). `scripts/visual/run.sh`·`frontend/Dockerfile`·`package.json`·CI는 변경 없음(run.sh는 같은 config를 컨테이너에서 그대로 실행)
- 빌드 명령: `build:verify`·`docker:build`에 키를 추가하지 않았다. `build:verify`는 백엔드·`INTERNAL_API_KEY` 없이 통과(`parseBuildEnv`는 frontend-dev 구현 대상). `docker:build`는 이 단계에서 변경이 없어 실행하지 않았다
- test-engineer 확인 필요: `frontend/e2e/fixtures/server.ts` 560행의 `eslint-disable no-restricted-properties` 주석이 이제 불필요해 lint 경고(`Unused eslint-disable directive`) 1건이 난다. 지워도 된다(devops는 수정하지 않음)
- 확인 결과
  - 기존 E2E 포함 `pnpm exec playwright test`(frontend): 218 통과, 8 실패. 시각 회귀 `pnpm test:visual`: 24건 통과(기준 이미지 변경 없음). lint 오류 0·경고 1(위), format·`test:scripts` 통과
  - 남은 실패 8건은 모두 frontend-dev 몫: `/dev/api-check` 없음(404) 때문에 components 7건(200·noindex, 서버 목록, HTML 서버 렌더, 브라우저 요청 버튼, 내부 API 제목, 헤더·경로 검사, 키 노출 검사), `X-Internal-Key`가 components 서버 번들에 없음(`createInternalApi` 없음) 1건
  - 연결 항목은 통과: prod `/api/categories`가 픽스처로 이어짐, `/internal/*` 404(키를 붙여도), `/dev/api-check` prod 404, 번들 키 미노출 검사

### ③ 구현 (frontend-dev)

- 변경: `frontend/src/lib/env.schema.ts`(`INTERNAL_API_KEY` 서버 스키마 최소 16자, `parseBuildEnv` 추가), `frontend/next.config.ts`(`parseBuildEnv` 사용), `frontend/src/lib/env.ts`, `frontend/src/lib/api/server.ts`, `frontend/src/app/dev/api-check/{page.dev.tsx,BrowserCheck.dev.tsx}`
- `env.ts`: 공개 값은 `parseBuildEnv`로 바로 읽고(루트 layout이 빌드 중에 쓰기 때문), `env.server`는 getter로 처음 쓰는 요청 시점에 `parseEnv`(키 필수)로 검증한다. 키가 없으면 빌드는 통과하고 서버 값을 처음 쓰는 요청에서 이름만 담은 오류로 실패한다. 기동 시점 실패는 아니다(필요하면 instrumentation으로 앞당길 수 있으나 지시서가 "기동 또는 첫 요청"을 허용해 첫 요청으로 했다)
- `server.ts`: `createServerApi`·`createInternalApi` 모두 `next: { revalidate: 3600, tags }`, 5xx는 미들웨어에서 예외로 올린다(네트워크 오류는 fetch가 던진다). 내부 클라이언트는 `onRequest`에서 `X-Internal-Key`를 붙인다. 생성 타입이 헤더를 필수 params로 요구해 호출부가 자리 채움 값을 넘기고, 미들웨어가 실제 키로 덮어쓴다(클라이언트 기본 `headers`는 호출별 값에 덮이므로 미들웨어를 택했다)
- 요청 시 렌더(규약 8): `await connection()`(`next/server`). 근거는 `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md` — "rendering should wait for an incoming user request", 호출 지점에서 prerender가 멈춘다. 이 프로젝트는 `cacheComponents`를 켜지 않았지만 Next 16 문서가 이 방식을 안내하고, `dynamic`·`revalidate` 라우트 설정은 문서(`02-route-segment-config/index.md`)상 v16에서 제거 방향이라 쓰지 않았다
- 추천 글 slug는 `/api/posts?featured=true&size=1`로 얻어 내부 API로 제목을 읽는다(페이지가 e2e 픽스처를 import하지 않게)
- 보고: `env.schema.spec.ts`의 느슨한 타입 읽기는 그대로 둔다(test 파일). 이제 정식 import로 바꿀 수 있다. `e2e/fixtures/server.ts` 560행 unused eslint-disable 경고 1건은 test-engineer 몫으로 남아 있다
- 검사(Node 24): 단위 401건 통과(env 10건 포함), `pnpm test:e2e` 226건 통과(api-env·api-check 포함), `pnpm test:visual` 24건 통과(기준 이미지 변경 없음), `pnpm verify` 통과, `pnpm docker:build` 통과(키·백엔드 없이). lint 오류 0·경고 1(위)

### ④ 독립 검증 (test-engineer)

- 정리: `frontend/e2e/fixtures/server.ts`의 불필요한 `eslint-disable` 주석 제거(lint 경고 0), `env.schema.spec.ts`의 느슨한 타입 읽기를 정식 import(`parseBuildEnv`)·타입(`server.INTERNAL_API_KEY`)으로 교체(테스트 의미 유지, 28건 통과)
- 보류했던 거부 검증(서버를 따로 띄워 확인. `frontend/.next-components/standalone/frontend`의 standalone 서버 3101 + 픽스처 4100, `curl /dev/api-check`)
  - 프론트 키가 틀림(`INTERNAL_API_KEY`가 픽스처 키와 다름): 응답 **500**, 서버 로그 `Error: /internal/posts 조회 실패`. 빈 값으로 숨지 않음. 응답·로그에 키 값 없음. 완료
  - 서버에 `INTERNAL_API_KEY` 없음: 서버는 기동하고, 첫 요청이 **500**, 로그 `환경변수가 없거나 올바르지 않습니다: INTERNAL_API_KEY`(이름만). 응답·로그에 키 값 없음. 완료
  - 픽스처 서버 꺼짐: 응답 **500**(연결 실패 오류 로그), 목록 영역(`api-check-server`) 없음. 빈 목록으로 숨지 않음. 완료
  - 주의: standalone의 `.next-components/cache/fetch-cache`에 이전 실행의 응답이 남아 있으면 `revalidate: 3600` 때문에 픽스처가 꺼져 있어도 200이 나온다(Next 데이터 캐시의 정상 동작). 위 확인은 캐시를 지운 뒤 했다. 이 검증은 서버를 따로 띄우는 절차라 자동 테스트로 남기지 않았다
- 전체 실행(Node 24)
  - `pnpm --filter @jblog/frontend test`: 21파일 401건 통과
  - `pnpm test:e2e`: 226건 통과, 3회 반복 모두 226 통과(흔들림 없음)
  - `pnpm test:visual`: 24건 통과, 기준 이미지 변경 없음(git status 깨끗), `playwright-report`·`test-results` 정리
  - `pnpm verify`: 통과(exit 0, lint 경고 0). `pnpm docker:build`: 통과(키·백엔드 없이)
- 필수 검증 항목별: 성공 4개(타입 검사, api-check E2E, 픽스처 구성 E2E·시각 회귀, 키·백엔드 없는 빌드) 완료. 거부 4개(픽스처 401, 프론트 키 오류 시 오류 종료, 런타임 키 없음 시 이름만 담은 오류, 번들 키 미노출·prod 404) 완료. 회귀(단위·E2E·시각 24건·verify) 완료. 보류·실패 없음
- 남은 확인: "CI 필수 검사 8개의 이름과 개수 그대로"는 `.github/**`가 변경되지 않은 것(②: CI 변경 없음)으로만 확인했고 실제 CI 실행은 push 후 확인 대상이다. 체크박스는 건드리지 않았다

### 오케스트레이터 독립 확인 (깨끗한 클론)

- 대상: `fd83947` (`git clone --branch feat/M2-E-data-env` → `pnpm install --frozen-lockfile`, Node 24)

| 명령 | 결과 |
|---|---|
| `pnpm --filter @jblog/frontend test` | 401건 통과 |
| `pnpm verify` | 종료 코드 0 (`build:verify`는 백엔드·`INTERNAL_API_KEY` 없이) |
| `pnpm test:e2e` | 226건 통과 (픽스처 서버 + E2E 프록시) |
| `pnpm test:visual` (고정 컨테이너) | 24건 통과, 기준 이미지 변경 없음 |
| `pnpm docker:build` | 종료 코드 0 (키·백엔드 없이) |

- `.github/**` 변경 없음(`git diff 2ff65b3..HEAD -- .github` 0건). CI 필수 검사 이름·개수는 push 후 CI에서 확인한다
- 에러 수정 횟수: 자체 검사 0, Codex 0, CI 0

### Codex r1 대응 ① (test-engineer)

- 지적 #2 (픽스처 서버): `frontend/e2e/fixtures/server.ts`가 `decodeURIComponent` 실패(URIError)를 공통 에러 형식(`VALIDATION_FAILED`) 400으로 답하고, 그 밖의 예외는 로그 + 500(`INTERNAL_ERROR`)으로 답해 프로세스가 죽지 않는다. 회귀 테스트(`frontend/test/fixture-server.spec.ts`): `/api/posts/%`·`/internal/posts/%` → 400 공통 형식, 이후 정상 요청 200. 통과(50건).
- 지적 #1 (운영 필수 키): `frontend/e2e/prod-env-guard.spec.ts` 추가(prod 프로젝트). prod 빌드 산출물(`.next/standalone/frontend/server.js`)을 별도 프로세스로 띄운다(포트 3102·3103, 필요한 환경값만 명시 전달).
  - 키 없음: 종료 코드 != 0 또는 첫 요청 5xx여야 하고, 출력에 `INTERNAL_API_KEY` 이름은 있고 키 값·다른 비밀 값(표지 값)은 없어야 한다. **현재 실패**: `exit=null status=200`(키 없이도 `/`가 200) — 의도한 이유.
  - 키 있음: 첫 요청 200, 출력에 값 없음. 통과.
- 전체 prod 프로젝트: 120 통과 / 1 실패(위 의도된 실패). typecheck·prettier 통과.
- frontend-dev 참고: 서버 기동 시점(예: `instrumentation.ts`의 `register()`에서 `env.server` 접근) 또는 루트 layout 등 모든 요청이 거치는 곳에서 서버 설정을 검증한다. 단 빌드(`next build`)는 키 없이 통과해야 한다(`NEXT_PHASE`가 build일 때는 건너뛰기 등). 오류 메시지에는 변수 이름만 담는다.

### Codex r1 대응 ② (frontend-dev)

- 지적 #1: `frontend/src/instrumentation.ts`의 `register()`가 `env.ts`의 `verifyRuntimeEnv()`를 부른다. 운영 서버 기동 시 `parseEnv`(INTERNAL_API_KEY 포함)를 검증하고, 키가 없으면 종료 코드 != 0으로 기동에 실패한다. 오류에는 변수 이름만 있다.
- 근거: Next 16 문서(`01-app/02-guides/instrumentation.md`)는 `register`가 서버 인스턴스 시작 시 한 번 호출되고 끝나야 요청을 받는다고 한다. standalone `server.js`에서 실제로 실행됨을 `prod-env-guard`로 확인했다(키 없음 실패, 키 있음 200). 문서는 빌드 중 호출 여부를 명시하지 않아, `NEXT_RUNTIME !== 'nodejs'`(Edge)와 `NEXT_PHASE === PHASE_PRODUCTION_BUILD`(빌드)는 건너뛴다. 키 없는 `build:verify`·`docker:build`는 통과한다.
- `process.env` 읽기는 lint 규칙상 `lib/env.ts`에서만 가능해 검증 함수를 거기에 두었다. `env.server` getter 동작은 그대로다.
- 검사: 단위 404건, `test:e2e` 228건(prod-env-guard 2건 포함), `test:visual` 24건(기준 이미지 변경 없음), `pnpm verify` 0, `pnpm docker:build` 0.
