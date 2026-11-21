---
name: component-patterns
description: "jblog 프론트엔드(frontend) 컴포넌트 설계 규칙. 컴포넌트 분리, RSC/클라이언트 경계, 데이터 패칭과 캐시 태그, 디자인 토큰 사용, 복사 방지, 접근성 체크리스트를 다룬다. frontend-dev가 컴포넌트·페이지를 설계하거나 구현할 때 사용한다."
---

# Component Patterns — jblog 프론트엔드

기준 문서: `docs/plan/02_frontend_plan.md`, `docs/ui_design/ui_design_spec.md`. 충돌하면 문서가 우선한다.

## 1. 폴더 구조 (프론트엔드 §3, 개요 D26 — 기능별 구조)

```
frontend/src/
├── app/(site)/        공개 사이트 (복사 방지 적용). page.tsx는 데이터를 가져와 기능 컴포넌트를 조립만 한다
├── app/admin/         관리자 (CSR, TanStack Query)
├── app/internal/      web 내부 경로 (revalidate webhook)
├── features/<기능>/   posts|reactions|projects|profile|media|search
│   ├── components/    공개 화면 조각
│   ├── admin/         관리자 화면 조각
│   ├── hooks/         useDraftAutosave, useLike …
│   ├── api.ts         서버용 fetch 함수 (캐시 태그)
│   └── schemas.ts     Zod 폼 스키마
├── components/ui|layout|markdown|protection|admin   여러 기능이 함께 쓰는 것만
├── lib/api/server.ts  RSC용 fetch (태그, /internal 호출 시 X-Internal-Key)
├── lib/api/client.ts  브라우저용 (credentials, CSRF 헤더, refresh 조정)
├── lib/env.ts         환경변수를 읽는 유일한 곳
└── middleware.ts      /admin JWT 검증
```

**계층 규칙 (ESLint로 차단)**
- 의존 방향: `app/` → `features/` → `components/`·`lib/`·`generated/`. 반대 방향 import 금지
- **기능끼리 import하지 않는다.** 한 화면에 여러 기능이 필요하면 `app/`에서 조립한다
- 두 번째 기능이 필요로 하는 것은 `components/`·`lib/`로 옮긴다
- 배럴 파일(`index.ts`)을 두지 않는다 (서버·클라이언트 컴포넌트가 섞이지 않게). 파일 경로로 직접 import
- 하위 폴더는 필요한 것만 만든다

## 2. RSC와 클라이언트 경계

| 서버 컴포넌트 (기본) | 클라이언트 컴포넌트 (`'use client'`) |
|---|---|
| 데이터 패칭, 카드·목록·상세 렌더링, Markdown 렌더링(공개 페이지) | 테마 토글, 모바일 메뉴, 검색 입력, LoadMore, LikeButton, ViewTracker, TOC 하이라이트, CopyGuard, 관리자 화면 전체 |

- 클라이언트 컴포넌트는 **잎(leaf)** 에 둔다. 페이지 전체를 클라이언트로 만들지 않는다
- 비밀값을 쓰는 코드(`INTERNAL_API_KEY` 등)는 서버 컴포넌트·Route Handler·middleware에서만

## 3. 데이터와 캐시 (프론트엔드 §4)

- 공개 fetch는 태그를 붙인다: `posts`, `post:<slug>`, `projects`, `project:<slug>`, `tech-stacks`, `profile`, `experiences`. 한 fetch가 여러 데이터를 담으면 태그를 모두
- 방문자별 데이터(좋아요 상태)는 서버 캐시에 넣지 않는다 — 클라이언트에서 `cache: 'no-store'`
- 상태관리: 서버 상태는 RSC 또는 TanStack Query. **Zustand를 쓰지 않는다.** 폼은 React Hook Form + Zod

## 4. 디자인 토큰

- 색·간격·radius·폰트는 `globals.css`의 시맨틱 토큰만 쓴다 (`bg-surface`, `text-strong`, `border-border` …). **hex 하드코딩 금지**
- Light/Dark는 `[data-theme]` + CSS 변수로 전환. 컴포넌트에 테마 분기 코드를 쓰지 않는다
- 새 토큰이 필요하면 계약 작업으로 요청한다

## 5. 컴포넌트 설계

- 한 컴포넌트는 한 가지 책임. 약 200줄을 넘으면 분리 검토, props는 5개 이하(넘으면 객체로)
- variant는 `class-variance-authority`로 정의 (예: Badge `solid | soft`, Button `primary | outline | icon | pillSolid | pillOutline`)
- 반복되는 로직은 커스텀 훅으로 추출해 해당 기능의 `hooks/`에 둔다. 이름은 기획 용어와 맞춘다 (`useLike`, `useDraftAutosave`)
- 공개 사이트 컴포넌트는 UI 기획서 기반 자체 구현, shadcn/ui는 관리자 전용

## 6. 복사 방지 (접근 통제 Part 2)

- `(site)` 레이아웃에만 `.content-protected` + `CopyGuard`. 관리자에는 적용하지 않는다
- 연락처(이메일·소셜 링크)는 `.allow-select`, 입력 요소는 항상 허용
- 코드블록은 복사 버튼(`navigator.clipboard.writeText`)으로만

## 7. 접근성 체크리스트

- [ ] 시맨틱 요소 (`nav`, `main`, `article`, `button`)와 heading 순서
- [ ] 모든 인터랙티브 요소에 포커스 링 (`outline: 2px solid var(--color-primary)`)
- [ ] 이미지 `alt` (장식 이미지는 `alt=""`)
- [ ] 테마 토글 `role="switch"` + `aria-checked`, 모바일 메뉴 포커스 트랩·ESC
- [ ] 텍스트 대비 4.5:1 이상 (placeholder 포함)
- [ ] `prefers-reduced-motion`에서 전환 애니메이션 생략

## 8. 에러·로딩

- 라우트 단위 `loading.tsx`(스켈레톤), `error.tsx`, `not-found.tsx`
- API 에러는 `code`(예: `VERSION_CONFLICT`)로 분기해 사용자에게 맞는 안내를 보여준다
