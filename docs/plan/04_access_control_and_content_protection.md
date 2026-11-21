# jblog 접근 통제 & 콘텐츠 복사 방지 기획서

> 버전 v0.1 · 작성일 2026-11-20
> 관련: [개요](./00_overview.md) · [백엔드](./01_backend_plan.md) · [프론트엔드](./02_frontend_plan.md) · [AI 자동 작성(MCP)](./03_ai_authoring_mcp_plan.md)

---

## 요구사항

| # | 요구사항 | 확정된 결정 |
|---|---|---|
| R1 | 포트폴리오/블로그 **작성 서비스는 허용된 사람만** 접근 가능 | 사용자 **본인 1명**. **GitHub OAuth + 허용 목록**(GitHub 사용자 ID). 네트워크 차단 없이 **앱 인증만** |
| R2 | **읽기 페이지**에서는 콘텐츠 복사 방지 | **본문 차단, 코드블록은 "복사" 버튼으로만 허용** |

---

## Part 1. 작성 서비스 접근 통제 (R1)

### 1.1 보호 대상

| 경로 | 내용 | 보호 방식 |
|---|---|---|
| `/admin/**` (Next.js) | 관리자 화면 | Next.js middleware에서 세션 검증, 실패 시 로그인으로 이동 |
| `/api/admin/**` (NestJS) | 작성/수정/삭제/업로드 API | 글로벌 `AuthGuard` 기본값(관리자 JWT + tokenVersion + 허용 목록). 인증 방식이 다른 경로는 전용 데코레이터로만 예외 ([백엔드 §5.6 경로별 인증·CSRF 표](./01_backend_plan.md#56-인증-상세)) |
| `/mcp` (NestJS) | AI 작성 MCP 서버 | MCP 토큰 (owner만 발급 가능, [03 §4](./03_ai_authoring_mcp_plan.md#4-인증--보안)) |
| `/api/docs` | Swagger | **운영에서 비활성화** |
| `/admin/preview/[id]` | 드래프트 미리보기 | `/admin/**`와 동일 |

### 1.2 원칙

1. **회원가입 없음**: 가입 엔드포인트가 존재하지 않는다. 계정은 허용 목록에 있는 GitHub 계정이 처음 로그인할 때 1회 생성된다.
2. **허용 목록은 GitHub 숫자 ID로**: 사용자명(login)은 바꿀 수 있으므로 쓰지 않고, 바뀌지 않는 `id`(예: `12345678`)를 환경변수 `ADMIN_GITHUB_ID`로 지정한다.
3. **기본 차단**: API는 글로벌 가드로 모든 요청에 관리자 인증을 요구하고, 다른 인증 방식(`@Public()`, `@OAuthFlow()`, `@RefreshAuth()`, `@InternalOnly()`, `@McpAuth()`)은 라우트마다 하나만 명시한다. 새 엔드포인트를 추가할 때 실수로 열리는 일을 막기 위해서다.
4. **매 요청 재확인**: 토큰 발급 시점뿐 아니라 refresh와 MCP 토큰 검증 때마다 허용 목록을 다시 확인한다. 환경변수에서 ID를 빼고 재시작하면 기존 세션과 MCP 토큰이 즉시 무효가 된다.
5. **GitHub 계정 보안이 곧 관리자 보안**: GitHub 계정에 2FA(가능하면 Passkey)를 반드시 설정한다 (운영 체크리스트 항목).

### 1.3 로그인 흐름

```
[/admin/login]  "GitHub로 로그인" 버튼
   │
   ▼  GET /api/auth/github
[NestJS] state(랜덤) 생성 → httpOnly 쿠키 jb_oauth_state(5분) → 302 github.com/login/oauth/authorize
         (scope: read:user — 이메일/레포 권한 불필요)
   │
   ▼  사용자 GitHub 인증 (GitHub 2FA)
   │
   ▼  GET /api/auth/github/callback?code&state
[NestJS] 1) state 쿠키와 일치 확인 (CSRF 방지)
         2) code → access_token 교환 (서버 간 통신, client_secret 사용)
         3) GET api.github.com/user → id, login, avatar_url
         4) id === ADMIN_GITHUB_ID ?
              ├─ 아니오 → LoginAudit(DENIED) 기록 → 302 /admin/login?error=not_allowed (계정 미생성)
              └─ 예     → User upsert(githubId) → jb_at/jb_rt 쿠키 발급 → LoginAudit(SUCCESS) → 302 /admin
         5) GitHub access_token은 저장하지 않고 폐기한다 (이후 GitHub API를 쓰지 않음)
```

| 항목 | 값 |
|---|---|
| 라이브러리 | `@nestjs/passport` + `passport-github2` |
| GitHub OAuth App | 운영용과 로컬용(`http://localhost:3000/api/auth/github/callback`)을 **분리** 등록 |
| 세션 쿠키 | 기존 설계 유지: `jb_at` JWT 15분(Path=/), `jb_rt` 랜덤 7일(Path=/api/auth, SameSite=Strict), Refresh 회전 + 재사용 감지 |
| 로그인 시도 제한 | `/api/auth/github*` 10회/분/IP |
| 로그아웃 | `POST /api/auth/logout` → 현재 refresh revoke + 쿠키 삭제 |
| 모든 기기 로그아웃 (즉시 차단) | 해당 사용자의 refresh 전부 revoke **+ `User.tokenVersion` 증가**. access JWT에 담긴 `tv`가 DB 값과 달라지므로 이미 발급된 access 토큰도 **다음 API 요청부터 즉시 401**이다. 잔여 15분 유효시간은 남지 않는다 ([백엔드 §5.6](./01_backend_plan.md#56-인증-상세)). refresh 재사용(탈취 의심) 감지 시에도 같은 처리 |

### 1.4 프론트엔드 보호 (`frontend/src/middleware.ts`)

```ts
export const config = { matcher: ['/admin/:path*'] };
// /admin/login 제외
// jb_at 쿠키를 jose로 서명/만료 검증 (JWT_ACCESS_SECRET 공유)
//   유효 → 통과
//   없음/만료 → /admin/login?next=<원래 경로>
//     로그인 페이지는 먼저 POST /api/auth/refresh를 조용히 시도하고, 성공하면 next로 복귀 / 실패하면 GitHub 로그인 버튼 노출
```
- 미인증 사용자에게는 관리자 화면의 HTML 셸조차 보내지 않는다.
- 데이터 보호의 최종 책임은 API 가드에 있다. middleware는 1차 관문이다. middleware는 DB를 조회하지 않으므로 tokenVersion 폐기는 모른다. 폐기된 세션은 화면 셸이 열려도 첫 API 호출에서 401을 받고 로그인 페이지로 이동한다.
- `/admin/**` 응답에 `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`를 붙인다 (Nginx와 Next headers 둘 다 설정).

### 1.5 감사 & 모니터링

| 항목 | 내용 |
|---|---|
| `LoginAudit` | 시각, 결과(SUCCESS/DENIED/ERROR), GitHub id/login, IP 해시, User-Agent |
| 관리자 화면 | 설정 > 보안: 최근 로그인 기록 20건, 활성 세션(refresh) 목록과 개별 폐기, MCP 토큰 목록 |
| 알림 (P1) | 허용되지 않은 계정의 로그인 시도(DENIED)나 새 기기 로그인 시 이메일/디스코드 웹훅 알림 |

### 1.6 개발/테스트 환경

- 로컬도 실제 GitHub OAuth(로컬용 OAuth App)로 로그인한다. **비밀번호 우회나 개발용 백도어 로그인은 만들지 않는다.**
- E2E 테스트: `NODE_ENV=test`에서만 등록되는 `TestAuthModule`이 테스트용 JWT를 발급한다. 운영 빌드에는 모듈 자체가 포함되지 않게 조건부로 import한다.

### 1.7 기존 설계에서 바뀌는 점

| 항목 | 이전 | 변경 |
|---|---|---|
| 로그인 | 이메일 + 비밀번호(argon2) | GitHub OAuth + 허용 목록 |
| `User` 모델 | `email`, `passwordHash` | `githubId`(unique), `githubLogin`, `avatarUrl` |
| 환경변수 | `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `ADMIN_GITHUB_ID` |
| 시드 | 관리자 계정 생성 | 관리자 계정 시드 없음 (최초 로그인 시 생성) |
| API | `POST /auth/login` | `GET /auth/github`, `GET /auth/github/callback` |

---

## Part 2. 읽기 페이지 콘텐츠 복사 방지 (R2)

### 2.1 적용 범위

| 대상 | 적용 여부 |
|---|---|
| 공개 사이트 `(site)` 그룹: Home, Blog 목록/상세, Projects 목록/상세, About, Search | **적용** |
| 본문 텍스트, 카드 제목/요약, 프로필 소개, 경력 설명, 이미지 | 차단 |
| 코드블록 | 선택/드래그 복사는 차단하고, **우측 상단 "복사" 버튼으로만** 복사 가능 |
| 입력 요소 (검색창 등) | 예외 (선택/붙여넣기 정상 동작) |
| **연락처** (이메일 주소, 소셜 링크 텍스트 — ContactSection, Footer Info, AuthorInfoBox) | **예외** (`.allow-select`). 이메일 옆에 "주소 복사" 버튼 제공. 채용 담당자가 연락처를 옮겨 적지 않아도 되게 한다 |
| 인쇄 / PDF 저장 | 차단 유지. 채용 검토용 자료는 **이력서 PDF 다운로드**(Hero 보조 링크, About)로 제공한다 |
| 관리자 `/admin/**` (에디터, 미리보기 포함) | **미적용** |

### 2.2 구현 계층

**① CSS — 선택 자체를 막는다** (`globals.css`)
```css
.content-protected {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;      /* iOS 길게 눌러 복사/저장 메뉴 */
}
.content-protected input,
.content-protected textarea,
.content-protected [contenteditable="true"],
.content-protected .allow-select {
  -webkit-user-select: text;
  user-select: text;
}
.content-protected img { -webkit-user-drag: none; }

@media print {                       /* 인쇄/PDF 저장 차단 */
  .content-protected main { display: none !important; }
  .content-protected::after { content: "이 콘텐츠는 인쇄할 수 없습니다."; display: block; padding: 48px; text-align: center; }
}
```
`(site)/layout.tsx`의 루트 래퍼에 `className="content-protected"`를 붙인다.

**② JS — 이벤트를 막는다** (`components/protection/CopyGuard.tsx`, Client Component, `(site)/layout`에 1회 마운트)

| 이벤트 | 처리 |
|---|---|
| `copy`, `cut` | 선택 영역이 입력 요소나 `.allow-select` 안이 아니면 `preventDefault()` + 안내 토스트 "콘텐츠 복사가 제한되어 있습니다" (같은 토스트는 3초에 1번만) |
| `contextmenu` | 입력 요소·`.allow-select`가 아니면 차단 (우클릭 메뉴, 이미지 저장) |
| `dragstart` | 이미지/링크/텍스트 드래그 차단 |
| `selectstart` | 입력 요소·`.allow-select`가 아니면 차단 (CSS 보조) |
| `keydown` | `Cmd/Ctrl + S, P`는 항상 차단. `Cmd/Ctrl + C, X`는 **현재 선택 영역이 입력 요소나 `.allow-select` 안에 있으면 허용**, 아니면 차단. `Cmd/Ctrl + A`는 입력 요소 포커스 중에만 허용 (페이지 전체 선택 방지). `Cmd/Ctrl + F`(찾기)는 허용 |

**예외 판정 규칙 (모든 이벤트 공통)** — 입력 요소와 일반 텍스트를 다르게 판정한다.

```ts
const EDITABLE = 'input, textarea, [contenteditable="true"]';

// 1) 입력 요소: 먼저 허용한다.
//    input/textarea 안의 선택은 window.getSelection()에 잡히지 않고 selectionStart/selectionEnd로만 보이므로,
//    페이지 선택 범위 검사를 적용하면 검색창 복사가 잘못 막힌다.
function isEditableContext(event: Event): boolean {
  const target = event.target as Element | null;
  const active = document.activeElement;
  return Boolean(target?.closest(EDITABLE) || active?.closest(EDITABLE));
}

// 2) 일반 텍스트: 선택 범위의 시작·끝이 모두 .allow-select 안에 있을 때만 허용한다.
function isAllowedTextSelection(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;
  const inAllowed = (node: Node | null) =>
    Boolean((node instanceof Element ? node : node?.parentElement)?.closest('.allow-select'));
  return inAllowed(selection.anchorNode) && inAllowed(selection.focusNode);
}
```

| 이벤트 | 허용 조건 |
|---|---|
| `copy`, `cut`, 단축키 C/X | `isEditableContext(event) \|\| isAllowedTextSelection()` |
| `selectstart`, `contextmenu` | `isEditableContext(event) \|\| event.target.closest('.allow-select')` |
| 단축키 A | `isEditableContext(event)` (입력 요소 안에서의 전체 선택만) |

연락처 텍스트에서 본문까지 걸쳐 드래그한 경우는 2)에서 차단된다.
| `beforeprint` | CSS로 처리하므로 JS는 사용하지 않음 |

- 이벤트 리스너는 `document`에 한 번만 등록하고 언마운트 시 해제한다.
- 이미지: `MdImage`, 카드 썸네일에 `draggable={false}`.

**③ 코드블록 복사 버튼** (`CodeBlock`)
- 버튼 클릭 → `navigator.clipboard.writeText(코드 원문)`. 이 API는 `copy` 이벤트를 발생시키지 않아 CopyGuard와 충돌하지 않는다.
- 복사 완료 시 아이콘을 체크로 2초간 바꾸고 `aria-live`로 "복사됨"을 알린다.
- 코드블록 안의 텍스트도 드래그 선택은 막는다 (버튼으로만 복사).

**④ 데이터 노출 줄이기 (우회 경로 차단)**

복사를 막아도 API가 원문 Markdown을 그대로 내주면 의미가 없다. 원문 노출 경로를 함께 줄인다.

| 경로 | 조치 |
|---|---|
| 글/프로젝트 원문 `contentMd` | 브라우저는 본문 원문이 필요 없다 (공개 페이지는 RSC로 서버에서 렌더링). 공개 API(`/api/posts/:slug`, `/api/projects/:slug`)는 **원문을 절대 포함하지 않는다**. 원문은 **별도 내부 엔드포인트** `/internal/posts/:slug`, `/internal/projects/:slug`(메타+원문 단일 응답)로만 제공한다. 이 경로는 Nginx가 외부에 노출하지 않고, `X-Internal-Key`도 함께 검사한다 ([백엔드 §4.5](./01_backend_plan.md#45-내부-api-internal-web-ssr-전용)). 같은 URL이 요청자에 따라 다른 응답을 내지 않으므로 캐시 오염 위험이 없다 |
| RSS `/feed.xml` | 전문 대신 **요약(excerpt) + 링크**만 제공 (기존 설계 유지) |
| JSON-LD `BlogPosting` | `articleBody`를 넣지 않는다 |
| OG/메타 description | excerpt(160자)만 노출 |
| Nginx | `location /internal/ { return 404; }`로 외부 접근 차단. 추가로 `/api/*` 프록시에서 `X-Internal-Key` 헤더를 제거(`proxy_set_header X-Internal-Key "";`)한다 |

### 2.3 한계 (문서화 및 합의 사항)

복사 방지는 **일반 방문자의 손쉬운 복사를 막는 억제 장치**다. 아래 방법은 기술적으로 막을 수 없다.

- 브라우저 개발자 도구, 소스 보기(HTML에 본문이 포함됨 — SEO를 위해 필요)
- JavaScript 비활성화 후 접근 (CSS의 선택 차단은 남지만, 소스 보기로 우회 가능)
- 스크린샷/OCR, 브라우저 읽기 모드, 번역 기능, 크롤러

추가 억제 수단(P2, 필요하면 검토): 본문 이미지 워터마크(업로드 시 sharp로 합성), 페이지 하단 저작권 고지 및 무단 전재 금지 문구.

### 2.4 부작용 & 대응

| 영향 | 대응 |
|---|---|
| 접근성: 스크린리더 | `user-select`는 스크린리더 읽기에 영향이 없다. 키보드 탐색과 포커스도 정상 동작 |
| 접근성: 확대·번역·사전 기능을 쓰는 사용자 | 텍스트 선택이 필요한 보조 기능 일부를 쓸 수 없다. 요구사항에 따른 **의도된 트레이드오프**로 기록한다 |
| 채용 담당자 | 연락처는 복사할 수 있고(§2.1 예외), 인쇄 대신 이력서 PDF를 내려받을 수 있다 |
| SEO | HTML에 본문이 그대로 있으므로 검색 노출에 영향 없음 |
| 찾기(Cmd+F) | 허용 |
| 링크 클릭/공유 | 정상. 글 상단에 "링크 복사" 공유 버튼을 둔다 (URL만 복사) |
| 관리자 본인 | 공개 페이지에서도 차단된다. 원문은 관리자 에디터에서 사용한다 |

### 2.5 테스트

| 항목 | 방법 |
|---|---|
| 선택 차단 | Playwright: 본문을 트리플클릭/드래그 → `window.getSelection().toString() === ''` |
| 복사 차단 | `Cmd+C` 키 입력 후 클립보드 비어 있음 확인 (클립보드 권한 부여) |
| 코드 복사 버튼 | 버튼 클릭 → 클립보드 내용이 코드 원문과 일치 |
| 예외 동작 | 검색창 입력/선택/붙여넣기 정상, **검색창에서 일부 선택 후 `Cmd+C`·잘라내기·우클릭 복사 정상**, 이메일·소셜 링크 텍스트 **드래그 선택 + `Cmd+C`** 정상, 우클릭 메뉴 정상, "주소 복사" 버튼 동작, 연락처에서 본문까지 걸친 선택은 차단, `/admin` 에디터에서 복사 정상 |
| 인쇄 | `page.emulateMedia({ media: 'print' })` → 본문 숨김, 안내 문구 표시 |
| API | `GET /api/posts/:slug`에 `contentMd` 없음 (내부 키를 붙여도 없음), 외부 주소로 `/internal/*` 요청 시 404, api 직접 호출이라도 키 없으면 401 |
| 즉시 차단 | "모든 기기 로그아웃" 직후 기존 access 토큰으로 `/api/admin/*` 요청 → 401 |
| 모바일 | iOS Safari/Android Chrome에서 길게 눌러도 복사 메뉴 미노출 (수동 확인) |

---

## 작업 분해

| ID | 작업 | 영역 | 마일스톤 |
|---|---|---|---|
| SEC-01 | GitHub OAuth(passport-github2), 허용 목록 검사, state 검증, User 모델 변경 | BE | M3 |
| SEC-02 | 글로벌 `AuthGuard` + 인증 방식 데코레이터 + 부팅 시 검사, 경로별 CSRF 적용, refresh/MCP 검증 시 허용 목록 재확인 | BE | M3 |
| SEC-03 | LoginAudit, 활성 세션 목록/폐기, "모든 기기 로그아웃"(tokenVersion 즉시 차단) | BE/FE | M3 |
| SEC-04 | Next.js middleware(JWT 검증), 로그인 페이지(조용한 refresh → GitHub 버튼), noindex/no-store 헤더 | FE | M3 |
| SEC-05 | 원문 내부 엔드포인트 `/internal/*`, `InternalKeyGuard`, Nginx `/internal/` 차단 + 헤더 제거 | BE/Infra | M2 |
| SEC-06 | `.content-protected` CSS, `CopyGuard`, 연락처 예외(`.allow-select`, 주소 복사 버튼), 코드블록 복사 버튼, 이미지 드래그 차단, 인쇄 차단 | FE | M2 |
| SEC-07 | 테스트 (§1.6, §2.5) + 운영 체크리스트(GitHub 2FA, Swagger 비활성화, OAuth App 분리) | QA | M5 |
