# jblog 개발 기획 – 개요 & 공통 결정사항

> 버전 v0.8 · 작성일 2026-11-20 · 개정 2026-11-21 ([1차](./feedback/2026-11-20_plan_review.md)·[2차](./feedback/2026-11-20_plan_review_02.md) 기획 검토 피드백 반영)
> 관련 문서: [UI 디자인 기획서](../ui_design/ui_design_spec.md) · [백엔드 기획서](./01_backend_plan.md) · [프론트엔드 기획서](./02_frontend_plan.md) · [AI 자동 작성](./03_ai_authoring_mcp_plan.md) · [접근 통제 & 복사 방지](./04_access_control_and_content_protection.md) · [협업 아키텍처](./05_collaboration_architecture.md)

---

## 1. 서비스 개요

| 항목 | 내용 |
|---|---|
| 서비스 | 개인 포트폴리오 겸 기술 블로그 |
| 사용자 | **방문자**(비로그인, 읽기·좋아요) / **관리자**(본인 1인, 콘텐츠 작성·관리) |
| 주요 방문자 | **채용 담당자**: 역할·성과·연락처·이력서를 빠르게 확인 / **동료 개발자**: 문제 해결 과정과 코드를 읽음. Home과 프로젝트 상세의 우선순위는 이 두 경로를 기준으로 정한다 ([UI §7.1](../ui_design/ui_design_spec.md#71-home-)) |
| 핵심 기능 (MVP = M0~M5, 릴리스 준비 완료 · 배포는 보류) | 블로그 글 목록/상세/카테고리/태그/검색, 포트폴리오(프로필·기술스택·프로젝트·경력), 관리자 페이지(Markdown 에디터, 이미지 업로드), Light/Dark 테마 |
| MVP 직후 (M6) | 조회수·좋아요 — 운영 중 기능 스위치 `FEATURE_REACTIONS`로 켠다 |
| 이후 (M7) | AI 자동 작성 (MCP 서버) |
| MVP 제외 (후속) | 댓글, 뉴스레터 구독, Contact 폼, 다국어 |

### 확정된 의사결정

| # | 항목 | 결정 | 결정자 |
|---|---|---|---|
| D1 | 백엔드 | **NestJS (TypeScript) + Prisma**, 별도 API 서버 | 사용자 |
| D2 | 프론트엔드 | **Next.js (App Router)** | 사용자 요청에 따라 추천 |
| D3 | DB | **PostgreSQL** (로컬 Docker) | 사용자 |
| D4 | 콘텐츠 작성 | **관리자 페이지 + Markdown 에디터 → DB 저장** | 사용자 |
| D5 | 부가기능 | **조회수 / 좋아요** — 처음엔 MVP로 정했으나 D17·D18에 따라 **MVP 직후(M6)** 에 기능 스위치로 켠다 | 사용자 (2차 피드백 후 조정 승인) |
| D6 | 배포 | **보류 (인프라 미정, 추후 결정)**. 처음엔 단일 VPS + Docker Compose로 정했으나 사용자가 보류로 변경. 배포에 의존하는 항목은 §6-a "배포 보류 범위"를 따른다 | 사용자 (2026-11-21 변경) |
| D7 | 이미지 저장 | 개발 중에는 로컬 볼륨. `StorageService` 추상화로 인프라 결정 후 로컬 볼륨 / S3 호환 저장소 중 선택 | 추천 (D6 보류에 따라 확정 보류) |
| D8 | 저장소 구조 | pnpm workspace 모노레포 + Turborepo | 추천 |
| D9 | AI 자동 작성 | **jblog MCP 서버** 제공 → Claude Code / Claude Desktop / Codex가 접속해 **초안까지만** 작성. M7에 개발. 상세: [03_ai_authoring_mcp_plan.md](./03_ai_authoring_mcp_plan.md) | 사용자 |
| D10 | 작성 서비스 접근 | **본인 1명**, **GitHub OAuth + 허용 목록**(GitHub 숫자 ID), 네트워크 차단 없이 앱 인증만. 상세: [04 Part 1](./04_access_control_and_content_protection.md) | 사용자 |
| D11 | 읽기 페이지 복사 방지 | **본문 선택·복사·우클릭·드래그·인쇄 차단, 코드블록은 복사 버튼으로만 허용**. 원문 Markdown은 외부 API에 노출하지 않음. 상세: [04 Part 2](./04_access_control_and_content_protection.md) | 사용자 |
| D12 | 복사 방지 예외 | 이메일·소셜 링크 등 **연락처는 선택·복사 허용**. 인쇄는 차단 유지하고 이력서 PDF 다운로드로 대체 | 추천 (사용자 위임) |
| D13 | 메타 텍스트 대비 | Light `--color-text-muted`를 `#97989F` → **`#696A75`** (WCAG AA). Dark는 원본 유지 | 추천 (사용자 위임) |
| D14 | Hero CTA | 버튼 모양은 원본 유지, 문구를 **"프로젝트 보기" / "기술 글 읽기"** 로 변경. 이력서·연락하기는 아래 보조 텍스트 링크로 | 추천 (사용자 위임) |
| D15 | 공개본/작업본 분리 | 발행 글 편집은 작업본(`PostDraft`)에 저장, **"수정사항 발행"** 을 눌러야 공개. 모든 저장은 `version` 기반 충돌 검사 | 피드백 반영 |
| D16 | 캐시 정책 | 응답 유형별 `Cache-Control` 분리, 원문은 `/internal/*` 별도 엔드포인트, 공개 페이지는 태그 무효화 중심, 예약 발행은 1분 주기 작업 | 피드백 반영 |
| D17 | 마일스톤 순서 | 품질·릴리스 준비(M5)를 통계(M6)보다 먼저 | 피드백 반영 |
| D18 | MVP 정의 | **MVP = M0~M5 (릴리스 준비 완료)**. 실제 배포는 D6 결정 후. 조회수·좋아요는 `FEATURE_REACTIONS=false` 상태로 개발 완료 → M6에서 켬. 스위치가 꺼져 있으면 관련 API 404, UI·대시보드 위젯 미노출 | 추천 (사용자 승인) |
| D19 | 캐시 갱신 신뢰성 | 콘텐츠 변경과 같은 트랜잭션에 캐시 갱신 이벤트 저장(outbox), 작업자가 처리·재시도 | 2차 피드백 반영 |
| D20 | slug 정책 | 한 번 쓴 slug는 영구 예약(재사용 금지), **같은 글의 이전 slug 복귀도 금지**(301 순환 방지, 2026-11-21 사용자 확정), 이전 주소는 현재 slug로 직접 301, 비공개·삭제 글 404 | 추천 (사용자 승인) |
| D21 | 공개 철회 정의 | 미디어 공개 철회 = 앞으로의 원본 접근 차단. 이미 퍼진 사본은 회수 보장하지 않고, 유출 시 긴급 교체 절차로 대응 | 추천 (사용자 승인) |
| D22 | 개발 협업 체계 | Claude Code 오케스트레이터 + 서브에이전트 5종(Backend·Frontend·Test·DevOps·Docs) 구현, **Codex 독립 검수**(로컬 CLI만, push 전 최종 검수), 개발자 승인 관문 G1~G4. 상세: [05](./05_collaboration_architecture.md) | 사용자 |
| D23 | 저장소 공개 범위 | **공개(Public) GitHub 저장소**. 무료 요금제로 브랜치 보호 사용, 코드가 포트폴리오 역할. 비밀정보는 저장소에 두지 않음 ([05 §5.1-a](./05_collaboration_architecture.md#51-a-공개-저장소-운영-규칙)) | 사용자 |
| D24 | 에이전트 실행 방식 | 작업마다 단일 실행 / 서브에이전트 조합 중 선택(팀 방식 보류), 난도 기준 모델 배정, 테스트 환경 책임 분리 ([05 §4.0, §4.3-a](./05_collaboration_architecture.md#40-실행-방식-선택)) | 사용자 |

---

## 2. 기술 스택

### 2.1 스택 요약

| 영역 | 선택 | 선택 이유 |
|---|---|---|
| 언어 | **TypeScript** (FE/BE 공통) | 한 언어로 타입과 DTO를 공유한다 |
| 런타임 | **Node.js 24 LTS** | 현재 Active LTS |
| 패키지 매니저 | **pnpm** (workspace) | 모노레포 표준. 빠르고 디스크를 적게 쓴다 |
| 모노레포 빌드 | **Turborepo** | 태스크 캐시, 병렬 빌드 |
| Frontend | **Next.js (App Router) + React** | SSR/ISR로 블로그 SEO에 유리하다. 사실상 업계 표준 |
| 스타일 | **Tailwind CSS v4** + CSS 변수 토큰 | UI 기획서 토큰을 `@theme`로 바로 매핑한다 |
| 테마 | **next-themes** | `data-theme` 전환과 FOUC 방지가 내장되어 있다 |
| 관리자 UI | **shadcn/ui** (Radix 기반) | 폼, 테이블, 다이얼로그를 빠르게 구성한다 |
| 서버 상태 (관리자) | **TanStack Query** | 캐시와 mutation 관리 |
| 폼 | **React Hook Form + Zod** | 사실상 표준 조합 |
| Markdown 렌더링 | **unified (remark/rehype) + Shiki** | GFM, 코드 하이라이트(Light/Dark 듀얼 테마), 헤딩 앵커/TOC |
| Markdown 에디터 | **CodeMirror 6** (`@uiw/react-codemirror`) + 실시간 프리뷰 | 프리뷰에 공개 페이지와 같은 렌더러를 써서 결과가 일치한다 |
| Backend | **NestJS** | 모듈/DI 구조. Node 진영 엔터프라이즈 표준 |
| ORM | **Prisma** | 스키마 기반 타입 생성, 마이그레이션 |
| 검증 | **class-validator / class-transformer** | NestJS 기본 ValidationPipe 생태계 |
| API 문서/계약 | **@nestjs/swagger → OpenAPI** → FE에서 **openapi-typescript**로 타입 생성 | FE/BE 계약을 자동 동기화한다 |
| 인증 | **GitHub OAuth (passport-github2) + 허용 목록**, 세션은 **JWT (httpOnly 쿠키) + Refresh 토큰 회전** | 비밀번호를 저장하지 않고 GitHub 2FA를 활용한다. 관리자 1인 |
| 이미지 처리 | **sharp** | 업로드 시 WebP 변환 및 리사이즈 |
| 로깅 | **nestjs-pino** (pino) | JSON 구조화 로그 |
| Rate limit | **@nestjs/throttler** | 좋아요/조회수/로그인 남용 방지 |
| 보안 헤더 | **helmet** | |
| DB | **PostgreSQL 17** + 확장 `pg_trgm` | 한글 부분일치 검색 |
| BE 테스트 | **Jest + Supertest + Testcontainers(PostgreSQL)** | NestJS 기본. 실 DB로 통합 테스트 |
| FE 테스트 | **Vitest + Testing Library**, E2E/시각 회귀 **Playwright** | 디자인 검수(UI 기획서 §11)에도 Playwright를 쓴다 |
| 코드 품질 | **ESLint (flat config) + Prettier**, **Husky + lint-staged**, **commitlint**(Conventional Commits) | |
| 컨테이너 | **Docker / Docker Compose** | 로컬과 운영의 구성을 동일하게 맞춘다 |
| 리버스 프록시 | **보류** (D6). 후보: Nginx + Certbot / Caddy / 클라우드 로드밸런서. 어떤 것을 고르든 §6-a의 요구사항을 만족해야 한다 | |
| CI | **GitHub Actions** (lint · typecheck · test · build) | CD(배포 자동화)는 D6 결정 후 |
| 운영 보조 | DB 백업: `pg_dump` cron + 외부 보관 / 모니터링: 헬스체크 + **Uptime Kuma**(선택) | |
| 분석 (선택) | **Umami**(셀프호스팅, 같은 Postgres 사용 가능) | 쿠키 없는 방문 통계. MVP 이후 |

> 버전 고정: 프로젝트 초기화 시점의 최신 안정 버전을 `package.json`/`Dockerfile`에 정확히 명시한다 (`^` 범위 대신 lockfile로 고정).

### 2.2 검토했으나 채택하지 않은 대안

| 대안 | 채택하지 않은 이유 |
|---|---|
| Redis (조회수 버퍼, 캐시) | 개인 블로그 트래픽에서는 Postgres만으로 충분하다. 운영 컴포넌트 수를 줄이는 쪽을 택했다. 트래픽이 늘면 도입한다 |
| Elasticsearch / Meilisearch | 글 수백 개 규모에서는 `pg_trgm`으로 충분하다 |
| MinIO (S3 호환 저장소) | 단일 서버에서는 로컬 볼륨이 가장 단순하다. `StorageService` 인터페이스로 추상화해 S3/R2로 전환할 수 있게 둔다 |
| Headless CMS (Strapi 등) | 관리자 1인 + 자체 백엔드가 있으므로 불필요하다. 직접 구현하는 것 자체가 포트폴리오 가치도 있다 |
| GraphQL | 엔드포인트 수가 적고 캐시 전략이 단순해 REST가 적합하다 |

---

## 3. 시스템 아키텍처

```
                          ┌──────────────────────────── VPS (Docker Compose) ───────────────────────────┐
  Browser ──HTTPS──▶ Nginx │  /            ──▶ web  (Next.js :3000)  ──(SSR fetch, 내부망)──┐           │
   (방문자/관리자)         │  /api/*       ──▶ api  (NestJS  :4000)  ◀───────────────────────┘           │
                          │  /mcp         ──▶ api  (MCP 서버, M7)  ◀── Claude Code / Codex (Bearer 토큰) │
                          │  /uploads/*   ──▶ 정적 파일 (volume: uploads)                                │
                          │                    api ──▶ db (PostgreSQL :5432, volume: pgdata)            │
                          │                    api ──(revalidate webhook)──▶ web                         │
                          └─────────────────────────────────────────────────────────────────────────────┘
```

- **동일 오리진**: 브라우저는 `https://도메인/api/*`로 API를 호출한다. Nginx가 프록시하므로 **CORS가 필요 없고** 인증 쿠키를 `SameSite=Lax`로 쓸 수 있다.
- **SSR fetch**: Next.js 서버는 내부망 주소(`http://api:4000`)로 API를 직접 호출한다.
- **캐시 무효화**: 공개 상태가 바뀌는 이벤트(발행, 수정사항 발행, 예약 시각 도달, 비공개 전환, 삭제, slug 변경)마다 API가 내부망으로 web의 `/internal/revalidate`(시크릿 헤더)를 호출해 태그 캐시를 지운다. 초안·작업본 저장은 호출하지 않는다. 실패하면 재시도하고 관리자 화면에 표시한다 ([백엔드 §5.7](./01_backend_plan.md#57-캐시-정책--무효화)).
- **내부 경로**: `/internal/*`는 web↔api 내부 통신 전용이다 (원문 Markdown 조회, revalidate webhook). Nginx는 `location /internal/ { return 404; }`로 외부 요청을 막는다.
- **이미지**: API가 `/data/uploads`에 저장하고, Nginx가 `/uploads/*`로 직접 서빙한다 (UUID 파일명 + 장기 캐시 헤더). M7 전에 비공개 미디어(`auth_request`)를 도입한다 ([03 §4.3](./03_ai_authoring_mcp_plan.md#43-비공개-미디어-m7-선행-과제)).

---

## 4. 저장소 구조 (모노레포)

```
jblog/
├── apps/
│   ├── web/                 # Next.js (공개 사이트 + /admin)
│   └── api/                 # NestJS
├── packages/
│   ├── api-types/           # OpenAPI → openapi-typescript 생성 타입 (FE가 import)
│   ├── markdown/            # remark/rehype 파이프라인 (web 공개 페이지 + 에디터 프리뷰 공용)
│   ├── eslint-config/
│   └── tsconfig/
├── infra/
│   ├── docker-compose.yml           # 로컬 개발 (db만 또는 전체)
│   ├── docker-compose.prod.yml      # 운영
│   ├── nginx/default.conf
│   └── scripts/backup.sh
├── docs/
│   ├── ui_design/
│   └── plan/
├── .github/workflows/        # ci.yml (deploy.yml은 D6 결정 후)
├── turbo.json
├── pnpm-workspace.yaml
└── .env.example
```

---

## 5. 콘텐츠 작성 방식 (추천안 상세)

### 5.1 원칙

- **원본은 Markdown 텍스트**로 DB(`posts.content_md`)에 저장한다. HTML은 저장하지 않는다. 렌더링 시점에 변환하고 ISR로 캐시한다.
  - 렌더러를 개선하면(예: 코드블록 스타일 변경) 모든 글에 즉시 반영된다.
  - 저장 포맷이 표준 Markdown이라 나중에 다른 플랫폼으로 옮기기 쉽다.
- **블로그 글과 포트폴리오를 다르게 다룬다.**
  - 블로그 글, 프로젝트 상세 본문: **자유 형식 Markdown**
  - 프로필, 기술스택, 경력, 프로젝트 메타(기간/역할/링크): **구조화된 폼 입력**. 디자인의 카드/타임라인 레이아웃을 데이터로 정확히 채우기 위해서다.

### 5.2 글 작성 흐름

```
/admin/posts/new
 ┌ 제목 / slug(자동생성·수정 가능) / 카테고리 / 태그 / 요약 / 커버 이미지 ┐
 ├──────────────── 에디터 (CodeMirror) ────────┬──── 실시간 프리뷰 ───────┤
 │ ## 제목                                     │ (공개 페이지와 같은 렌더러 │
 │ ```ts                                       │  + 같은 CSS → 실제 화면과  │
 │ const a = 1                                 │  동일하게 보임)            │
 │ ```                                         │                            │
 │ [이미지 붙여넣기/드래그 → 자동 업로드 → ![](url) 삽입]                    │
 └──────────────────────────────────────────────────────────────────────────┘
 [임시저장(자동 30초)]  [미리보기(새 탭)]  [발행 / 예약 발행]
```

| 상태 | 설명 |
|---|---|
| `DRAFT` | 작성 중. 공개 목록에 노출되지 않는다. 관리자만 `/admin/preview/[id]`로 볼 수 있다 |
| `PUBLISHED` | 공개. `published_at` 기준으로 정렬한다 |
| 예약 (별도 상태 아님) | `PUBLISHED` + 미래 `published_at`. 공개 API는 `published_at <= now()`로 거르고, 1분 주기 작업이 예약 시각이 된 글의 캐시를 지워 **시각 + 약 1분 안에** 노출한다 |
| 발행 + 편집 중 | 발행된 글을 고치면 공개본은 그대로 두고 **작업본(`PostDraft`)** 에 저장한다 (자동저장 포함). **[수정사항 발행]** 을 눌러야 공개 페이지에 반영된다 ([백엔드 §5.1](./01_backend_plan.md#51-글-상태--저장--발행)) |

**에디터 편의 기능 (MVP)**: 이미지 붙여넣기/드래그 업로드, 자동 임시저장(로컬스토리지 + 30초 서버 저장), 단축키(Cmd+S 저장, Cmd+B/I), 읽는 시간 자동 계산, slug 자동 생성(한글 제목은 직접 입력 유도).

**지원 Markdown 문법**: GFM(표, 체크리스트, 취소선), 코드블록 + 언어 + 파일명(` ```ts title="a.ts" `), 인용문(디자인 Quote 스타일), 이미지 캡션(`![alt](url "caption")`), 헤딩 자동 앵커(TOC 생성), 콜아웃(`> [!NOTE]`, GitHub 문법).

### 5.3 백업 / 이식성

- DB 일일 백업(`pg_dump`)과 업로드 폴더 백업(rsync)
- 관리자 **"Markdown 내보내기"** 기능(P1): 전체 글을 front-matter가 붙은 `.md` 파일 zip으로 다운로드한다. Git 기반 방식으로 옮겨갈 출구를 확보하는 기능이다.

---

## 6. 환경 구성

| 환경 | 구성 |
|---|---|
| **local** | `docker compose up db` 로 PostgreSQL만 띄우고, `pnpm dev`로 web(3000)과 api(4000)를 호스트에서 실행한다. web의 `/api/*`는 Next.js `rewrites`로 4000에 프록시해 운영의 동일 오리진 구조를 재현한다 |
| **prod** | **보류 (D6)**. 인프라가 정해지면 아래 §6-a 요구사항으로 구성한다 |

공통 환경변수 (`.env.example`):

```
# db
POSTGRES_USER=jblog
POSTGRES_PASSWORD=change-me
POSTGRES_DB=jblog
DATABASE_URL=postgresql://jblog:change-me@localhost:5432/jblog?schema=public

# api
API_PORT=4000
FEATURE_REACTIONS=false          # 조회수·좋아요 (M6에서 true). web에도 같은 값 전달
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
GITHUB_CLIENT_ID=                # GitHub OAuth App (운영/로컬 분리 등록)
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
ADMIN_GITHUB_ID=                 # 허용할 GitHub 숫자 ID (login 아님)
INTERNAL_API_KEY=                # web→api 내부 요청 전용 (contentMd 조회)
UPLOAD_DIR=/data/uploads
PUBLIC_UPLOAD_BASE_URL=/uploads
WEB_REVALIDATE_URL=http://web:3000/internal/revalidate   # 로컬: http://localhost:3000/internal/revalidate
REVALIDATE_SECRET=
VISITOR_HASH_SALT=               # 조회수 중복판정용 (일 단위 회전)

# web
API_INTERNAL_URL=http://localhost:4000   # SSR용 (prod: http://api:4000)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
REVALIDATE_SECRET=
JWT_ACCESS_SECRET=               # middleware에서 jb_at 검증 (api와 동일 값)
INTERNAL_API_KEY=
```

### 6-a. 배포 보류 범위

배포 인프라(D6)는 추후 결정한다. 그때까지 다음처럼 다룬다.

| 구분 | 내용 |
|---|---|
| **지금 진행** | 로컬 개발 환경(Docker Compose로 PostgreSQL), GitHub Actions CI, 운영용 Dockerfile 작성과 빌드 검증, 애플리케이션 쪽 보안·캐시 요구사항 구현 |
| **보류** | 서버·호스팅 선택, 리버스 프록시 구성, 도메인·HTTPS, CD 파이프라인(이미지 레지스트리·배포 자동화), 운영 백업 자동화, 모니터링 |
| **인프라와 무관하게 유지하는 요구사항** | 어떤 인프라를 고르든 다음을 만족해야 한다. 각 기획 문서의 "Nginx" 표기는 이 요구사항의 예시 구현이다 |

| 요구사항 | 출처 |
|---|---|
| 브라우저 기준 web과 api의 **동일 오리진** (`/api/*` → api, 나머지 → web) | §3 |
| `/internal/*` 경로의 **외부 차단** | §3, 백엔드 §4.5 |
| 외부 요청의 `X-Internal-Key` 헤더 제거 | 04 §2.2-④ |
| `X-Forwarded-For` 전달 (조회수 중복 판정, Throttle) | 백엔드 §5.2 |
| 업로드 파일 서빙 + 비공개 미디어 인증 서브요청(M7) | 백엔드 §5.5, 03 §4.3 |
| `/admin/**` 응답 `X-Robots-Tag`, `Cache-Control: no-store` | 04 §1.4 |
| HTTPS (Secure 쿠키 전제) | 04 §1.3 |
| DB·업로드 파일 백업 | 백엔드 §8 |

### 6-b. 민감 정보 관리 규칙 (필수)

**민감 정보는 코드에 하드코딩하지 않고, 반드시 `.env` 파일(환경변수)로만 주입한다.** 모든 에이전트와 개발자에게 적용되며, 위반은 Codex 검수에서 "높음"으로 다룬다.

**민감 정보의 범위**

| 구분 | 예 |
|---|---|
| 비밀값 | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GITHUB_CLIENT_SECRET`, `REVALIDATE_SECRET`, `INTERNAL_API_KEY`, `VISITOR_HASH_SALT`, DB 비밀번호, MCP 토큰, 외부 서비스 API 키 |
| 접속 정보 | `DATABASE_URL`(계정·비밀번호 포함), 내부 서비스 주소 중 환경마다 다른 값 |
| 개인 식별 설정 | `ADMIN_GITHUB_ID`, `GITHUB_CLIENT_ID` |

**파일 구성**

| 파일 | 내용 | git |
|---|---|---|
| `apps/api/.env` | API 서버의 실제 값 | **커밋 금지** (`.gitignore`) |
| `apps/web/.env.local` | 웹 서버의 실제 값 | **커밋 금지** |
| `infra/.env` | 로컬 Docker Compose(PostgreSQL) 값 | **커밋 금지** |
| `apps/api/.env.example`, `apps/web/.env.example`, `infra/.env.example` | 변수 이름과 설명만. **값은 비우거나 `change-me` 같은 자리표시자** | 커밋 |
| GitHub Actions Secrets | CI에 필요한 값 | 저장소 밖 |

**코드 작성 규칙**
1. 비밀값·접속 정보는 코드, 테스트, 시드, 문서 예시, Dockerfile, CI 워크플로 파일 어디에도 실제 값으로 쓰지 않는다. 코드는 **설정 모듈을 통해서만** 읽는다 (백엔드: `@nestjs/config` + 스키마 검증, 프론트엔드: `lib/env.ts` 한 곳).
2. 앱 시작 시 필수 환경변수를 **스키마로 검증**하고, 없거나 형식이 틀리면 즉시 실패시킨다. 비밀값에 기본값(fallback)을 두지 않는다 (`process.env.JWT_SECRET ?? 'dev-secret'` 금지).
3. 프론트엔드에서 `NEXT_PUBLIC_`으로 시작하는 변수는 **브라우저 번들에 포함**되므로 비밀값을 절대 넣지 않는다. 비밀값은 서버 컴포넌트·Route Handler·middleware에서만 읽는다.
4. 로그·에러 응답·Codex 검수 입력·작업 지시서·PR 본문에 비밀값을 출력하지 않는다 (pino redact 대상에 포함, 05 §9 지시서 규칙).
5. 테스트는 실제 비밀값을 쓰지 않는다. 테스트용 값은 테스트 설정에서 무작위로 생성하거나 명백한 더미 값을 쓰고, DB는 Testcontainers가 만든 접속 정보를 쓴다.
6. 새 환경변수를 추가하면 같은 PR에서 해당 `.env.example`과 이 문서의 변수 목록을 갱신한다 (DevOps 담당, 05 §5.3).

**검사 장치**
| 장치 | 내용 |
|---|---|
| `.gitignore` | `.env`, `.env.*` 무시, `!.env.example`만 예외 |
| pre-commit 훅 | 비밀정보 패턴 검사 (03 §4.2 시크릿 스캐너 규칙 재사용), `.env` 파일 커밋 차단 |
| GitHub Secret scanning + Push protection | 공개 저장소 무료 기능 (05 §5.1-a) |
| ESLint | `process.env` 직접 접근을 설정 모듈 밖에서 금지 (`no-restricted-properties`) |
| Codex 검수 | 하드코딩된 비밀값·접속 정보, `NEXT_PUBLIC_` 비밀값, 비밀값 기본값을 "높음"으로 지적 (`AGENTS.md`) |

---

## 7. 마일스톤

| 단계 | 범위 | 산출물 |
|---|---|---|
| **M0 셋업** (2~3일) | 모노레포, Docker(db), Prisma 스키마/마이그레이션, ESLint/Prettier/Husky, CI(lint·test·build) | 빈 앱 두 개가 CI 통과 |
| **M1 디자인 시스템** | UI 기획서 §10 미확정 항목 확정 → Tailwind 토큰, 폰트, 테마, 공통 컴포넌트(Navbar/Footer/Card/Badge/Button) | Storybook 대신 `/dev/components` 페이지 |
| **M2 블로그 읽기** | API: posts/categories/tags 공개 조회 + 검색, 원문 내부 API(`/internal/*`), 응답별 캐시 헤더. Web: Home(블로그 섹션), /blog(+태그 필터), /blog/[slug], /search, 복사 방지 | 시드 데이터로 공개 블로그 동작 |
| **M3 관리자 & 작성** | 인증, /admin 레이아웃, 글 CRUD, **초안/작업본 분리 + 수정사항 발행 + 충돌 검사**, 에디터 + 프리뷰, 미디어(이미지·PDF, 사용처 추적), **캐시 갱신 outbox + 예약 발행 cron**, slug 영구 예약·301 | 실제로 글을 써서 발행·수정 가능. **완료 기준**: ① 발행 글을 편집해도 수정사항 발행 전에는 공개 페이지가 바뀌지 않음 ② 발행·비공개·삭제·slug 변경 시 캐시 갱신 이벤트가 같은 트랜잭션에 기록되고, 서버를 재시작해도 처리됨 ③ 이벤트 처리 완료 **이후의 새 요청**은 목록/상세/RSS/사이트맵 모두 최신 상태 (이미 열린 화면은 새로고침 시 반영, [백엔드 §5.7-⑤](./01_backend_plan.md#57-캐시-정책--무효화)) |
| **M4 포트폴리오** | 프로필/기술스택/경력/프로젝트 API + 관리자 폼 + Home/Projects/About 페이지 | 디자인 기획서의 전체 페이지 완성 |
| **M5 품질 & 릴리스 준비** | SEO(sitemap/RSS/OG), 디자인 검수(컴포넌트 ±2px / 재구성 페이지 규칙 검사), E2E(조회수·좋아요 제외), 운영용 Docker 이미지 빌드 검증, `FEATURE_REACTIONS=false`. **배포·리버스 프록시·HTTPS·백업 자동화는 D6 결정 후 별도 마일스톤(M-Deploy)** | **릴리스 준비 완료 (MVP 완료)** |
| **M6 조회수·좋아요** | 집계 API(`PostViewDaily`), 중복 방지, UI, 대시보드 통계, M6 E2E | `FEATURE_REACTIONS=true`로 켬 |
| **M7 AI 자동 작성** | **선행: 비공개 미디어** → MCP 서버(토큰, Tools, Prompts), AI 초안함, 프로필 제안 승인, 시크릿 스캐너 ([상세](./03_ai_authoring_mcp_plan.md)) | Claude Code/Codex로 초안 작성 가능 |

---

## 8. 남은 확인 사항 (구현 전 결정 필요)

| # | 항목 | 기본안 (응답 없으면 이대로 진행) |
|---|---|---|
| Q0 | **배포 인프라 (D6)** | 보류. 결정되면 §6-a 요구사항을 기준으로 M-Deploy 계획을 세운다 |
| Q1 | 도메인 | 미정. D6 결정 후 설정 |
| ~~Q2~~ | ~~관리자 로그인 방식~~ | **확정 (D10)**: GitHub OAuth + 허용 목록 |
| Q3 | 블로그 카테고리 초기 목록 | 관리자에서 자유롭게 생성 (시드: Backend, Frontend, DevOps, Retrospect) |
| Q4 | UI 기획서 §10 미확정 9개 항목 | Figma MCP 한도가 리셋된 뒤 확인 (M1 시작 시) |
| Q5 | Next.js 버전과 `revalidateTag` 시그니처 | M0에서 버전 고정 시 공식 문서로 즉시 만료 옵션 확인 ([프론트엔드 §4](./02_frontend_plan.md#4-라우팅--렌더링-전략)) |

### 구현 착수 조건

| 시점 | 확정되어 있어야 할 것 | 문서 위치 |
|---|---|---|
| M0~M1 | 없음 (바로 시작 가능) | |
| M3 전 | 작업본 필드·버전 규칙, outbox 캐시 갱신, 완료 기준, slug 영구 예약 | [백엔드 §5.1, §5.7](./01_backend_plan.md#5-핵심-로직) |
| M4 전 | 프로젝트·기술스택·사이트맵 캐시 태그 의존성 | [백엔드 §5.7-②③](./01_backend_plan.md#57-캐시-정책--무효화) |
| M5 전 | 조회수·좋아요 UI·테스트를 기능 스위치로 분리 | [프론트엔드 §7.2, §10](./02_frontend_plan.md#10-테스트-전략) |
| M7 전 | 비공개 미디어 인증·캐시·이미지 최적화·공개 철회 범위 | [03 §4.3](./03_ai_authoring_mcp_plan.md#43-비공개-미디어-m7-선행-과제) |

---

## 9. 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| v0.1 | 2026-11-20 | 최초 작성 (개요, 백엔드, 프론트엔드), AI 자동 작성(03), 접근 통제·복사 방지(04) 추가 |
| v0.2 | 2026-11-20 | [기획 검토 피드백](./feedback/2026-11-20_plan_review.md) 반영: 공개본/작업본 분리(3.1), `/internal/*` 경로 분리(3.2), 응답별 캐시 정책·원문 별도 엔드포인트(3.3), 예약 발행 cron·`SCHEDULED` 정리(3.4), 이벤트별 무효화·재시도·slug 301(3.5), 미디어 사용처 추적·M7 전 비공개 미디어(3.6), tokenVersion 즉시 차단(3.7), `PostViewDaily`·조회수 정의(3.8), 방문자 경로·프로젝트 카드 보강·Featured 조건부(4.1~4.3), 연락처 복사 예외(4.4), 문서 불일치 5건(5장), 메타 텍스트 대비(5장), MCP 원격 URL 제거·토큰 발급자·`aiEditable`(6장), M5↔M6 순서 교체(7장) |
| v0.3 | 2026-11-21 | [2차 검토 피드백](./feedback/2026-11-20_plan_review_02.md) 반영: 비공개 미디어 인증 결과 무캐시·200/401+404 변환(3.1), 비공개 이미지 `unoptimized`·공개 철회 범위·유출 대응 절차(3.2), 이벤트 기반 기본/시간 기반 보조·즉시 만료·완료 기준 4구분(3.3), 캐시 갱신 outbox(`RevalidateEvent`)·`JobState`(3.4), 작업본 필드별 반영 규칙·버전 규칙·예약 시각 유지(3.5), slug 영구 예약(`PostSlug`)·상세 단일 내부 응답(3.6), 태그·기술스택·사이트맵 캐시 의존성(3.7), 연락처 예외 이벤트 일관 적용(4.1), placeholder 대비(4.2), MVP = M5 운영 오픈·조회수/좋아요는 M6 기능 스위치(4.3), MVP 스키마에서 M7 관계 제거(4.4), 프로젝트 열 수·개요 표 정리(4.5) |
| v0.4 | 2026-11-21 | 배포 보류(D6 변경, §6-a 배포 보류 범위·인프라 무관 요구사항, M5를 "품질 & 릴리스 준비"로, CD 보류), 협업 아키텍처 문서(05) 추가(D22) |
| v0.5 | 2026-11-21 | [3차 검토 피드백](./feedback/2026-11-21_plan_review_03.md) 반영: 공개 저장소(D23), 첫 작업본 생성 공개본 버전 검사(백엔드 §5.1), 예약 글·본문 교체 시 미디어 공개 여부 재계산(03 §4.3), 경로별 인증·CSRF 표(백엔드 §5.6), 입력 요소 복사 예외(04 §2.2), UI 검수 기록 경로, BE-10 배포 작업 분리(BE-12, M-Deploy), AI 프로젝트 썸네일 공개 시 필수, 협업 절차 보완(05 v0.3) |
| v0.6 | 2026-11-21 | [에이전트 팀 가이드 검토](./feedback/2026-11-21_agent_team_guide_review.md) 반영: 에이전트 실행 방식·모델 배정·테스트 환경 책임(D24, 05 v0.4) |
| v0.7 | 2026-11-21 | [4차 검토 피드백](./feedback/2026-11-21_plan_review_04.md) 반영: 작업본 고유 ID·강제 발행 확인 버전(백엔드 §5.1), refresh 원자적 회전·10초 동시 갱신 유예·탭 간 Web Locks(백엔드 §5.6, 프론트엔드 §7.1), 동시 실행 보장·필수 시나리오(백엔드 §5.8), 상세 조회 스냅샷, slug 복귀 금지(D20), outbox 재시도 횟수 정의, HTTP 캐시 지연 설명, 글별 AI 표기 필드(03), 협업 절차 보완(05 v0.5) |
| v0.8 | 2026-11-21 | 민감 정보 관리 규칙 추가(§6-b): 하드코딩 금지·`.env`로만 주입, 파일 구성, 코드 규칙, 검사 장치. 05·01·02에 참조 반영 |
