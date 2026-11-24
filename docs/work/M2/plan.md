# M2 블로그 읽기 — 작업 계획서

> 작성 2026-11-24 · 상태: **G1 승인됨 (2026-11-24, 개발자)** · Codex 기획 검수 r1~r3 반영 · Issue #51
>
> **기준 문서**
> - [전체 체크리스트 M2](../00_master_checklist.md#m2-블로그-읽기)
> - [개요](../../plan/00_overview.md) §7(M2 행)·§8
> - [백엔드 기획서](../../plan/01_backend_plan.md) §3.3·§4.1·§4.2·§4.5·§5.4·§5.7·§5.8·§7
> - [프론트엔드 기획서](../../plan/02_frontend_plan.md) §4·§5.1-a·§5.2·§5.3·§6.1~§6.3·§6.6·§7.1-a·§9·§10
> - [접근 통제 기획서](../../plan/04_access_control_and_content_protection.md) Part 2
> - [UI 디자인 기획서](../../ui_design/ui_design_spec.md) v0.6 §5.3~§5.7·§7.1~§7.3·§7.6·§7.7·§9·§11
> - [협업 아키텍처](../../plan/05_collaboration_architecture.md) v0.10
> - [M1 report](../M1/report.md)
>
> **디자인 기준 (개발자 지시 2026-11-24):** 로컬 참고 스크린샷 `docs/ui_design/references/`를 쓴다. 공개하지 않으며 `.gitignore` 대상이다. Figma 원본으로 확인할 일은 #27에 남긴다.

## 1. 목표

시드 데이터로 공개 블로그가 동작하게 한다. 범위는 Home의 블로그 섹션, `/blog`(카테고리·태그 필터), `/blog/[slug]`, `/search`, 복사 방지다.

- **백엔드:** 공개 조회 API(글·카테고리·태그·검색), 원문 내부 API(`/internal/*`), 응답 유형별 캐시 헤더
- **프론트엔드:** Markdown 렌더링, 카드 컴포넌트, 블로그 페이지, SEO, 복사 방지
- **디자인 검수:** 원본에 있는 카드·본문은 참고 스크린샷으로 대체 비교하고, 재구성한 페이지는 규칙 준수를 검사한 뒤 시각 회귀 기준 이미지를 확정한다(UI §11, M1-05 방식)

**M2에서 하지 않는 것:**

| 항목 | 넘기는 곳 |
|---|---|
| 관리자·인증 | M3 |
| outbox 캐시 갱신과 revalidate webhook, RSS·사이트맵 | M3 (FE-08·BE-07). M2는 시간 기반 재검증(`revalidate: 3600`)만 쓴다 |
| 프로필·프로젝트·기술스택 API와 화면(ProfileHero, AuthorInfoBox 등) | M4 |
| 조회수·좋아요 | M6 (`FEATURE_REACTIONS` 꺼짐) |
| 미디어 업로드 | M3 |

## 2. 작업 목록

작업 1개 = 브랜치 1개 = PR 1개다. **구현은 한 번에 1개씩** 한다(협업 §4.4).

| ID | 작업 | 실행 방식 · 참여 역할 | 난도 · 모델 | 의존 |
|---|---|---|---|---|
| **M2-01** | **API 계약**(공유 계약, `contract/`)<br>• 공개 API `GET /posts`·`/posts/:slug`(메타, `prev`·`next`·`related`, 이전 slug면 301)·`/categories`·`/tags`·`/search` DTO<br>• 내부 API `GET /internal/posts/:slug` DTO(`post`+`contentMd`+`version`, `prev`, `next`, `related`, 또는 `redirectTo`)<br>• 컨트롤러 시그니처만 두고 구현은 501<br>• `backend/openapi.json`과 생성 타입 `frontend/src/generated/**` 갱신<br>• 환경변수 `INTERNAL_API_KEY`를 backend·frontend `.env.example`에 이름만 추가 | 계약 책임자 단계별 · backend-dev(DTO·OpenAPI) → devops-engineer(`.env.example`) → test-engineer(계약 테스트: 공개 응답에 `contentMd` 키 없음, 목록 형태 §4.1) | 보통 · Sonnet | M1 |
| **M2-02** | **디자인 토큰 추가**(공유 계약)<br>• 토큰 대조 결과 없는 것: 코드 블록 배경 `code-bg`(Light `#F6F6F7` / Dark `#141624`, UI §7.3)<br>• 인라인 코드 글자는 §9에 따라 `primary-text`로 바꾼다<br>• UI §7.3 갱신을 같은 PR에 넣는다<br>• 나머지(카드 `surface`·`border`·`shadow-md`, 오버레이 `overlay`, 스켈레톤 `bg-subtle`)는 이미 있다 | 계약 · test-engineer(값·대비 테스트) → frontend-dev | 낮음 · Sonnet | M1 |
| **M2-E** | **프론트 데이터 실행 환경**(§6 결정 1·6)<br>• 픽스처 API 서버: OpenAPI 생성 타입으로 타입 검사한 고정 응답. 공개 `/api/*`와 내부 `/internal/*`(키 검사 포함)를 흉내 낸다<br>• Playwright `webServer`에서 frontend 빌드보다 **먼저** 띄운다. prod·components·visual 프로젝트가 함께 쓴다<br>• 서버 컴포넌트 조회(`API_INTERNAL_URL`)와 브라우저 요청(Load More의 `/api/*`)을 standalone 서버에서도 연결한다. 개발 전용 rewrite에 기대지 않는다<br>• 일반·Docker 빌드가 백엔드 없이 통과하는 방식을 결정 6대로 맞춘다. 조회 실패를 빈 목록으로 삼키지 않는다<br>• `INTERNAL_API_KEY`를 서버 전용으로 주입한다(`env.ts` 스키마) | 서브에이전트 조합 · devops-engineer(Playwright·빌드·CI 연결) → test-engineer(픽스처 데이터·환경 검증 테스트) → frontend-dev(`env.ts`·API 클라이언트의 서버/브라우저 주소 분리) | 보통 · Sonnet | M2-01 |
| **M2-03** | **BE-03 공개 조회 API**<br>• posts 목록·필터(`category`, `tag`, `featured`), 페이지네이션 §4.1<br>• 상세 메타(`prev`·`next`·`related` 3개)<br>• 이전 slug → `301` + `Location`(`PostSlug`)<br>• categories(발행 글 수), tags(글 수)<br>• 검색: `pg_trgm` ILIKE, 제목 일치 우선, q 2자 미만이면 400<br>• `Cache-Control`: 공용 `public, max-age=60, stale-while-revalidate=300`, 검색 `public, max-age=30`(§5.7-①)<br>• 발행 조건 `status=PUBLISHED AND publishedAt<=now()`<br>• 시드 보강(§4) | 서브에이전트 조합 · test-engineer(통합 테스트 선작성: 비공개·예약 글 제외, 301, 검색 정렬, 캐시 헤더) → backend-dev → test-engineer | 보통 · Sonnet | M2-01 |
| **M2-04** | **BE-04a / SEC-05 원문 내부 API**<br>• `GET /internal/posts/:slug`: 메타+원문+이전/다음/관련을 **한 응답**으로, 읽기 전용 `REPEATABLE READ` 스냅샷(§4.5·§5.8)<br>• 이전 slug면 `{ redirectTo }`<br>• `InternalKeyGuard`(`X-Internal-Key`, 키 없음·불일치 401)<br>• `Cache-Control: private, no-store`<br>• **요청 로그에서 `X-Internal-Key` 헤더를 가린다**(pino redact, 개요 §6-b). 지금은 authorization·cookie만 가린다<br>• 전역 prefix `/api` 제외<br>• `/internal/projects/:slug`는 프로젝트 모델·API와 함께 **M4로 넘긴다**(§6 결정 4) | 서브에이전트 조합 · test-engineer(키 없음·불일치 401, 원문 포함, 스냅샷 일관성, 헤더, **정상·401 요청 모두 로그에 테스트 키가 남지 않음**) → backend-dev → test-engineer | 보통 · Sonnet (가드·트랜잭션) | M2-01 |
| **M2-05** | **FE-04 Markdown 파이프라인**(`frontend/src/lib/markdown`)<br>• 프론트 §5.3 순서: gfm → 콜아웃·이미지 캡션·코드 제목 → slug·헤딩 앵커 → shiki(light/dark) → sanitize → 컴포넌트 매핑<br>• `extractHeadings()`<br>• `.prose-jblog`(UI §7.3)<br>• Noto Serif KR(400·700)은 상세 layout에서만 로드(§5.1-a)<br>• `CodeBlock` 복사 버튼은 M2-10에서 붙인다 | 서브에이전트 조합 · test-engineer(단위: `<script>` 제거, 콜아웃·캡션·코드 제목, 헤딩 추출) → frontend-dev → test-engineer | 보통 · Sonnet | M2-02 |
| **M2-06** | **카드 컴포넌트**(UI §5.3~§5.6)<br>• `AuthorMeta`(작성자 1명이라 날짜 + 읽는 시간)<br>• `PostCardGrid`(hover 포함), `PostCardOverlay`, `FeaturedHeroCard`<br>• `CategoryChips`, 카드 스켈레톤<br>• `/dev/components`에 예시 데이터로 추가 | 서브에이전트 조합 · test-engineer(역할·이름·링크·제목 3줄 clamp·Light/Dark) → frontend-dev → test-engineer | 보통 · Sonnet | M2-01(타입), M2-02 |
| **M2-07** | **`/blog` 목록**(UI §7.2, 프론트 §6.2)<br>• PageInfo → 카테고리 칩 → Overlay(필터 없는 1페이지만) → 그리드 9 → LoadMore(`?page=` 동기화, slug 기준 중복 제거)<br>• 태그 필터(`#태그명`, 해제 칩), `loading.tsx` 스켈레톤, 빈 상태<br>• Footer Category에 `/categories` 상위 6개를 연결(M1-04에서 남긴 동적 값) | 서브에이전트 조합 · test-engineer → frontend-dev → test-engineer | 보통 · Sonnet | M2-E, M2-06 (실제 연결 확인은 M2-03 후) |
| **M2-08** | **`/blog/[slug]` 상세**(UI §7.3, 프론트 §6.3)<br>• 내부 API를 **1회만** 호출, `redirectTo`면 `permanentRedirect`, 없는 글은 404(UI §7.7 404 페이지 포함)<br>• 본문 레이아웃: Badge → h1 → AuthorMeta → 커버 → 본문 → 태그 → 이전/다음 → 관련 3<br>• ≥1280 sticky TOC<br>• `generateMetadata`(title 템플릿·canonical·OG), JSON-LD `BlogPosting`·`BreadcrumbList`<br>• 사전 생성은 §6 결정 6을 따른다. 추천안이면 `generateStaticParams`는 빈 목록이고, 첫 요청 때 생성해 캐시한다. 기획 유지안이면 M2-E에서 빌드용 API를 공급한다<br>• AuthorInfoBox는 M4(§6 결정 4) | 서브에이전트 조합 · test-engineer → frontend-dev → test-engineer | 높음 · Opus (내부 API·301·SEO·TOC) | M2-E, M2-05, M2-06 (실제 연결 확인은 M2-04 후) |
| **M2-09** | **`/search`와 Home 블로그 섹션**<br>• `/search?q=`: 동적 SSR, `Search: {q}`·결과 개수·그리드·결과 없음 상태. 임시 페이지를 교체한다(#43)<br>• Home: Featured(**조건부**: featured 글이 있고 발행 글 4개 이상) → Latest Post 6 → View All Post<br>• Hero·프로젝트 섹션은 M4 자리만 둔다<br>• #43의 prefetch는 `/blog`·`/search`만 복원 | 서브에이전트 조합 · test-engineer → frontend-dev → test-engineer | 보통 · Sonnet | M2-E, M2-06 |
| **M2-10** | **FE-05a / SEC-06 복사 방지**(04 Part 2, 프론트 §7.1-a)<br>• `(site)`에만 `.content-protected`, `CopyGuard`(입력 요소·`.allow-select` 예외, `Cmd+F` 허용, 안내 토스트)<br>• 인쇄 차단, `CodeBlock` 복사 버튼, 글 상단 "링크 복사"<br>• Footer 연락처 `.allow-select`와 "주소 복사"(M0 이관 항목) | 서브에이전트 조합 · test-engineer(04 §2.5 E2E) → frontend-dev → test-engineer | 보통 · Sonnet | M2-08 |
| **M2-11** | **디자인 검수**(UI §11, M1-05 방식)<br>• A 대상(PostCardGrid·FeaturedHeroCard·PostCardOverlay·Article 본문)은 참고 스크린샷(`blog-home-*`, `blog-listing-light`, `blog-single-post-light`)과 대체 비교<br>• B 대상(`/blog` 칩·태그 필터, 검색, 코드 블록, TOC, Home 블로그 섹션)은 규칙 준수 검사<br>• 페이지 기준 이미지를 추가(5폭 × Light/Dark)<br>• axe serious/critical 0 | 서브에이전트 조합 · test-engineer → frontend-dev → test-engineer | 보통 · Sonnet | M2-07~M2-10 |
| **M2-12** | M2 report, 체크리스트 진행 현황, M3 착수 조건 확인 | 단일 실행 · docs-writer (+ 오케스트레이터 저장) | 낮음 · Sonnet | M2-11 |

- 화면 작업(M2-06~M2-11) 지시서에는 "필요 토큰" 목록과 "테스트 대상 인터페이스"(props·역할·이름)를 **반드시** 적는다(협업 v0.10 §5.3·§4.3). 토큰이 모자라면 M2-02와 같은 계약 PR을 먼저 연다
- 프론트엔드 화면 작업은 생성 타입과 E2E 픽스처 API(§3 결정 1)를 쓴다. 그래서 M2-01이 Merge되면 백엔드 구현(M2-03·04)을 기다리지 않고 순서를 정할 수 있다(협업 §5.3). 단 실제 연결을 확인하는 통합 스모크는 M2-03·04가 Merge된 뒤에만 가능하다

## 3. 진행 순서

```
M2-01 (API 계약) → M2-02 (토큰 계약) → M2-E (데이터 실행 환경) → M2-03 (BE-03) → M2-04 (BE-04a)
→ M2-05 (Markdown) → M2-06 (카드) → M2-07 (/blog) → M2-08 (상세)
→ M2-09 (검색·Home) → M2-10 (복사 방지) → M2-11 (디자인 검수) → M2-12 (report)
```

- 앞 작업이 Merge를 기다리는 동안 다음 작업의 지시서와 이슈를 준비한다. 검토 대기 PR은 최대 3개다(협업 §4.4)
- 진행 현황표는 첫 작업 PR(M2-01)에서 🔄로, report PR에서 ✅로 바꾼다

## 4. 시드 데이터 (M2-03에서 보강)

| 항목 | 내용 |
|---|---|
| 기존 | Profile 1행, 기본 카테고리, 샘플 글 9개 (`backend/prisma/seed.ts`·`seed-content.ts`) |
| 보강 | 다음을 넣는다.<br>• **카테고리**: 6개 이상(Footer 상위 6)<br>• **글**: 발행 12개 이상. 9개 + Load More 1회분 + Featured 1개 → Home Featured 조건(발행 4개 이상)도 만족<br>• **비공개·예약 글**: 각 1개(공개 조회에서 제외되는지 확인용)<br>• **이전 slug**: 1개(301 확인용)<br>• **태그**: 여러 개<br>• **본문**: 코드 블록·콜아웃·이미지 캡션·h2/h3를 담은 글 1개 이상 |
| 커버 이미지 | **결정 필요(§6 결정 3)**. 미디어 업로드는 M3다 |
| 원칙 | 관리자 계정은 시드하지 않는다. 실제 개인정보를 쓰지 않는다(예시 도메인 `example.com`) |

## 5. 완료 기준 (필수 검증 요약)

상세는 작업마다 지시서에 성공·거부·회귀로 적는다.

| ID | 성공 | 거부·회귀 |
|---|---|---|
| M2-01 | OpenAPI에 공개·내부 엔드포인트와 DTO가 있고, 생성 타입이 최신이다(`gen:api-types --check`) | 공개 DTO에 `contentMd` 없음, 기존 계약 테스트 회귀 없음 |
| M2-02 | 새 토큰이 Light/Dark에 있고 대비 기준을 만족한다 | 기존 토큰 값 변경 없음 |
| M2-03 | 목록·필터·상세·카테고리·태그·검색이 시드 데이터로 기획 형태대로 응답한다. 응답별 `Cache-Control`이 맞다 | 비공개·예약 글이 어디에도 나오지 않음, 이전 slug는 301, q 1자는 400, 공개 응답에 `contentMd` 없음 |
| M2-E | 픽스처 서버로 prod·components·visual E2E가 돈다. 서버 조회와 브라우저 `/api/*` 요청이 모두 연결된다. 일반·Docker 빌드가 백엔드 없이 결정 6대로 통과한다 | 조회 실패를 빈 목록으로 숨기지 않음(실패 시 오류), 내부 키가 브라우저 번들·`NEXT_PUBLIC_*`에 없음, 기존 E2E·시각 회귀 회귀 없음 |
| M2-04 | 키가 맞으면 메타+원문+이전/다음/관련을 한 응답으로 준다 | 키 없음·불일치는 401, `/api/internal/*`로는 접근 불가, `private, no-store`, 정상·401 요청 로그에 키 값 없음 |
| M2-05 | 파이프라인 단위 테스트를 통과한다(콜아웃·캡션·코드 제목·헤딩 추출·shiki 테마 2종) | `<script>`·`on*` 속성 제거(sanitize), 외부 링크 `rel=noopener` |
| M2-06 | 카드 3종·AuthorMeta·칩이 Light/Dark로 `/dev/components`에 나온다. 제목 3줄 clamp, hover | 토큰만 사용, 터치 타겟 44, 포커스 링 |
| M2-07 | 필터·태그 필터·LoadMore·`?page=` 새로고침 복원·빈 상태·스켈레톤이 동작한다 | 필터 상태에서 Overlay 숨김, 중복 카드 없음, 가로 스크롤 없음 |
| M2-08 | 상세가 내부 API 1회 호출로 렌더된다. TOC·이전/다음·관련·메타·JSON-LD가 있다. 상세·Home 데이터 연동 뒤에도 일반·Docker 빌드가 결정 6대로 통과하고, 실행할 때 실제 API에 연결된다 | 이전 slug는 영구 이동, 없는 글은 404, 브라우저 응답·번들에 원문 API 호출 없음 |
| M2-09 | 검색 결과·결과 없음 상태, Home Featured 조건부·Latest 6 | 검색 q 2자 미만이면 안내, #43의 `/blog`·`/search` prefetch 복원 후 콘솔 404 없음 |
| M2-10 | 04 §2.5 E2E: 본문 선택·`Cmd+C`·우클릭·인쇄 차단, 코드 복사 버튼, 연락처 선택 허용, 검색창 정상 | `/admin`(없음)·입력 요소에는 적용 안 됨 |
| M2-11 | A 대체 비교 통과(판정 불가는 기록), B 위반 0, axe 0, 페이지 기준 이미지 확정 | 시각 회귀가 시험용 변경을 검출 |
| M2-12 | 체크리스트 M2 상태 확정, report | 완료·실패·보류를 섞지 않음 |

**M2 완료 확인 (체크리스트):**
- 시드 데이터로 공개 블로그가 동작한다(목록·상세·태그·검색). 실제 스택(Postgres + backend + frontend)에서 확인한다(§6 결정 1)
- 공개 API에 `contentMd`가 없고, `/internal/*`는 키가 없으면 401이다
- M3 착수 조건(개요 §8)을 확인한다

## 6. 개발자 확인이 필요한 사항 (G1)

### 결정 1. 프론트엔드 E2E의 데이터 공급 방식

페이지에 데이터가 생겨서 지금처럼 더미 API 주소만으로는 E2E를 돌릴 수 없다.

- **(추천) 픽스처 API 서버 + 실제 스택 스모크 따로**
  - 프론트 E2E와 시각 회귀는 OpenAPI 생성 타입에 맞춘 **고정 응답 서버**(`frontend/e2e/fixtures`, Playwright `webServer`)를 쓴다. 데이터가 고정돼 기준 이미지가 흔들리지 않고, 백엔드 구현 순서와 무관하게 진행할 수 있다
  - "시드로 공개 블로그 동작"은 별도 **통합 스모크**로 확인한다. Postgres + backend + frontend를 함께 띄운다
    - 1회 실행: 오케스트레이터가 깨끗한 클론에서 실행
    - CI: `integration` 잡에 추가하는 방법은 devops가 M2-03 이후 지시서에서 확정
- 실제 스택만 사용: CI E2E에 DB·백엔드를 함께 띄운다. 실제와 가장 가깝지만, 시드가 바뀌면 기준 이미지가 흔들리고 CI 시간이 늘어난다
- 프론트 E2E에서 MSW로 모킹: 서버 컴포넌트 fetch를 가로채려면 설정이 복잡하다

### 결정 2. 참고 스크린샷으로 대체 비교할 대상

M1과 같은 방식이다. 축소 이미지 기준 ±2px, 채널 ±3이고, 판정할 수 없는 항목은 "원본 확인 불가"로 남긴다.

- 대상: PostCardGrid(`blog-home-*`, `blog-listing-light`), FeaturedHeroCard(`blog-home-*`), PostCardOverlay(`blog-listing-light`), Article 본문(`blog-single-post-light`)
- 한계: Dark는 `blog-home-dark`만 있다. 글 상세 Dark는 참고 이미지가 없으므로 규칙 준수(B)로 확인한다

### 결정 3. 시드 글의 커버 이미지

미디어 업로드는 M3다.

- **(추천) 직접 만든 단색·그라디언트 추상 이미지 몇 장을 `backend/prisma/seed-assets/`에 커밋한다.** 저작권 문제가 없고, 개발 모드에서는 백엔드 `/uploads` 정적 경로로 제공한다. 참고 스크린샷의 사진은 쓰지 않는다
- 외부 무료 이미지(Unsplash 등): 라이선스 표기와 외부 의존이 생긴다
- 커버 없이 진행: 카드 레이아웃(썸네일 360×240) 검수를 할 수 없다

### 결정 4. M4로 넘기는 것 (기획과의 차이 확인)

| 항목 | 기획 위치 | M2 처리 |
|---|---|---|
| 글 상세 하단 AuthorInfoBox | UI §7.3 | 프로필 API(BE-08, M4)가 생긴 뒤 붙인다. M2 상세에서는 빠진다 |
| `/internal/projects/:slug` | 체크리스트 BE-04a | 프로젝트 공개 API와 함께 M4(BE-08)에서 만든다. M2에서는 posts만 만든다 |
| Home의 Hero·기술스택·프로젝트 섹션 | UI §7.1 | M4(FE-09). M2 Home은 블로그 섹션만 둔다 |

### 결정 6. 빌드 시점 데이터 (기획 변경 G2 포함)

프론트 §4는 `/`·`/blog`를 "RSC + ISR"로, 상세를 "최근 50개 `generateStaticParams` 사전 생성"으로 정했다. 그런데 지금 일반 빌드(`pnpm verify`)와 Docker 빌드는 백엔드 없이 돈다. 사전 생성을 하려면 빌드할 때 API가 있어야 한다.

- **(추천) 빌드는 API에 의존하지 않는다.** 데이터 페이지는 요청 때 렌더하고, fetch 데이터 캐시(`revalidate: 3600` + 태그)로 ISR과 같은 무효화 동작을 유지한다
  - 상세는 `generateStaticParams`를 빈 목록으로 두고, 첫 요청 때 생성해 캐시한다
  - 기획에서 바뀌는 것은 "최근 50개 사전 생성" 제거뿐이다(첫 방문 1회만 느림). 태그 무효화·즉시 만료 규칙은 그대로다
  - 프론트 §4 문구 수정은 M2-E PR에 함께 넣는다
- 빌드할 때 API를 띄운다. CI `build`·`docker` 잡과 운영 빌드가 픽스처 서버나 백엔드를 띄운 상태에서 빌드한다. 기획은 그대로지만, Docker 빌드 네트워크 구성이 복잡해지고 운영 빌드가 백엔드 기동에 묶인다

### 결정 5. 작업 분할과 모델

작업은 13개다(M2-E 포함). M2-08(상세)만 Opus이고 나머지는 Sonnet이다.

### G1 결정 (2026-11-24, 개발자)

1. **E2E 데이터**: 픽스처 API 서버 + 실제 스택 통합 스모크 (결정 1 추천안)
2. **대체 비교**: 참고 스크린샷으로 카드 3종과 본문을 비교한다. M1 방식이다
3. **시드 커버 이미지**: 직접 만든 단색·그라디언트 추상 이미지를 `backend/prisma/seed-assets/`에 커밋한다
4. **M4로 넘기는 것**: 상세 AuthorInfoBox, `/internal/projects/:slug`, Home Hero·기술스택·프로젝트 섹션
5. **작업**: 13개, M2-08만 Opus
6. **빌드 시점 데이터 (G2 승인)**: 빌드는 API에 의존하지 않는다. 요청 시 렌더 + fetch 데이터 캐시로 하고, 상세는 첫 요청 때 생성·캐시한다. 프론트엔드 기획 §4의 "최근 50개 사전 생성" 문구는 M2-E PR에서 고친다

## 7. 위험과 대응

| 위험 | 대응 |
|---|---|
| 참고 스크린샷이 축소본이라 카드 크기 판정이 어렵다 | M1처럼 판정 불가는 기록하고 수치는 UI 기획서 값으로 E2E에서 검증한다(spec-values 방식) |
| shiki·Noto Serif KR로 번들·폰트 용량이 커짐 | shiki는 서버 렌더에서만 쓴다(관리자 프리뷰는 M3). Noto Serif KR은 상세 layout에서만 로드 |
| 내부 API 키가 브라우저 번들·로그에 섞임 | `INTERNAL_API_KEY`는 서버 전용이다(`env.ts` 스키마, `NEXT_PUBLIC_` 금지). 번들 검사 테스트는 M2-08, 백엔드 로그 마스킹은 M2-04 |
| 시드·픽스처 데이터 차이로 화면이 달라짐 | 픽스처를 생성 타입으로 타입 검사한다. 통합 스모크에서 실제 응답 형태를 확인한다 |
| 시각 회귀 기준 이미지가 늘어남 | 페이지는 주요 상태만 캡처한다(목록 1페이지, 상세 1개, 검색 결과·없음, Home). 용량은 M2-11에서 보고 |
