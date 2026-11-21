# jblog 프론트엔드 기획서

> 버전 v0.2 · 작성일 2026-11-20 · 개정 2026-11-21: 디렉터리 구조를 기능별(`features/`)로 전환 (§3, 개요 D26)
> 스택: **Next.js (App Router) + React + TypeScript + Tailwind CSS v4**
> 화면/토큰/컴포넌트 스펙의 기준: [UI 디자인 기획서](../ui_design/ui_design_spec.md) · API 계약: [백엔드 기획서 §4](./01_backend_plan.md#4-api-명세)

---

## 1. 역할과 범위

| 영역 | 내용 |
|---|---|
| 공개 사이트 | Home, Blog 목록/상세, Projects 목록/상세, About, Search, 404. SEO와 성능 최우선 |
| 관리자 (`/admin`) | 로그인, 대시보드, 글/프로젝트/경력/기술스택/카테고리/프로필 관리, Markdown 에디터, 미디어 |
| 공통 | Light/Dark 테마, 반응형(4단계), Markdown 렌더링, 조회수·좋아요 UI (M6, 기능 스위치 `FEATURE_REACTIONS`) |

---

## 2. 기술 스택 상세

| 용도 | 라이브러리 | 비고 |
|---|---|---|
| 프레임워크 | Next.js (App Router, React Server Components) | `output: "standalone"` (Docker용) |
| 스타일 | Tailwind CSS v4 | `@theme`에 디자인 토큰 등록, 다크모드는 `@custom-variant dark ([data-theme=dark] &)` |
| 유틸 | `clsx` + `tailwind-merge` (`cn()`), `class-variance-authority` | 컴포넌트 variant 정의 |
| 테마 | `next-themes` (`attribute="data-theme"`) | |
| 폰트 | `next/font/google`: Work Sans(400·500·600·700), Source Serif 4(400·400 italic, =Source Serif Pro 후속), Plus Jakarta Sans(400·600·700·800), Poppins(400·500·600·700), JetBrains Mono(400), **Noto Serif KR(400·700, 글 상세 본문 한글)** / 한글 산세리프: Pretendard Variable(`next/font/local`, woff2) | 필요한 weight만 로드. Noto Serif KR은 글/프로젝트 상세 페이지에서만 로드 (§5.1-a) |
| 아이콘 | `lucide-react` (UI), `simple-icons` (기술스택/브랜드 로고) | 모두 `currentColor` |
| 관리자 UI | shadcn/ui (Button, Input, Dialog, Table, Select, Toast(sonner), Tabs, DropdownMenu) | 관리자 전용. 공개 사이트는 디자인 기획서 기반 자체 컴포넌트 |
| 서버 상태 | TanStack Query (관리자, 좋아요/조회수 클라이언트 부분) | 공개 페이지 데이터는 RSC `fetch` |
| 폼 | React Hook Form + Zod (+ `@hookform/resolvers`) | |
| API 타입 | `openapi-typescript` + `openapi-fetch` | `backend/openapi.json`에서 생성한 `frontend/src/generated/api-types.ts` (수동 수정 금지). 타입 안전한 fetch 클라이언트 |
| Markdown | `unified`, `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-slug`, `rehype-autolink-headings`, `@shikijs/rehype`(듀얼 테마), `rehype-sanitize`, `rehype-react` | `frontend/src/lib/markdown` (공개 페이지·에디터 프리뷰가 함께 쓰는 프론트엔드 내부 모듈) |
| 에디터 | `@uiw/react-codemirror` + `@codemirror/lang-markdown` | |
| 날짜 | `date-fns` (+ `ko` locale) | |
| 테스트 | Vitest, @testing-library/react, MSW(API 모킹), Playwright | |

---

## 3. 디렉터리 구조

```
frontend/src/                         # frontend/ 루트에는 public/, e2e/, package.json, next.config.ts 등
├── app/
│   ├── (site)/                       # 공개 사이트 레이아웃 그룹 (Navbar + Footer)
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Home
│   │   ├── blog/
│   │   │   ├── page.tsx              # 목록 (?category, ?tag, ?page)
│   │   │   └── [slug]/page.tsx       # 상세
│   │   ├── projects/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── about/page.tsx
│   │   └── search/page.tsx
│   ├── admin/
│   │   ├── login/page.tsx
│   │   └── (protected)/              # AdminShell (사이드바) + 인증 확인
│   │       ├── layout.tsx
│   │       ├── page.tsx              # 대시보드
│   │       ├── posts/ (page, new, [id]/edit)
│   │       ├── projects/ ...
│   │       ├── experiences/ ...
│   │       ├── tech-stacks/ ...
│   │       ├── categories/ ...
│   │       ├── media/page.tsx
│   │       ├── profile/page.tsx
│   │       └── preview/[id]/page.tsx # 드래프트 미리보기
│   ├── internal/revalidate/route.ts  # 백엔드 webhook 수신 (Nginx가 /internal/ 외부 차단)
│   ├── feed.xml/route.ts             # RSS
│   ├── sitemap.ts · robots.ts
│   ├── opengraph-image.tsx           # 기본 OG 이미지 (blog/[slug]에도 개별 생성)
│   ├── not-found.tsx · error.tsx
│   ├── layout.tsx                    # <html>, ThemeProvider, 폰트
│   └── globals.css                   # Tailwind + 토큰
├── features/                         # 기능(도메인)별 폴더. 기능 하나의 화면·훅·fetch·스키마를 한곳에 둔다 (개요 D26)
│   ├── posts/
│   │   ├── components/               # PostCardGrid, PostCardOverlay, FeaturedHeroCard, AuthorMeta, PostGrid, LoadMoreGrid, CategoryChips, Toc
│   │   ├── admin/                    # 글·카테고리 관리 화면 조각: PostTable, PostForm, MarkdownEditor, PublishPanel, ConflictDialog
│   │   ├── hooks/                    # useAdminPosts, useDraftAutosave
│   │   ├── api.ts                    # 서버용 fetch 함수 (lib/api/server.ts + 캐시 태그 posts·post:<slug>)
│   │   └── schemas.ts                # Zod 폼 스키마
│   ├── reactions/                    # LikeButton, ViewTracker, useLike (FEATURE_REACTIONS)
│   ├── projects/                     # ProjectCard (+ admin/, hooks/, api.ts, schemas.ts)
│   ├── profile/                      # ProfileHero, TechLogoRow, ExperienceItem, ContactSection, AuthorInfoBox (+ admin/: 프로필·경력·기술스택 편집)
│   ├── media/                        # 관리자 미디어 라이브러리
│   └── search/                       # 검색 결과 목록
├── components/                       # 여러 기능이 함께 쓰는 것만 둔다
│   ├── ui/                           # Atom: Badge, Button, Avatar, Input, ThemeToggle, Icon
│   ├── layout/                       # Navbar, MobileMenu, SearchBox, Footer, PageInfo, Container, Section
│   ├── markdown/                     # MarkdownRenderer, CodeBlock(복사 버튼), Callout, MdImage
│   ├── protection/                   # CopyGuard (공개 사이트 복사 방지)
│   └── admin/                        # AdminShell, DataTable, ImageUploader, TagInput, SortableList (관리자 공용 UI)
├── lib/
│   ├── api/
│   │   ├── server.ts                 # RSC용: API_INTERNAL_URL + next: { tags } (+ /internal/* 원문 조회 시 X-Internal-Key)
│   │   └── client.ts                 # 브라우저용: /api + credentials + X-Requested-With 헤더 + 401 시 refresh 재시도
│   ├── markdown/                     # remark/rehype 파이프라인 (§5.3)
│   ├── seo.ts                        # generateMetadata 헬퍼
│   ├── env.ts                        # 환경변수 스키마 검증, process.env를 읽는 유일한 곳 (개요 §6-b)
│   └── format.ts                     # 날짜, 읽는시간
├── generated/                        # api-types.ts (backend/openapi.json에서 생성, 수동 수정 금지)
└── middleware.ts                     # /admin/** 진입 시 jb_at JWT 검증(jose), 실패 시 /admin/login?next=

# frontend/next.config.ts: rewrites(/api → localhost:4000, dev), images.remotePatterns
```

**계층 규칙 (개요 D26)** — 의존은 위에서 아래로만 흐른다. 아래 규칙은 ESLint로 오류 처리한다 (M0-02).

| 계층 | import할 수 있는 것 | 하지 않는 것 |
|---|---|---|
| `app/` (라우트) | `features/*`, `components/*`, `lib/*`, `generated/` | 비즈니스 로직 작성. `page.tsx`는 데이터를 가져와 기능 컴포넌트에 넘기는 조립만 한다 |
| `features/<기능>/` | 같은 기능 내부, `components/*`, `lib/*`, `generated/` | **다른 기능 import 금지.** 두 기능이 한 화면에 필요하면 `app/`에서 조립한다 (예: 글 상세 = `posts` + `reactions` + `profile`의 AuthorInfoBox) |
| `components/`, `lib/` | `components/*`, `lib/*`, `generated/` | `features/*`·`app/` import 금지 |

- **배럴 파일(`index.ts`)을 두지 않는다.** 서버 컴포넌트와 `'use client'` 컴포넌트를 한 파일에서 다시 내보내면 클라이언트 번들에 서버 코드가 섞이거나 트리 셰이킹이 깨질 수 있다. 파일 경로로 직접 import한다.
- 처음엔 한 기능에서만 쓰던 것을 두 번째 기능이 필요로 하면, 다른 기능에서 가져오지 않고 `components/`·`lib/`로 옮긴다.
- 관리자 화면 조각은 `features/<기능>/admin/`에 둔다. 공개 화면과 같은 기능의 fetch·스키마를 함께 쓰기 위해서다. 관리자 전용 공용 UI(shadcn/ui 기반)는 `components/admin/`.
- 기능 폴더의 하위 구성(`components/`·`admin/`·`hooks/`·`api.ts`·`schemas.ts`)은 필요한 것만 만든다.

---

## 4. 라우팅 & 렌더링 전략

| 경로 | 렌더링 | 캐시 / 무효화 | 데이터 |
|---|---|---|---|
| `/` | RSC + ISR | tags `posts`, `projects`, `profile`, `tech-stacks` | profile, tech-stacks(home), projects(featured), posts(featured 1 + latest 6) |
| `/blog` | RSC + ISR | tag `posts` | `searchParams.category / tag / page` → posts. **Load More**는 클라이언트 컴포넌트가 다음 페이지를 추가 fetch |
| `/blog/[slug]` | RSC + ISR, `generateStaticParams`로 최근 50개 사전 생성 | tags `posts`, `post:<slug>` | 내부 API `/internal/posts/:slug` **한 번 호출**로 메타+원문+이전/다음+관련 글을 같은 버전으로 받음. `redirectTo`가 오면 `permanentRedirect()`. **조회수/좋아요는 클라이언트 아일랜드** (`FEATURE_REACTIONS` 켜졌을 때만) |
| `/projects`, `/projects/[slug]` | RSC + ISR | tags `projects`, `project:<slug>`, `tech-stacks` | 상세는 `/internal/projects/:slug` 한 번 호출 |
| `/about` | RSC + ISR | tags `profile`, `experiences`, `tech-stacks` | |
| `/search` | 동적 SSR (`no-store`) | — | `?q` |
| `/admin/**` | 클라이언트 렌더링 (CSR) | `no-store` | TanStack Query |
| `/feed.xml` | Route Handler + ISR | tag `posts` | |
| `/sitemap.xml` | Route Handler + ISR | tags `posts`, `projects` | 글과 프로젝트 URL 모두 포함 |

**캐시 원칙: 이벤트 기반 갱신이 기본, 시간 기반 갱신은 보조**
- **기본**: 백엔드가 공개 상태를 바꾸는 이벤트(발행, 예약 시각 도달, 비공개 전환, 삭제, slug 변경 등)마다 outbox를 거쳐 정확한 태그를 무효화한다 ([백엔드 §5.7](./01_backend_plan.md#57-캐시-정책--무효화)).
- **보조**: 모든 공개 fetch에 `revalidate: 3600`을 건다. 이것은 무효화가 오래 실패했을 때 데이터가 무한정 오래되지 않게 하는 장치일 뿐이다. 시간 기반 재검증은 만료 후 들어온 요청이 갱신을 일으키고 그 요청에는 이전 응답을 줄 수 있으므로, **노출 지연의 상한으로 표현하지 않는다**.
- 완료 기준(서버 무효화 완료 / 새 요청 / 이미 열린 화면 / 브라우저 캐시)은 [백엔드 §5.7-⑤](./01_backend_plan.md#57-캐시-정책--무효화)를 따른다.

**Revalidate Webhook** (`app/internal/revalidate/route.ts`)
```ts
// POST { tags: string[] }, header x-revalidate-secret
if (req.headers.get('x-revalidate-secret') !== process.env.REVALIDATE_SECRET) return 401;
for (const t of body.tags) revalidateTag(t, { expire: 0 });   // 즉시 만료: 다음 요청은 stale 없이 새로 생성
```
- webhook은 **즉시 만료** 정책을 쓴다. 기본(stale-while-revalidate) 정책은 무효화 후 첫 요청에 이전 응답을 줄 수 있어서 "무효화 이후 새 요청은 최신"이라는 기준을 깨기 때문이다.
- `revalidateTag`의 단일 인자 형태는 최신 Next.js에서 폐기 예정이다. M0에서 Next.js 버전을 고정할 때 **해당 버전 공식 문서로 시그니처와 즉시 만료 옵션을 확인**하고 이 예시를 갱신한다.
- 이 webhook은 서버 캐시만 지운다. 이미 열린 브라우저 화면은 갱신하지 않는다.

**경로 라우팅 규칙** (요청을 누가 받는가)

| 경로 | 운영 (Nginx) | 로컬 (`pnpm dev`) |
|---|---|---|
| `/api/*` | NestJS | Next.js `rewrites` → `localhost:4000` |
| `/mcp` | NestJS | 직접 `localhost:4000/mcp` |
| `/uploads/*` | Nginx 정적 서빙 | Next.js `rewrites` → `localhost:4000/uploads` (api가 dev에서만 정적 서빙) |
| `/internal/*` | **외부 차단 (404)**. web↔api는 내부망 주소로만 호출 | 외부 노출 없음 (각 서버 포트로 직접 호출) |
| 그 외 `/` | Next.js | Next.js |

Next.js 쪽에는 `/api/*` Route Handler를 두지 않는다. 그래서 `/api/*`는 항상 NestJS가 받는다. 확인 기준: E2E에서 `GET /internal/revalidate`와 `GET /internal/posts/x`가 외부 주소로 404인지 검사한다.

**예약 발행**: 예약 시각이 지나면 백엔드의 1분 주기 작업이 캐시 갱신 이벤트를 만들고, 작업자가 처리한 뒤부터 새 요청에 노출된다 (정상 상태에서 예약 시각 후 1분 남짓). 공개 전에 해당 slug로 들어온 요청이 404로 캐시돼도, 같은 무효화(`post:<slug>`)로 지워진다.

**Load More와 캐시**: Load More는 브라우저가 공용 API(`/api/posts?page=n`, `max-age=60`)를 직접 부른다. 따라서 페이지를 연 뒤 발행된 글은 새로고침 전까지 목록 앞쪽에 나타나지 않고, 페이지 경계에서 글이 겹칠 수 있다. 추가된 아이템은 slug 기준으로 중복을 제거한다.

---

## 5. 디자인 시스템 구현

### 5.1 토큰 → Tailwind 매핑 (`globals.css`)

UI 기획서 §3.3 시맨틱 토큰을 CSS 변수로 정의하고, Tailwind `@theme`에서 참조한다.

```css
@import "tailwindcss";
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));

:root {
  --bg: #FFFFFF;  --bg-subtle: #F6F6F7;  --surface: #FFFFFF;  --surface-2: #F6F6F7;
  --border: #E8E8EA;  --border-strong: #DCDDDF;
  --text-strong: #181A2A;  --text-body: #3B3C4A;  --text-muted: #696A75;  --text-subtle: #696A75;  /* muted: AA 대비 위해 원본 #97989F → #696A75 (UI §3.3) */
  --nav-text: #3B3C4A;  --input-bg: #F4F4F5;  --input-placeholder: #696A75;  /* 원본 #A1A1AA → AA 대비 (UI §9) */
  --footer-bg: #F6F6F7;  --footer-link: #3B3C4A;
  --toggle-track: #E8E8EA;
}
[data-theme="dark"] {
  --bg: #181A2A;  --bg-subtle: #242535;  --surface: #181A2A;  --surface-2: #242535;
  --border: #242535;  --border-strong: #3B3C4A;
  --text-strong: #FFFFFF;  --text-body: #BABABF;  --text-muted: #97989F;  --text-subtle: #97989F;
  --nav-text: #FFFFFF;  --input-bg: #242535;  --input-placeholder: #97989F;
  --footer-bg: #141624;  --footer-link: #BABABF;
  --toggle-track: #4B6BFB;
}

@theme inline {
  --color-bg: var(--bg);            --color-bg-subtle: var(--bg-subtle);
  --color-surface: var(--surface);  --color-surface-2: var(--surface-2);
  --color-border: var(--border);    --color-border-strong: var(--border-strong);
  --color-strong: var(--text-strong); --color-body: var(--text-body);
  --color-muted: var(--text-muted);   --color-subtle: var(--text-subtle);
  --color-primary: #4B6BFB;
  --radius-sm: 5px; --radius-md: 6px; --radius-lg: 12px;
  --shadow-md: 0 12px 24px -6px rgb(24 26 42 / 0.12);
  --font-sans: var(--font-work-sans), Pretendard, sans-serif;
  --font-serif: var(--font-source-serif), var(--font-noto-serif-kr), serif;
  --font-jakarta: var(--font-plus-jakarta), Pretendard, sans-serif;
  --font-display: var(--font-poppins), Pretendard, sans-serif;
  --font-mono: var(--font-jetbrains-mono), monospace;
  --breakpoint-tablet: 768px; --breakpoint-laptop: 1024px; --breakpoint-desktop: 1280px;
}
```

- 그라디언트 3종은 유틸리티 클래스로 정의한다: `.text-gradient-primary/orange/blue` (UI 기획서 §3.4, 값은 M1에서 Figma로 확정).
- 타이포 토큰은 `@utility`로 정의한다: `text-h1`(36/40 600), `text-h3`(24/28 600), `text-b4`(16/24) 등. 반응형 축소는 유틸 내부에 미디어쿼리로 처리한다.
- **규칙**: 컴포넌트에서 hex 하드코딩 금지. ESLint 커스텀 룰 또는 `stylelint`로 `#[0-9a-f]{3,6}` 사용을 경고한다.

### 5.1-a 한글 본문 폰트

| 용도 | 영문 | 한글 | 로딩 범위 |
|---|---|---|---|
| UI 전반 | Work Sans | Pretendard Variable | 전 페이지 |
| 글/프로젝트 상세 본문 | Source Serif 4 (400, 400 italic) | **Noto Serif KR (400, 700)** | `blog/[slug]`, `projects/[slug]`, 관리자 에디터 프리뷰에서만 (`next/font`를 해당 layout에서 import) |
| 인용문 | Source Serif 4 Italic | Noto Serif KR 400 (한글은 이탤릭이 없으므로 기울이지 않음) | 위와 같음 |

- `next/font/google`이 한글 폰트를 유니코드 범위별로 나눠 주므로, 실제로 쓰인 글자 범위만 내려받는다.
- 본문 폰트 로딩 전후 레이아웃 흔들림을 줄이기 위해 `adjustFontFallback`을 켠다.

### 5.2 컴포넌트 ↔ 디자인 매핑

| 컴포넌트 | UI 기획서 | 타입 | Props (요약) |
|---|---|---|---|
| `Navbar` | §5.1 | Client(토글/메뉴) + Server(셸) | `active: Route` |
| `ThemeToggle` | §5.1 | Client | — (`role="switch"`) |
| `Badge` | §5.2 | Server | `variant: solid\|soft`, `size: md\|lg`, `href?` |
| `AuthorMeta` | §5.3 | Server | `date`, `readingMinutes`, `size: md\|sm`, `onImage?` |
| `PostCardGrid` | §5.4 | Server | `post: PostSummary` |
| `FeaturedHeroCard` | §5.5 | Server | `post` |
| `PostCardOverlay` | §5.6 | Server | `post` |
| `PageInfo` | §5.7 | Server | `title`, `breadcrumb[]` |
| `Button` | §5.8 | Server/Client | `variant: primary\|outline\|icon\|pillSolid\|pillOutline`, `asChild` |
| `Footer` | §5.9 | Server | categories(동적), profile |
| `ProfileHero` | §6.1 | Server | `profile` (headline의 `**강조**` → gradient span). CTA: 프로젝트 보기 / 기술 글 읽기 + 보조 링크(이력서, 연락하기) |
| `TechLogoRow` | §6.2 | Server | `items: TechStack[]` |
| `ProjectCard` | §6.3 | Server | `project` (썸네일 + 이름 + **한 줄 요약 · 역할 · 핵심 기술 3개**) |
| `ExperienceItem` | §6.4 | Server | `experience` |
| `ContactSection` | §6.5 | Server | `profile` |
| `AuthorInfoBox` | §6.6 | Server | `profile`, `width: full\|article` |
| `LikeButton` | 신규 | Client | `slug`, 초기값 (낙관적 업데이트) |
| `ViewTracker` | 신규 | Client | `slug` (마운트 시 1회 `POST views`, 렌더 없음) |
| `Toc` | UI §7.3 | Client | `headings[]` (IntersectionObserver로 현재 섹션 하이라이트) |
| `LoadMoreGrid` | UI §7.2 | Client | `initial`, `query` |

### 5.3 Markdown 렌더링 (`frontend/src/lib/markdown`)

```
contentMd
 → remark-parse → remark-gfm → (커스텀) remark-callout, remark-image-caption, remark-code-title
 → remark-rehype → rehype-slug → rehype-autolink-headings
 → @shikijs/rehype { themes: { light: 'github-light', dark: 'github-dark-dimmed' } }
 → rehype-sanitize (커스텀 스키마: shiki 클래스/스타일 허용)
 → rehype-react (컴포넌트 매핑: pre→CodeBlock, img→MdImage(next/image), a→외부링크 target=_blank rel=noopener)
```
- 같은 파이프라인을 **공개 상세 페이지(RSC)와 관리자 에디터 프리뷰(Client)** 가 함께 쓴다. 프리뷰에서는 shiki를 lazy-load하고 300ms debounce를 건다.
- 헤딩 목록은 `extractHeadings()`로 따로 뽑아 TOC에 전달한다.
- `MdImage`: 공개 페이지는 `next/image` 최적화를 쓴다. M7에서 비공개 미디어가 도입되면 **관리자 에디터 프리뷰·미리보기에서는 `unoptimized`** 로 렌더링해 브라우저가 관리자 쿠키를 붙여 원본을 직접 받게 한다 (최적화기는 원본 요청에 쿠키를 전달하지 않음).
- 본문 스타일은 `.prose-jblog` 클래스에 정의한다: UI 기획서 §7.3 (Source Serif 20/32, h2 Work Sans 24/28, Quote 스타일, 문단 간격 32, 이미지 radius 12, 코드블록 스타일).

---

## 6. 페이지 상세

### 6.1 Home
섹션 순서는 UI 기획서 §7.1을 따른다: ProfileHero → TechLogoRow → Featured Projects(2열) → FeaturedHeroCard(**조건부**) → Latest Post(6) → View All Post. 데이터는 병렬로 가져온다 (`Promise.all`).
- FeaturedHeroCard는 `isFeatured` 글이 있고 **발행 글이 4개 이상**일 때만 렌더링한다. 아니면 생략하고 Latest Post가 바로 이어진다.
- Hero의 "기술 글 읽기"는 `/blog`로, "프로젝트 보기"는 `#projects`(Home 섹션 앵커)로 이동한다.

### 6.2 Blog 목록
- `PageInfo` → `CategoryChips`(링크, `?category=`) → `PostCardOverlay`(featured 또는 최신 1개, 필터 없는 1페이지에만) → `PostGrid`(9) → `LoadMoreGrid`
- **태그 탐색**: 상세 페이지와 카드의 태그 Badge는 `/blog?tag=<slug>`로 연결한다. 태그 필터 상태에서는 PageInfo 제목을 `#태그명`으로, Breadcrumb을 `Home / Blog / #태그명`으로 표시하고 Overlay 카드는 숨긴다. `category`와 `tag`는 동시에 쓰지 않는다 (마지막 선택이 우선).
- Load More를 누르면 URL에 `?page=n`을 `replaceState`로 반영한다. 새로고침하면 1~n 페이지를 SSR로 다시 그린다.
- 로딩 UI: `loading.tsx`에 카드 스켈레톤 9개

### 6.3 Blog 상세
- `generateMetadata`: title, description(excerpt), OG(이미지 = cover 또는 동적 OG), canonical, `article:published_time`
- JSON-LD `BlogPosting`
- 레이아웃: Badge → h1 → AuthorMeta(+읽는시간, 조회수) → Cover → Markdown → 태그(`/blog?tag=` 링크) → LikeButton → AuthorInfoBox → Prev/Next → Related(3)
- ≥1280px: 우측 sticky TOC (800 본문 + 200 TOC, 본문은 중앙 유지)
- `ViewTracker`가 마운트 시 조회를 기록한다. `LikeButton`은 `GET reactions`로 초기화한 뒤 낙관적으로 토글한다. 반응 API 호출은 `cache: 'no-store'`이며, 서버 페이지 캐시에 방문자별 값이 섞이지 않도록 반드시 클라이언트에서만 호출한다.

### 6.4 Projects / 상세
- **열 수 (페이지별 확정)**

  | 위치 | desktop(≥1280) | laptop | tablet | mobile |
  |---|---|---|---|---|
  | Home Featured Projects (810 폭 섹션) | **2열**, gap 30 (원본 디자인) | 2열 | 2열 | 1열 |
  | `/projects` 목록 (1216 컨테이너) | **3열**, gap 20 (카드 폭 392 = 블로그 카드) | 3열 | 2열 | 1열 |

- 목록 상단에 기술스택 필터 칩
- 상세: 메타 패널(기간, 역할, 기술스택 Badge, GitHub/Demo pill 버튼) + Markdown 본문. 본문은 권장 구조(개요 → 해결한 문제 → 기술 선택 이유 → 내가 맡은 부분 → 트러블슈팅 → 성과 → 회고)를 따른다. 관리자에서 새 프로젝트를 만들면 이 구조의 템플릿이 본문에 미리 채워진다.

### 6.5 About
AuthorInfoBox → TechLogoRow → Experience(타임라인) → ContactSection(`id="contact"`, Navbar Contact 앵커)

### 6.6 Search
`SearchBox`(Navbar)에서 Enter → `/search?q=`. 결과 개수를 표시하고 PostGrid를 재사용한다. 결과가 없으면 빈 상태 일러스트와 카테고리 링크를 보여준다.

---

## 7. 관리자 페이지

### 7.1 인증 흐름

로그인은 **GitHub OAuth + 허용 목록**(본인 1명)이다. 상세 설계: [04 Part 1](./04_access_control_and_content_protection.md).

```
middleware.ts (서버, /admin/** 단, /admin/login 제외)
  → jb_at JWT 서명·만료 검증
     ├ 유효 → 통과
     └ 없음/만료 → /admin/login?next=...

/admin/login
  → 먼저 POST /api/auth/refresh 조용히 시도 → 성공 시 next로 이동
  → 실패 시 [GitHub로 로그인] 버튼 → /api/auth/github
  → ?error=not_allowed 이면 "허용되지 않은 계정입니다" 표시

/admin/(protected)/layout.tsx (client)
  → useQuery(GET /api/auth/me)
     ├ 200 → 렌더
     └ 401 → POST /api/auth/refresh → 성공 시 재시도 / 실패 시 /admin/login?next=...
lib/api/client.ts: 모든 요청 credentials:'include', 'X-Requested-With: jblog',
                   401 응답 시 refresh 1회 시도 후 원요청 재시도 (아래 "refresh 조정")
```

**refresh 조정 (같은 탭 · 여러 탭)** — [백엔드 §5.6 회전의 원자성·동시 갱신 유예](./01_backend_plan.md#56-인증-상세)

```
401 수신
 → (같은 탭) 진행 중인 refresh Promise가 있으면 그것을 기다린다
 → (여러 탭) navigator.locks.request('jb-auth-refresh', async () => {
       잠금을 얻은 뒤, 다른 탭이 방금 갱신했는지 확인:
         BroadcastChannel('jb-auth')로 받은 마지막 갱신 시각이 401을 받은 시각 이후면 → refresh 생략
         아니면 → POST /api/auth/refresh
                   ├ 200 → BroadcastChannel로 "갱신 완료(시각)" 알림
                   ├ 409 REFRESH_IN_PROGRESS → 1초 대기 후 원 요청 재시도 (다른 탭/요청이 이미 회전함)
                   └ 401 → 로그인 페이지
     })
 → 원 요청 1회 재시도. 그래도 401이면 로그인 페이지
```
- Web Locks API를 지원하지 않는 환경에서는 같은 탭 Promise 공유만 하고, 서버의 10초 유예가 탭 간 충돌을 흡수한다.
- 갱신 관련 재시도도 원 요청당 1회로 제한한다 (무한 재시도 방지).
- 관리자 페이지에는 `robots: noindex`, 응답 헤더 `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`를 지정한다.
- 설정 > 보안 화면: 최근 로그인 기록, 활성 세션 목록/폐기, "모든 기기에서 로그아웃".

### 7.1-a 공개 사이트 복사 방지

`(site)` 레이아웃에만 적용하고 `/admin`에는 적용하지 않는다. 상세: [04 Part 2](./04_access_control_and_content_protection.md).

- 루트 래퍼에 `.content-protected`: `user-select: none`, `-webkit-touch-callout: none`, 이미지 드래그 금지, 인쇄 시 본문 숨김
- `CopyGuard`(Client): `copy`/`cut`/`contextmenu`/`dragstart`/`selectstart` 차단, `Cmd/Ctrl + C·X·A·S·P` 차단 (입력 요소와 `.allow-select` 영역은 예외, `Cmd+F` 허용), 차단 시 안내 토스트(3초 1회)
- **연락처 예외**: 이메일 주소, 소셜 링크 텍스트(ContactSection, Footer Info, AuthorInfoBox)는 `.allow-select`로 선택·복사를 허용한다. 이메일 옆에는 "주소 복사" 버튼도 둔다.
- `CodeBlock`: 드래그 선택은 막고 **복사 버튼**(`navigator.clipboard.writeText`)으로만 복사
- 공유: 글 상단 "링크 복사" 버튼 (URL만)
- 인쇄는 계속 차단한다. 채용 검토용 자료는 Hero/About의 **이력서 PDF 다운로드**로 제공한다.
- 본문 원문(`contentMd`)은 RSC가 서버에서 `/internal/*` 원문 API로 받아 렌더링한다. 브라우저가 호출할 수 있는 API에는 원문이 없다.

### 7.2 화면 목록

| 화면 | 주요 기능 |
|---|---|
| 공통 배너 | 캐시 갱신 실패가 있으면 모든 관리자 화면 상단에 "캐시 갱신 실패 N건 – [재시도]" |
| 대시보드 | M5: 총 글 수, 최근 드래프트, 예약 글, 캐시 갱신 상태. **M6 (`FEATURE_REACTIONS` 켜짐)**: 누적 조회수/좋아요, 최근 30일 조회 라인차트(Recharts), 인기 글 Top5 추가. 차트와 카드에 **"조회수 = 하루 단위 고유 방문 조회"** 툴팁 |
| 글 목록 | DataTable: 상태 탭(전체/발행/초안/예약/**편집 중**), 검색, 정렬, 행 액션(편집/미리보기/발행 토글/삭제 확인). "편집 중" = 발행 글에 작업본이 있는 상태 |
| 글 편집 | §7.3 에디터 |
| 프로젝트 | 목록(드래그 정렬, `dnd-kit`) + 폼(썸네일 업로드, **카드용 한 줄 요약(60자)**, 기간, 역할, 링크, 기술스택 멀티셀렉트(카드에는 앞 3개 노출), Markdown 본문(권장 구조 템플릿 프리필)) |
| 경력 | 드래그 정렬 리스트 + 폼(회사, 로고, 직함, 기간, Present 체크, 설명) |
| 기술스택 | 이름, simple-icons 키 검색/미리보기, Home 노출 토글, 정렬 |
| 카테고리 | 이름/slug, 정렬, 글 수 표시(글이 있으면 삭제 경고) |
| 프로필 | 이름, 직함, Hero 헤드라인(`**강조**` 문법 안내), 소개문, Bio, 아바타, 이력서(PDF 업로드 `kind=document` 또는 외부 URL 입력), 소셜 링크 반복 입력 |
| 미디어 | 이미지/문서 탭, URL 복사, 사용처 수 표시, "미사용" 필터. 삭제 시 사용 중이면 사용처 목록과 함께 거부 안내 |

### 7.3 Markdown 에디터 (`MarkdownEditor`)

```
┌ PublishPanel(우측 사이드 또는 상단) ──────────────────────────────┐
│ 제목 · slug · 카테고리 · 태그(TagInput) · 요약 · 커버 · Featured · SEO │
│ 상태 / 발행일시(예약) · [임시저장] [미리보기] [발행]                   │
└──────────────────────────────────────────────────────────────────┘
┌ Toolbar: H2 H3 B I Link Code Quote Image Table ┬ [Edit | Split | Preview] ┐
│ CodeMirror (markdown, 줄바꿈, Tab 들여쓰기)      │ MarkdownRenderer(.prose-jblog)│
└───────────────────────────────────────────────┴──────────────────────────┘
```
- **이미지**: 붙여넣기/드롭 → `![업로드 중...]()` placeholder 삽입 → `POST /api/admin/media` → URL로 치환
- **저장 규칙 (공개본과 작업본 분리, [백엔드 §5.1](./01_backend_plan.md#51-글-상태--저장--발행))**

  | 글 상태 | 자동저장 (30초, 변경 시) | 주 버튼 | 공개 페이지 영향 |
  |---|---|---|---|
  | 초안 (한 번도 발행 안 함) | `PATCH /admin/posts/:id` | [발행] | 없음 |
  | 발행/예약된 글 | `PUT /admin/posts/:id/draft` (작업본) | **[수정사항 발행]** · [작업본 폐기] | **없음** — 수정사항 발행을 눌러야 반영 |

  - 로컬 복구용으로 입력 후 2초 debounce로 `localStorage`(키 `draft:<id|new>`)에도 저장한다. 이탈 시 미저장 경고(`beforeunload`).
  - 발행 글 편집 화면 상단에 "공개본과 다른 작업본을 편집 중입니다 · 마지막 저장 hh:mm" 상태 바를 표시한다.
  - 발행 글을 처음 편집하면 첫 자동저장이 작업본을 **생성**한다. 이때 **편집을 시작할 때 불러온 공개본 version을 `expectedPostVersion`으로 보낸다**. 이미 다른 탭에서 만든 작업본이 있으면 `409 DRAFT_EXISTS`와 함께 그 작업본을 불러올지 묻고, 그사이 공개본이 바뀌었으면 `409 POST_CHANGED`와 함께 최신 공개본을 보여주고 내 변경을 diff로 비교해 다시 적용할지 묻는다.
  - 예약 글의 수정사항 발행은 내용만 바꾸고 예약 시각은 유지된다. 버튼 문구를 "수정사항 저장(예약 유지)"으로 표시한다.

- **PublishPanel 필드별 동작 (발행/예약된 글)** — [백엔드 §5.1 필드별 반영 규칙](./01_backend_plan.md#51-글-상태--저장--발행)

  | 필드 | UI 동작 |
  |---|---|
  | 제목, 요약, 본문, 커버, 카테고리, 태그, SEO | 작업본에 자동저장. 옆에 "수정사항 발행 시 반영" 표시 |
  | Featured | 토글 즉시 반영 ("즉시 반영" 라벨) |
  | slug | 읽기 전용 + [주소 변경] 버튼 → 다이얼로그("이전 주소는 새 주소로 이동합니다. 사용한 주소는 다시 쓸 수 없습니다") → 즉시 반영 |
  | 예약 시각 | 예약 글만 편집 가능, [예약 변경] 버튼으로 즉시 반영. 이미 공개된 글은 발행일 표시만 |

  초안(한 번도 발행 안 한 글)은 모든 필드를 한 번에 저장한다.
- **충돌 처리**: 모든 저장 요청에 버전을 보낸다 (작업본 최초 생성은 `expectedPostVersion`, 그 외 작업본 요청은 **`draftId` + `expectedVersion`**). 에디터는 응답으로 받은 `draftId`를 상태에 보관한다.
  - `409 VERSION_CONFLICT`: 자동저장을 멈추고 다이얼로그 — [서버 버전 불러오기] / [내 버전으로 덮어쓰기(확인 후 재저장)] / 두 버전 diff 보기
  - `409 DRAFT_REPLACED`: "다른 곳에서 작업본이 폐기되고 새로 만들어졌습니다" — 내 편집 내용을 로컬에 보관한 채 새 작업본을 불러오고, diff로 비교해 다시 적용할지 묻는다. 이전 ID로 자동 재시도하지 않는다
  - `409 DRAFT_BASE_OUTDATED`(작업본을 만든 뒤 공개본이 바뀜): 공개본 변경 diff를 보여주는 **강제 발행 확인창**. 사용자가 [그래도 발행]을 누르면 확인창에 표시한 공개본 version을 `confirmedPostVersion`으로 보낸다. 그사이 공개본이 또 바뀌어 다시 409가 오면 확인창을 새 내용으로 갱신해 재확인을 받는다
- **단축키**: `Cmd+S` 저장, `Cmd+Enter` 발행 다이얼로그, `Cmd+B/I/K`
- **스크롤 동기화**: Split 모드에서 에디터 ↔ 프리뷰 비율 동기화 (P1)
- 프리뷰는 공개 페이지와 같은 테마 토큰을 쓰므로, 관리자 화면 안에서 Light/Dark 결과를 모두 확인할 수 있다.

---

## 8. 반응형 & 테마 체크포인트

- 브레이크포인트: `tablet 768` / `laptop 1024` / `desktop 1280` (UI 기획서 §4.2). 모바일 우선으로 작성한다.
- 모바일 Navbar: 햄버거 → 전체화면 시트(`Dialog`), 포커스 트랩, ESC로 닫기, 열린 동안 body 스크롤 잠금
- 썸네일은 `aspect-ratio` + `next/image`의 `sizes`(예: `(min-width:1280px) 360px, (min-width:768px) 50vw, 100vw`)
- 테마: `next-themes` `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange=false`. `<html suppressHydrationWarning>`. 토글 아이콘은 hydration 이후 렌더한다 (`mounted` 체크)
- 로고와 Shiki 코드블록은 CSS 변수와 `[data-theme]` 선택자로 Light/Dark 전환 (JS 불필요)

---

## 9. SEO / 성능 / 접근성

| 항목 | 구현 |
|---|---|
| 메타 | `generateMetadata` (title 템플릿 `%s | jblog`), canonical, OG/Twitter 카드 |
| OG 이미지 | `opengraph-image.tsx` (`next/og`): 글 제목 + 카테고리 + 사이트 로고, 디자인 토큰 색상 |
| 구조화 데이터 | `Person`(About), `BlogPosting`(상세), `BreadcrumbList` |
| 사이트맵/RSS | `sitemap.ts`(글, 프로젝트), `/feed.xml` (최근 20개, 전문 대신 요약) |
| 민감 정보 | 비밀값(`REVALIDATE_SECRET`, `INTERNAL_API_KEY`, `JWT_ACCESS_SECRET`)은 `frontend/.env.local`로만 주입하고 하드코딩하지 않는다. 환경변수는 `frontend/src/lib/env.ts` 한 곳에서 스키마 검증 후 읽는다. **`NEXT_PUBLIC_` 변수에는 비밀값을 넣지 않는다** (브라우저 번들에 포함됨). 비밀값은 서버 컴포넌트·Route Handler·middleware에서만 사용. 상세: [개요 §6-b](./00_overview.md#6-b-민감-정보-관리-규칙-필수) |
| 성능 목표 | Lighthouse(모바일) Performance ≥ 90, LCP < 2.5s, CLS < 0.1. Hero/커버 이미지는 `priority`, 폰트 `display: swap` + subset |
| 번들 | 에디터, Shiki(클라이언트), Recharts는 `/admin`에서만 `dynamic import` |
| 접근성 | UI 기획서 §9 준수. 키보드 내비게이션, 포커스 링, `aria-*`, 이미지 alt 필수(관리자 업로드 시 alt 입력 유도). axe 자동 검사(Playwright) |

---

## 10. 테스트 전략

| 레벨 | 도구 | 대상 |
|---|---|---|
| 단위 | Vitest | Markdown 파이프라인(콜아웃, 캡션, 코드 타이틀, sanitize로 `<script>` 제거), format 유틸, headline `**강조**` 파서 |
| 컴포넌트 | Vitest + Testing Library + MSW | LikeButton(낙관적 업데이트/롤백), ThemeToggle, LoadMoreGrid, MarkdownEditor(이미지 붙여넣기 → 업로드 → 치환) |
| E2E (M5, 운영 오픈 기준) | Playwright (docker compose로 api+db 띄움) | 방문자: Home→글 상세→태그 필터→프로젝트 상세 / 관리자: 로그인→글 작성→이미지 업로드→발행→공개 페이지 반영 확인. `FEATURE_REACTIONS=false`에서 좋아요·조회수 UI가 렌더링되지 않음 |
| E2E (M6) | Playwright, `FEATURE_REACTIONS=true` | 방문자: 글 상세→좋아요 토글→새로고침 후 유지, 조회수 증가 / 관리자: 대시보드 통계 표시 |
| 시각 회귀 | Playwright `toHaveScreenshot` | **UI 기획서 §11 디자인 검수** 기준을 따른다. ① 원본에 있는 컴포넌트: Figma 원본과 ±2px 비교 ② 재구성한 페이지: 토큰·간격 규칙 준수 확인 후 승인한 스크린샷을 기준 이미지로 확정 → 이후 회귀 검사 (페이지 × 5개 뷰포트 × Light/Dark) |
| 접근성 | `@axe-core/playwright` | 주요 페이지 serious/critical 위반 0 |
| 접근 통제 | Playwright | 비로그인 `/admin/**` → 로그인 페이지로 이동, 관리자 HTML 미노출, 비허용 계정 에러 표시 |
| 복사 방지 | Playwright | 본문 선택/`Cmd+C`/우클릭/인쇄 차단, 코드 복사 버튼 동작, 이메일·연락처 선택 허용, 검색창·관리자 에디터는 정상 ([04 §2.5](./04_access_control_and_content_protection.md)) |
| 편집/캐시 | Playwright | 발행 글 편집 중 자동저장 후 공개 페이지가 바뀌지 않음 → 수정사항 발행 후 **이벤트 처리 완료를 기다린 뒤** 새 요청에 반영, 두 탭 동시 편집 시 충돌 다이얼로그, 예약 글이 예약 시각 후 이벤트 처리 뒤 노출, slug 변경 후 이전 주소 301·재사용 거부, 태그 이름 변경 후 상세의 태그 표시 갱신, 프로젝트 공개 후 사이트맵 포함, `/internal/*` 외부 404 |

---

## 11. 컨테이너

```
Dockerfile (multi-stage): deps → build(turbo build --filter=web) → runner(node:24-alpine, .next/standalone + static + public, 비root)
환경변수: API_INTERNAL_URL=http://api:4000, NEXT_PUBLIC_SITE_URL, REVALIDATE_SECRET
next.config.ts images.remotePatterns: 자기 도메인 /uploads/** (또는 localPatterns)
```

---

## 12. 작업 분해 (WBS)

| ID | 작업 | 마일스톤 |
|---|---|---|
| FE-01 | Next.js 앱 생성, Tailwind v4, ESLint/Prettier, 폰트, next-themes, api-types 연동 | M0 |
| FE-02 | 디자인 토큰(globals.css), 타이포 유틸, Atom 컴포넌트, `/dev/components` 확인 페이지 | M1 |
| FE-03 | Navbar(+모바일 메뉴, 검색, 토글), Footer, Container/Section, PageInfo | M1 |
| FE-04 | `frontend/src/lib/markdown` 파이프라인 + `.prose-jblog` 스타일 | M2 |
| FE-05 | Blog 목록/상세/검색, 태그 필터(`?tag=`), PostCard 3종, LoadMore, TOC, 원문 내부 API 연동, slug 301 처리, SEO(메타/OG/JSON-LD) | M2 |
| FE-05a | 복사 방지: `.content-protected`, `CopyGuard`, 연락처 `.allow-select` 예외, 코드블록 복사 버튼, 인쇄 차단, 링크 복사 버튼 (SEC-06) | M2 |
| FE-06 | Admin 인증: middleware(JWT 검증), GitHub 로그인 페이지, AdminShell, API 클라이언트(refresh 재시도), 보안 설정 화면 (SEC-03·04) | M3 |
| FE-07 | 글 관리 + MarkdownEditor + 이미지 업로드 + **초안/작업본 분리 자동저장 + 수정사항 발행 + 충돌 다이얼로그** + 미리보기 | M3 |
| FE-08 | `/internal/revalidate` route, 캐시 갱신 실패 배너, sitemap, RSS | M3 |
| FE-09 | ProfileHero(새 CTA), TechLogoRow, ProjectCard(요약·역할·기술), Experience, Contact, AuthorInfoBox → Home/Projects/About | M4 |
| FE-10 | 포트폴리오 관리자 폼 (프로필+이력서 PDF, 프로젝트+본문 템플릿, 경력, 기술스택, 카테고리, 미디어 사용처) | M4 |
| FE-12 | 시각 회귀(컴포넌트/페이지 기준 분리) + 디자인 차이 수정, E2E(M5 범위), axe, Lighthouse 튜닝, Dockerfile | M5 |
| FE-11 | `FEATURE_REACTIONS` 스위치, ViewTracker, LikeButton, 대시보드 통계(조회수 정의 표시), M6 E2E | M6 |
| FE-13 | AI 초안함, 프로필 제안 diff 승인, MCP 설정(토큰/연결 스니펫/작성 가이드/활동 로그), AI 배지·발행 체크리스트 — [03_ai_authoring_mcp_plan.md §7](./03_ai_authoring_mcp_plan.md) | M7 |
