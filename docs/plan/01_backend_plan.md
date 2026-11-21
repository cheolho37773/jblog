# jblog 백엔드 기획서

> 버전 v0.1 · 작성일 2026-11-20
> 스택: **NestJS + Prisma + PostgreSQL 17** (Node.js 24 LTS, TypeScript)
> 공통 결정사항은 [00_overview.md](./00_overview.md)를 따른다.

---

## 1. 역할과 범위

| 책임 | 포함 |
|---|---|
| 콘텐츠 API | 글, 카테고리, 태그, 프로젝트, 경력, 기술스택, 프로필 CRUD (공개 조회 + 관리자 쓰기) |
| 인증/인가 | GitHub OAuth + 허용 목록(본인 1명), JWT 쿠키, Refresh 회전, 기본 차단 가드 — [04 Part 1](./04_access_control_and_content_protection.md) |
| 미디어 | 이미지 업로드 → WebP 변환/리사이즈 → 로컬 볼륨 저장 |
| 반응 | 조회수(중복 방지), 좋아요(익명 방문자 단위 토글) |
| 검색 | 제목/요약/본문 부분일치 (`pg_trgm`) |
| 연동 | 발행/수정 시 Next.js ISR revalidate 호출 |
| 비포함 | Markdown → HTML 렌더링 (프론트엔드 담당), 댓글/뉴스레터/Contact (MVP 제외) |

---

## 2. 프로젝트 구조

```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                  # 관리자 계정, 기본 카테고리, 샘플 글
├── src/
│   ├── main.ts                  # helmet, cookie-parser, ValidationPipe, Swagger, 글로벌 prefix /api
│   ├── app.module.ts
│   ├── config/                  # @nestjs/config + 환경변수 스키마 검증. 환경변수를 읽는 유일한 곳 (개요 §6-b)
│   ├── common/
│   │   ├── filters/             # HttpExceptionFilter → 공통 에러 포맷
│   │   ├── interceptors/        # 응답 래핑, 로깅
│   │   ├── decorators/          # 인증 방식: @Public() @OAuthFlow() @RefreshAuth() @InternalOnly() @McpAuth() / @CurrentUser() @VisitorId()
│   │   ├── guards/              # AuthGuard(글로벌, 인증 방식별 분기), CsrfHeaderGuard, ThrottlerGuard
│   │   ├── pagination/          # PageQueryDto, Paginated<T>
│   │   └── utils/               # slugify, readingTime, excerpt
│   ├── prisma/                  # PrismaService (전역 모듈)
│   └── modules/
│       ├── auth/
│       ├── posts/
│       ├── categories/
│       ├── tags/
│       ├── projects/
│       ├── experiences/
│       ├── tech-stacks/
│       ├── profile/
│       ├── media/               # StorageService(인터페이스) + LocalStorageService
│       ├── reactions/           # views, likes
│       ├── search/
│       ├── revalidate/          # Next.js webhook 클라이언트, 재시도, 예약 발행 cron
│       ├── internal/            # /internal/* 원문 API (InternalKeyGuard)
│       └── health/              # @nestjs/terminus
└── test/                        # e2e (Supertest + Testcontainers)
```

각 모듈의 레이어 규칙: `Controller`(HTTP, DTO 검증) → `Service`(비즈니스 로직, 트랜잭션) → `PrismaService`. Repository 레이어를 따로 두지 않고 Service에서 Prisma를 직접 쓴다 (규모 대비 과설계 방지).

---

## 3. 데이터 모델

### 3.1 ERD

```
User ─┬─< RefreshToken
      └─< McpToken (M7)

Category ─< Post >─< PostTag >─ Tag
              │
              ├── PostDraft       (1:1, 발행 글 편집 작업본)
              ├─< PostSlug        (현재·이전 slug, 전역 영구 예약)
              ├─< PostLike        (post_id, visitor_id) UNIQUE
              ├─< PostViewLog     (post_id, visitor_hash, viewed_on) UNIQUE — 중복 판정 전용
              └─< PostViewDaily   (post_id, date) — 통계 원본

Project >─< ProjectTechStack >─ TechStack
Experience
Profile (singleton)
Media ─< MediaUsage (참조 추적)
LoginAudit · RevalidateEvent (캐시 갱신 outbox) · JobState
```

### 3.2 Prisma 스키마 (초안)

```prisma
generator client { provider = "prisma-client-js" }
datasource db   { provider = "postgresql"; url = env("DATABASE_URL") }

enum PostStatus { DRAFT PUBLISHED }

model User {                                  // 허용된 GitHub 계정의 최초 로그인 시 생성 (회원가입 없음)
  id            String         @id @default(uuid()) @db.Uuid
  githubId      BigInt         @unique         // 허용 목록 비교 기준 (ADMIN_GITHUB_ID)
  githubLogin   String
  avatarUrl     String?
  createdAt     DateTime       @default(now())
  lastLoginAt   DateTime?
  tokenVersion  Int            @default(0)     // "모든 기기 로그아웃" 시 +1 → 기존 access JWT 즉시 무효 (§5.6)
  refreshTokens RefreshToken[]
  // M7에서 mcpTokens McpToken[] 관계를 추가한다 (03 §6). MVP 스키마에는 넣지 않는다
}

model LoginAudit {
  id          BigInt   @id @default(autoincrement())
  result      String                          // SUCCESS | DENIED | ERROR
  githubId    BigInt?
  githubLogin String?
  ipHash      String
  userAgent   String?
  createdAt   DateTime @default(now())
  @@index([createdAt])
}

model RefreshToken {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique          // 원문 저장 금지, SHA-256
  expiresAt DateTime
  revokedAt DateTime?
  replacedById String? @db.Uuid     // 회전으로 이 토큰을 대체한 새 토큰 (회전 시각 = revokedAt, 동시 갱신 유예 판단, §5.6)
  createdAt DateTime @default(now())
  @@index([userId])
}

model Category {
  id        Int     @id @default(autoincrement())
  name      String  @unique
  slug      String  @unique
  sortOrder Int     @default(0)
  posts     Post[]
}

model Tag {
  id    Int       @id @default(autoincrement())
  name  String    @unique
  slug  String    @unique
  posts PostTag[]
}

model Post {
  id            Int          @id @default(autoincrement())
  slug          String       @unique
  title         String
  excerpt       String?                       // 비우면 본문에서 160자 자동 생성
  contentMd     String       @db.Text
  coverImageUrl String?
  status        PostStatus   @default(DRAFT)    // 예약은 별도 상태 없이 PUBLISHED + 미래 publishedAt (§5.1)
  publishedAt   DateTime?                     // 미래 시각 = 예약 발행
  version       Int          @default(1)      // 낙관적 잠금. 저장마다 +1, 요청의 expectedVersion과 다르면 409
  isFeatured    Boolean      @default(false)  // Home Hero 카드 / Blog Overlay 카드
  readingMinutes Int         @default(1)
  viewCount     Int          @default(0)      // 비정규화 카운터
  likeCount     Int          @default(0)
  seoTitle      String?
  seoDescription String?
  categoryId    Int?
  category      Category?    @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  tags          PostTag[]
  likes         PostLike[]
  viewLogs      PostViewLog[]
  viewDaily     PostViewDaily[]
  draft         PostDraft?                    // 발행 글의 편집 작업본 (§5.1)
  slugs         PostSlug[]                    // 현재 slug + 이전 slug (영구 예약)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  @@index([status, publishedAt(sort: Desc)])
  @@index([categoryId])
}

model PostTag {
  postId Int
  tagId  Int
  post   Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag    Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([postId, tagId])
}

model PostLike {
  postId    Int
  visitorId String   @db.Uuid               // 익명 방문자 쿠키 jb_vid
  createdAt DateTime @default(now())
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  @@id([postId, visitorId])
}

model PostViewLog {
  postId      Int
  visitorHash String                         // sha256(ip + ua + 일자별 salt), 원본 IP 미저장
  viewedOn    DateTime @db.Date
  post        Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  @@id([postId, visitorHash, viewedOn])
  @@index([viewedOn])                        // 중복 판정 전용. 2일 지난 로그는 정리 (§5.2)
}

model PostViewDaily {                          // 통계 원본. 로그 정리와 무관하게 영구 보관
  postId  Int
  date    DateTime @db.Date
  views   Int      @default(0)               // 그날의 고유 방문 조회 수
  post    Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  @@id([postId, date])
  @@index([date])
}

model PostDraft {                              // 발행된 글을 편집할 때의 작업본 (글당 최대 1개)
                                               // slug·isFeatured·publishedAt은 작업본 대상이 아니다 (§5.1 필드별 반영 규칙)
  id             String   @id @default(uuid()) @db.Uuid  // 작업본마다 새 ID. 폐기 후 재생성하면 ID가 달라진다 (§5.1 버전 규칙)
  postId         Int      @unique
  post           Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  title          String
  excerpt        String?
  contentMd      String   @db.Text
  coverImageUrl  String?
  categoryId     Int?
  tags           String[]                    // 이름 배열 (발행 시 PostTag로 반영)
  seoTitle       String?
  seoDescription String?
  baseVersion    Int                         // 작업본을 만든 시점의 Post.version
  version        Int      @default(1)        // 작업본 자체의 낙관적 잠금
  updatedAt      DateTime @updatedAt
}

model PostSlug {                               // 한 번 쓴 slug는 전역에서 영구 예약 (§5.1 slug 정책)
  slug      String   @id                       // PK이므로 현재/이전 slug를 통틀어 중복 불가
  postId    Int?                               // 글 삭제 시 null → slug는 계속 예약됨
  post      Post?    @relation(fields: [postId], references: [id], onDelete: SetNull)
  isCurrent Boolean                            // 글마다 정확히 1개만 true (부분 unique 인덱스, 수동 SQL)
  createdAt DateTime @default(now())
  @@index([postId])
}

enum RevalidateEventStatus { PENDING DONE FAILED }

model RevalidateEvent {                        // 캐시 갱신 outbox (§5.7-④). 콘텐츠 변경과 같은 트랜잭션에서 생성
  id            BigInt                @id @default(autoincrement())
  tags          String[]
  reason        String                         // publish | draft_publish | schedule_due | unpublish | delete | slug_change ...
  status        RevalidateEventStatus @default(PENDING)
  attempts      Int                   @default(0)
  nextAttemptAt DateTime              @default(now())
  lastError     String?
  createdAt     DateTime              @default(now())
  processedAt   DateTime?
  @@index([status, nextAttemptAt])
}

model JobState {                               // 주기 작업의 진행 지점 (예: scheduled_publish.lastRunAt)
  key       String   @id
  value     DateTime
  updatedAt DateTime @updatedAt
}

model TechStack {
  id        Int                @id @default(autoincrement())
  name      String             @unique       // "TypeScript"
  slug      String             @unique
  iconKey   String                           // 프론트 아이콘 매핑 키 (simple-icons slug)
  category  String?                          // Language / Framework / DB / Infra
  showOnHome Boolean           @default(true) // "EXPERIENCE WITH" 노출
  sortOrder Int                @default(0)
  projects  ProjectTechStack[]
}

model Project {
  id            Int                @id @default(autoincrement())
  slug          String             @unique
  title         String
  summary       String                        // 카드 라벨/설명
  contentMd     String?            @db.Text   // 상세 본문
  thumbnailUrl  String?                       // 초안에서는 비워 둘 수 있음. 공개(isPublished=true) 시 필수 — 없으면 422 THUMBNAIL_REQUIRED
  role          String?
  startedOn     DateTime?          @db.Date
  endedOn       DateTime?          @db.Date   // null = 진행 중
  githubUrl     String?
  demoUrl       String?
  isFeatured    Boolean            @default(false)  // Home 노출
  sortOrder     Int                @default(0)
  isPublished   Boolean            @default(false)
  techStacks    ProjectTechStack[]
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
}

model ProjectTechStack {
  projectId   Int
  techStackId Int
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  techStack   TechStack @relation(fields: [techStackId], references: [id], onDelete: Cascade)
  @@id([projectId, techStackId])
}

model Experience {
  id          Int       @id @default(autoincrement())
  company     String
  role        String
  logoUrl     String?
  startedOn   DateTime  @db.Date
  endedOn     DateTime? @db.Date             // null = Present
  description String    @db.Text
  sortOrder   Int       @default(0)
}

model Profile {                               // 단일 행 (id = 1 고정)
  id          Int     @id @default(1)
  name        String
  title       String                          // "Backend Engineer"
  headline    String                          // Hero 헤드라인 ("I do code and\nmake content **about it!**")
  intro       String  @db.Text                // Hero 소개문
  bio         String  @db.Text                // About 페이지 Author Info
  avatarUrl   String?
  resumeUrl   String?                         // Download CV — Media(kind=DOCUMENT) 업로드 URL 또는 외부 URL
  email       String
  socialLinks Json                            // [{ type: "github", url }]
  updatedAt   DateTime @updatedAt
}

enum MediaKind { IMAGE DOCUMENT }

model Media {
  id         String     @id @default(uuid()) @db.Uuid
  kind       MediaKind  @default(IMAGE)        // DOCUMENT = 이력서 PDF
  path       String     @unique                // 2026/11/<uuid>.webp | docs/<uuid>.pdf
  originalName String
  mimeType   String
  sizeBytes  Int
  width      Int?                              // 이미지만
  height     Int?
  usages     MediaUsage[]
  createdAt  DateTime   @default(now())
}

model MediaUsage {                             // 삭제 보호용 참조 추적 (§5.5)
  mediaId    String  @db.Uuid
  media      Media   @relation(fields: [mediaId], references: [id], onDelete: Restrict)
  ownerType  String                            // post | post_draft | project | experience | profile
  ownerId    String
  @@id([mediaId, ownerType, ownerId])
  @@index([ownerType, ownerId])
}
```

### 3.3 마이그레이션 / 시드

- `prisma migrate dev`(로컬), `prisma migrate deploy`(운영 컨테이너 시작 시 entrypoint에서 실행)
- 검색용 확장과 인덱스는 수동 SQL 마이그레이션으로 추가한다:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX post_title_trgm   ON "Post" USING gin (title gin_trgm_ops);
  CREATE INDEX post_content_trgm ON "Post" USING gin ("contentMd" gin_trgm_ops);
  ```
- `seed.ts`: Profile 1행, 기본 카테고리, 샘플 글 9개(디자인 검수용)를 넣는다. **관리자 계정은 시드하지 않는다** (허용된 GitHub 계정의 최초 로그인 시 생성).

---

## 4. API 명세

- Base: `/api` · JSON · 시간은 ISO 8601(UTC) · 문서: `/api/docs` (Swagger UI, **운영에서는 비활성화 또는 관리자 인증 필요**)
- 공개 API: `@Public()`. 관리자 API: `/api/admin/*`, 기본값(관리자 JWT). 경로별 인증 방식은 §5.6 "경로별 인증·CSRF 표"

### 4.1 공통 규약

**목록 응답**
```json
{ "items": [ ... ], "page": 1, "size": 9, "totalItems": 42, "totalPages": 5 }
```
**에러 응답**
```json
{ "statusCode": 404, "code": "POST_NOT_FOUND", "message": "Post not found", "path": "/api/posts/abc", "timestamp": "..." }
```
- 페이지네이션: `?page=1&size=9` (size 최대 50). 블로그 "Load More"는 page를 증가시켜 호출한다.

### 4.2 공개 API

| Method | Path | 설명 | 비고 |
|---|---|---|---|
| GET | `/posts` | 발행 글 목록 | `?page&size&category=slug&tag=slug&featured=true` / `status=PUBLISHED AND publishedAt<=now()` |
| GET | `/posts/:slug` | 글 상세 **메타데이터** | `prev`/`next`(slug, title), `related`(같은 카테고리 3개) 포함. **`contentMd`는 어떤 경우에도 포함하지 않는다** (원문은 §4.5 내부 API). 이전 slug로 요청하면 `301` + `Location`(새 slug) |
| GET | `/categories` | 카테고리 + 발행 글 수 | 필터 칩, 푸터 Category |
| GET | `/tags` | 태그 + 글 수 | |
| GET | `/search` | 검색 | `?q&page&size`, q 2자 이상. 제목 일치를 우선 정렬 |
| GET | `/projects` | 공개 프로젝트 목록 | `?featured=true&tech=slug`. 아이템에 카드용 `summary`(한 줄), `role`, `techStacks` 상위 3개 포함 |
| GET | `/projects/:slug` | 프로젝트 상세 **메타데이터** | `contentMd` 미포함 (§4.5) |
| GET | `/experiences` | 경력 목록 | sortOrder, startedOn desc |
| GET | `/tech-stacks` | 기술스택 | `?home=true` |
| GET | `/profile` | 프로필 | |
| POST | `/posts/:slug/views` | 조회 기록 | 204. §5.2 |
| GET | `/posts/:slug/reactions` | `{ viewCount, likeCount, liked }` | liked는 방문자 쿠키 기준 → **`Cache-Control: private, no-store`** (§5.7) |
| PUT | `/posts/:slug/like` | 좋아요 | 멱등. `{ likeCount, liked: true }` |
| DELETE | `/posts/:slug/like` | 좋아요 취소 | 멱등 |
| GET | `/health` | 헬스체크 (DB ping) | |

**목록 아이템 형태 (PostSummary)** — 카드 렌더링에 필요한 필드만 담는다:
```json
{ "slug": "hello-nestjs", "title": "...", "excerpt": "...", "coverImageUrl": "/uploads/2026/11/x.webp",
  "category": { "name": "Backend", "slug": "backend" }, "publishedAt": "...", "readingMinutes": 5,
  "viewCount": 120, "likeCount": 8 }
```

### 4.3 인증 API

| Method | Path | 설명 |
|---|---|---|
| GET | `/auth/github` | state 쿠키 생성 → GitHub authorize로 302. Throttle **10회/분/IP** |
| GET | `/auth/github/callback` | state 검증 → code 교환 → `/user` 조회 → **`id === ADMIN_GITHUB_ID`일 때만** User upsert + access/refresh 쿠키 → 302 `/admin`. 아니면 LoginAudit(DENIED) → 302 `/admin/login?error=not_allowed` |
| POST | `/auth/refresh` | refresh 쿠키 검증 + **허용 목록 재확인** → 회전(이전 토큰 revoke) → 새 쿠키 |
| POST | `/auth/logout` | refresh revoke + 쿠키 삭제. `?all=true`면 모든 세션 폐기 |
| GET | `/auth/me` | 현재 관리자 |
| GET | `/admin/security` | 최근 로그인 기록(LoginAudit), 활성 세션 목록 · `DELETE /admin/security/sessions/:id` |

> 회원가입, 비밀번호 로그인, 비밀번호 재설정 엔드포인트는 **존재하지 않는다**.

### 4.4 관리자 API (`/admin/*`, 인증 필수)

| 리소스 | Endpoints |
|---|---|
| Posts | `GET /admin/posts?status&q&page` · `GET /admin/posts/:id` (작업본이 있으면 함께 반환) · `POST /admin/posts` · `PATCH /admin/posts/:id` (**DRAFT 글만**, `expectedVersion` 필수) · `DELETE /admin/posts/:id` · `POST /admin/posts/:id/publish` · `POST /admin/posts/:id/unpublish` |
| Post 작업본 (발행 글 편집) | `PUT /admin/posts/:id/draft` (작업본 생성·저장, 버전 규칙 §5.1) · `POST /admin/posts/:id/draft/publish` (**수정사항 발행**: 작업본 → 공개본 교체) · `DELETE /admin/posts/:id/draft` (작업본 폐기) |
| Post 즉시 반영 동작 | `PATCH /admin/posts/:id/featured` (Featured 토글) · `POST /admin/posts/:id/slug` (주소 변경, 확인 후 즉시 반영) · `POST /admin/posts/:id/schedule` (예약 시각 변경, 예약 글만) — 모두 `expectedVersion` 필수 |
| Cache | `GET /admin/revalidate/events?status=FAILED` · `POST /admin/revalidate/events/:id/retry` · `POST /admin/revalidate/all` (전체 캐시 갱신 이벤트 생성) |
| Categories | `GET/POST /admin/categories` · `PATCH/DELETE /admin/categories/:id` · `PATCH /admin/categories/order` |
| Tags | `GET /admin/tags` · `PATCH/DELETE /admin/tags/:id` (생성은 글 저장 시 이름으로 upsert) |
| Projects | `GET/POST /admin/projects` · `GET/PATCH/DELETE /admin/projects/:id` · `PATCH /admin/projects/order` |
| Experiences | `GET/POST /admin/experiences` · `PATCH/DELETE /admin/experiences/:id` · `PATCH /admin/experiences/order` |
| TechStacks | `GET/POST /admin/tech-stacks` · `PATCH/DELETE /admin/tech-stacks/:id` · `PATCH /admin/tech-stacks/order` |
| Profile | `GET /admin/profile` · `PUT /admin/profile` |
| Media | `POST /admin/media` (multipart, `file`, `kind=image\|document`) → `{ id, url, width?, height? }` · `GET /admin/media?page&kind` (각 항목에 사용처 수 포함) · `DELETE /admin/media/:id` (**사용 중이면 409** `MEDIA_IN_USE` + 사용처 목록) |
| Stats | `GET /admin/stats` → 총 글 수, 누적 조회수, 최근 30일 일별 조회수(`PostViewDaily`), 인기 글 Top 5. 조회수 정의는 §5.2 |
| Export (P1) | `GET /admin/export/markdown` → zip |

**CreatePostDto (예시)**
```ts
class CreatePostDto {
  @IsString() @Length(1, 200)               title: string;
  @IsOptional() @Matches(/^[a-z0-9-]+$/)    slug?: string;        // 없으면 title로 생성, 충돌 시 -2, -3
  @IsOptional() @IsString() @MaxLength(300) excerpt?: string;
  @IsString()                               contentMd: string;
  @IsOptional() @IsString()                 coverImageUrl?: string;
  @IsOptional() @IsInt()                    categoryId?: number;
  @IsArray() @IsString({ each: true })      tags: string[];       // 이름 배열 → upsert
  @IsOptional() @IsBoolean()                isFeatured?: boolean;
  @IsOptional() @IsString()                 seoTitle?: string;
  @IsOptional() @IsString()                 seoDescription?: string;
}
```

### 4.5 내부 API (`/internal/*`, web SSR 전용)

공개 페이지 렌더링에 필요한 **원문 Markdown**은 별도 내부 엔드포인트로만 제공한다. 같은 URL이 요청자에 따라 다른 응답을 내는 구조를 없애서 캐시 오염 위험을 제거한다.

| Method | Path | 설명 |
|---|---|---|
| GET | `/internal/posts/:slug` | 상세 렌더링에 필요한 **메타 + 원문을 한 응답으로** 반환: `{ post: {...메타, contentMd, version}, prev, next, related }`. 발행 + `publishedAt<=now()`인 글만. 이전 slug면 `{ redirectTo }` |
| GET | `/internal/projects/:slug` | 프로젝트 메타 + `contentMd` 한 응답. 공개 프로젝트만 |

- 상세 페이지는 이 내부 API **한 번만** 호출한다. 메타와 원문을 따로 받으면 발행 순간 서로 다른 버전을 받을 수 있다. 서버는 글 본문·메타를 **한 번의 조회**로 읽고, 이전/다음·관련 글까지 일관되게 보려면 **읽기 전용 `REPEATABLE READ` 트랜잭션**(하나의 스냅샷)에서 읽는다. PostgreSQL 기본 격리 수준(`READ COMMITTED`)에서는 같은 트랜잭션 안의 연속 조회도 서로 다른 시점을 볼 수 있기 때문이다 (§5.8).
- 공개 API `/api/posts/:slug`는 브라우저·외부 클라이언트용 메타 전용으로 남긴다 (원문 없음).

- 전역 prefix `/api`에서 제외된 경로다. **Nginx는 `/internal/` 경로를 외부에 노출하지 않는다** (`location /internal/ { return 404; }`).
- `InternalKeyGuard`: 헤더 `X-Internal-Key`가 `INTERNAL_API_KEY`와 일치해야 한다 (네트워크 분리와 이중 방어).
- 응답 헤더 `Cache-Control: private, no-store` (Next.js 데이터 캐시는 태그로 별도 관리, §5.7).

---

## 5. 핵심 로직

### 5.1 글 상태 · 저장 · 발행

**상태 모델** (별도 `SCHEDULED` 상태 없음)

| 화면 표시 | 저장 상태 | 공개 여부 |
|---|---|---|
| 초안 | `status=DRAFT` | 비공개 |
| 예약 | `status=PUBLISHED` + `publishedAt > now()` | 비공개 (시각 도달 시 공개) |
| 발행 | `status=PUBLISHED` + `publishedAt <= now()` | 공개 |
| 발행 + 편집 중 | 위 + `PostDraft` 존재 | 공개본은 그대로, 작업본은 비공개 |

**공개본과 편집 작업본 분리**

| 대상 | 저장 API | 공개 영향 |
|---|---|---|
| 한 번도 발행하지 않은 글 (DRAFT) | `PATCH /admin/posts/:id` (자동저장 포함) | 없음. **캐시 무효화를 호출하지 않는다** |
| 발행/예약된 글 | `PUT /admin/posts/:id/draft` → `PostDraft`에만 저장 (자동저장 포함) | 없음 |
| 발행된 글의 수정사항 발행 | `POST /admin/posts/:id/draft/publish` | 트랜잭션으로 작업본을 Post에 반영 → `PostDraft` 삭제 → `version+1` → 캐시 무효화 |

- 발행/예약된 글에 `PATCH /admin/posts/:id`를 보내면 `409 POST_PUBLISHED_USE_DRAFT`로 거부한다. 아래 표의 "즉시 반영" 필드는 각자의 전용 API로만 바꾼다.

**필드별 반영 규칙 (발행/예약된 글)**

| 필드 | 반영 방식 | API | 비고 |
|---|---|---|---|
| 제목, 요약, 본문, 커버, 카테고리, 태그, SEO 제목/설명 | **작업본 저장** → 수정사항 발행 시 공개 | `PUT .../draft` → `POST .../draft/publish` | |
| Featured | **즉시 반영** | `PATCH .../featured` | 공개본 `version+1`, 캐시 이벤트 생성 |
| slug | **별도 동작** (확인 다이얼로그 후 즉시 반영) | `POST .../slug` | 아래 slug 정책. 공개본 `version+1` |
| 예약 시각 (`publishedAt`) | **별도 동작** (예약 글만, 즉시 반영) | `POST .../schedule` | 이미 공개된 글의 발행일은 바꾸지 않는다 |

- 초안(DRAFT) 글은 위 모든 필드를 `PATCH /admin/posts/:id` 한 번으로 저장한다 (공개 영향 없음).
- **예약 글의 작업본 발행**: 수정사항 발행은 내용만 바꾸고 **기존 예약 시각을 유지**한다. 즉, 공개되지 않은 채 예약 상태가 이어진다.

**버전 규칙**

공개본(`Post.version`)과 작업본(`PostDraft.version`)은 버전을 따로 관리한다.

| 동작 | 요청 | 성공 조건 | 결과 |
|---|---|---|---|
| 작업본 **최초 생성** | `PUT .../draft` + **`expectedPostVersion`=편집을 시작할 때 불러온 공개본 version** (`draftId`·`expectedVersion`은 생략) | ① 작업본이 없어야 함. 이미 있으면 `409 DRAFT_EXISTS` + 기존 작업본 반환 ② **`expectedPostVersion == Post.version`** 이어야 함. 다르면 `409 POST_CHANGED` + 최신 공개본 반환 (편집을 시작한 뒤 다른 탭에서 수정사항이 발행된 경우) | 새 `PostDraft.id`(UUID) 발급, `version=1`, `baseVersion=expectedPostVersion` (= 현재 `Post.version`). 응답에 `draftId` 포함 |
| 작업본 **재저장** | `PUT .../draft` + **`draftId`** + `expectedVersion=작업본 version` | **`draftId`와 version이 모두 일치**. 작업본이 폐기·재생성돼 ID가 다르면 `409 DRAFT_REPLACED` + 현재 작업본, version만 다르면 `409 VERSION_CONFLICT` + 최신 작업본 | 작업본 `version+1` |
| **수정사항 발행** | `POST .../draft/publish` + **`draftId`** + `expectedVersion=작업본 version` | `draftId`·작업본 version 일치 **그리고** `baseVersion == Post.version`. 공개본이 그 사이 바뀌었으면 `409 DRAFT_BASE_OUTDATED` + 최신 공개본 version | 공개본에 반영, `Post.version+1`, 작업본 삭제, 캐시 이벤트 생성 |
| **강제 발행** (`DRAFT_BASE_OUTDATED` 확인 후) | `POST .../draft/publish` + `draftId` + `expectedVersion` + `force=true` + **`confirmedPostVersion`=확인창에서 사용자가 본 공개본 version** | `draftId`·작업본 version 일치 **그리고** `confirmedPostVersion == Post.version`. 확인창을 연 뒤 공개본이 또 바뀌었으면 다시 `409 DRAFT_BASE_OUTDATED` → 재확인 | 수정사항 발행과 같음 |
| 작업본 **폐기** | `DELETE .../draft` + **`draftId`** + `expectedVersion=작업본 version` | `draftId`·version 일치 (`DRAFT_REPLACED` / `VERSION_CONFLICT`) | 작업본 삭제 (공개 영향 없음) |
| 공개본 즉시 반영 동작 (Featured/slug/예약 시각) | 각 API + `expectedVersion=Post.version` | 공개본 version 일치 | `Post.version+1`. 열린 작업본의 `baseVersion`과 어긋나므로 이후 수정사항 발행 시 `DRAFT_BASE_OUTDATED`로 확인을 거친다 |
| 초안 저장 | `PATCH /admin/posts/:id` + `expectedVersion=Post.version` | 일치 | `Post.version+1` |

- 충돌 응답에는 항상 서버의 최신 내용과 version(작업본이면 `draftId`도)을 넣는다 (여러 탭, M7의 AI 동시 수정 대비).
- **작업본 ID가 필요한 이유**: 작업본을 글 ID로만 식별하고 생성마다 `version=1`로 시작하면, A 탭이 작업본 v1을 편집하는 사이 B 탭이 폐기 후 새로 만든 작업본(역시 v1)을 A의 늦은 자동저장이 `expectedVersion=1`로 덮어쓸 수 있다. 작업본마다 새 UUID를 주고 ID·버전을 함께 검사하면 막힌다.
- **최초 생성에도 공개본 버전을 검사하는 이유**: A 탭이 공개본 v1을 열어 둔 사이 B 탭이 수정사항을 발행해 v2가 되고 작업본이 삭제되면, A 탭의 첫 자동저장은 "작업본 없음" 상태라 그냥 생성된다. 이때 `baseVersion`을 서버의 현재 값(v2)으로 잡으면 A의 v1 기반 내용이 검사를 통과해 B의 수정을 되돌릴 수 있다. 클라이언트가 편집을 시작한 버전을 보내고 서버가 대조하면 이 덮어쓰기를 막을 수 있다.

**저장 시 공통 처리**
1. `readingMinutes = ceil(본문 글자수 / 500)` (한글 기준 분당 약 500자, 코드블록 제외)
2. `excerpt`가 비어 있으면 Markdown 문법을 제거한 본문 앞 160자
3. 태그는 이름 배열을 `upsert` 후 PostTag 교체 (트랜잭션)
4. 본문/커버의 미디어 URL을 파싱해 `MediaUsage` 갱신 (§5.5)
5. `isFeatured=true`면 다른 글의 isFeatured 해제 (1개 유지)

**발행 / 비공개 / 삭제 / slug 변경**
- `publish`: `status=PUBLISHED`, `publishedAt`이 비어 있으면 `now()`, 미래면 예약
- `unpublish`: `status=DRAFT` (작업본이 있으면 작업본 내용을 본문으로 합칠지 선택)
- 모든 상태 변경은 같은 트랜잭션에서 `RevalidateEvent`를 생성한다. 이벤트별 태그는 §5.7 표를 따른다.

**slug 정책 (영구 예약)**
- 한 번 쓴 slug는 **다른 글이 재사용할 수 없다**. `PostSlug.slug`가 PK이므로 현재·이전 slug를 통틀어 DB 수준에서 중복이 막힌다. 글을 만들거나 slug를 바꿀 때 이미 예약된 slug면 `409 SLUG_RESERVED`를 반환한다 (관리자 화면에서 자동 생성 시 `-2`, `-3` 접미사 제안).
- slug 변경: 기존 행 `isCurrent=false`, 새 행 `isCurrent=true`, `Post.slug` 갱신 (한 트랜잭션). 이전 주소 요청 → 현재 slug로 **301**.
- **이전 slug로의 복귀는 금지**한다 (같은 글이라도 `409 SLUG_RESERVED`). 이전 주소는 영구 이동(301)이므로, 복귀를 허용하면 `A → B`를 캐시한 브라우저에 `B → A`가 생겨 순환 이동이 일어날 수 있다. 실수로 바꿨다면 또 다른 새 slug로 바꾼다.
- 301 대상은 항상 **현재 slug**로 직접 보낸다 (A → B → C로 바뀌었으면 A와 B 모두 C로 한 번에 이동, 이동 체인 없음).
- **비공개 전환된 글**: 현재·이전 slug 모두 404.
- **삭제된 글**: `PostSlug.postId`가 null이 되어 slug는 계속 예약되고, 요청은 404를 반환한다.

**예약 발행 노출**
- `@nestjs/schedule`로 **1분 주기 작업**을 돌린다. 한 트랜잭션에서 ① `JobState('scheduled_publish')`를 `FOR UPDATE`로 잠그고 ② `publishedAt`이 `(lastRunAt, now()]` 구간인 글마다 `RevalidateEvent(reason=schedule_due)`를 넣고 ③ `lastRunAt=now()`로 갱신한다. 이벤트 생성과 진행 지점 갱신이 함께 커밋되므로 재시작해도 누락이나 중복 처리가 없다.
- 실제 캐시 무효화는 outbox 작업자가 처리한다 (§5.7-④). 노출 시점 기준은 §5.7-⑤.

### 5.2 조회수 (중복 방지)

```
POST /posts/:slug/views
 visitorHash = sha256(clientIp + userAgent + VISITOR_HASH_SALT + yyyy-mm-dd)
 INSERT INTO PostViewLog (postId, visitorHash, viewedOn=today) ON CONFLICT DO NOTHING
 if inserted →
   UPDATE Post SET viewCount = viewCount + 1
   INSERT INTO PostViewDaily (postId, date=today, views=1) ON CONFLICT DO UPDATE SET views = views + 1
```
- **조회수의 정의: "하루 단위 고유 방문 조회"**. 같은 방문자가 하루에 여러 번 봐도 1회다. 전체 페이지뷰가 아니다. 대시보드와 글 상세에 같은 정의로 표시한다.
- `PostViewLog`는 **중복 판정 전용**이고, 통계는 `PostViewDaily`에서 계산한다. 그래서 로그 정리가 통계에 영향을 주지 않는다.
- 같은 방문자는 **하루 1회**만 카운트한다. IP 원문은 저장하지 않는다 (개인정보 최소화).
- 봇 필터: User-Agent에 `bot|crawler|spider|preview`가 있으면 무시한다. 관리자 로그인 상태(access 쿠키 유효)도 제외한다.
- `clientIp`: Nginx의 `X-Forwarded-For` → Nest `app.set('trust proxy', 1)`.
- `viewedOn < 어제` 로그는 일 1회 정리한다 (`@nestjs/schedule` cron). 중복 판정에는 당일 로그만 필요하다.
- 글을 삭제하면 해당 글의 통계(`PostViewDaily`)도 함께 삭제한다. 사이트 전체 누적 수치는 삭제된 글 몫만큼 줄어든다 (개인 블로그에서 허용).
- Throttle: 30회/분/IP.

### 5.3 좋아요

- 익명 방문자 식별: 첫 요청 시 `jb_vid` 쿠키(UUID v4, httpOnly, 1년, SameSite=Lax)를 발급한다 (`VisitorIdMiddleware`).
- `PUT like`: `INSERT ... ON CONFLICT DO NOTHING`. 삽입되면 `likeCount + 1`. `DELETE`는 반대로 처리한다. 모두 트랜잭션이며 멱등이다.
- 쿠키 삭제로 중복 좋아요가 가능하다는 한계는 개인 블로그 수준에서 허용한다. Throttle 10회/분/IP로 남용을 제한한다.

### 5.4 검색

```sql
SELECT ... FROM "Post"
WHERE status='PUBLISHED' AND "publishedAt" <= now()
  AND (title ILIKE '%' || $q || '%' OR excerpt ILIKE ... OR "contentMd" ILIKE ...)
ORDER BY (title ILIKE '%' || $q || '%') DESC, "publishedAt" DESC
```
- `pg_trgm` GIN 인덱스가 ILIKE를 가속한다. Prisma `$queryRaw`(파라미터 바인딩)로 작성한다.
- 글이 1,000개를 넘거나 형태소 검색이 필요해지면 Meilisearch 도입을 검토한다.

### 5.5 미디어 업로드 (이미지 · 이력서 PDF)

```
POST /admin/media (multipart)
 [image]    크기 ≤10MB, MIME image/jpeg|png|webp|gif + 매직바이트 검사(file-type)
            sharp: EXIF 제거, 긴 변 최대 2000px, WebP(q=82) 변환 (GIF는 원본 유지)
            저장: {UPLOAD_DIR}/{yyyy}/{mm}/{uuid}.webp
 [document] 크기 ≤10MB, MIME application/pdf + 매직바이트(%PDF-) 검사, 변환 없음
            저장: {UPLOAD_DIR}/docs/{uuid}.pdf  (Nginx가 Content-Disposition: attachment로 서빙)
 → Media 행 생성 → { id, url, width?, height? }
```
- 이력서(Download CV)는 `kind=document`로 업로드한 URL을 `Profile.resumeUrl`에 저장한다. 외부 URL(Google Drive 등)을 직접 입력해도 된다.
- `StorageService` 인터페이스(`put`, `delete`, `publicUrl`)와 `LocalStorageService` 구현을 둔다. S3로 옮길 때는 구현체만 교체한다.
- 반응형 srcset은 Next.js Image Optimization이 담당한다 (원본 1장만 저장). 단, M7에서 도입하는 **비공개 이미지는 최적화를 거치지 않는다** (최적화기는 원본을 받을 때 관리자 쿠키를 전달하지 않기 때문, [03 §4.3](./03_ai_authoring_mcp_plan.md#43-비공개-미디어-m7-선행-과제)).

**참조 추적 & 삭제 보호**
- 글/작업본/프로젝트/경력/프로필을 저장할 때 본문과 필드의 `/uploads/...` URL을 파싱해 `MediaUsage`를 갱신한다.
- `DELETE /admin/media/:id`는 사용처가 있으면 `409 MEDIA_IN_USE`와 사용처 목록을 반환한다. 사용처가 없는 미디어만 삭제된다.
- 사용처 없는 미디어가 30일 넘게 남아 있으면 관리자 미디어 화면에 "미사용" 표시 (자동 삭제는 하지 않음).

**공개 범위 (현재와 M7 전 과제)**
- 현재(M3~M6): 업로드 파일은 추측 불가능한 UUID 경로로 Nginx가 공개 서빙한다. 초안에 넣은 이미지도 **URL을 아는 사람은 볼 수 있다**. 관리자 1인이 직접 올리는 이미지이므로 이 수준을 허용한다.
- **M7 착수 전 필수**: AI가 레포 스크린샷을 올리면 비공개 정보가 섞일 위험이 커진다. 그래서 M7 전에 `Media.isPublic`과 Nginx `auth_request` 기반 비공개 미디어를 도입한다. 공개된 콘텐츠가 참조하는 미디어만 누구나 볼 수 있고, 나머지는 관리자 세션이 있어야 볼 수 있다. URL은 바뀌지 않는다. 인증 결과 캐시 금지, 공개 철회의 범위, 유출 대응 절차는 [03 §4.3](./03_ai_authoring_mcp_plan.md#43-비공개-미디어-m7-선행-과제)을 따른다.

### 5.6 인증 상세

| 항목 | 값 |
|---|---|
| 로그인 | GitHub OAuth (`passport-github2`, scope `read:user`) + 허용 목록 `ADMIN_GITHUB_ID`. GitHub access_token은 저장하지 않음. 흐름 상세: [04 §1.3](./04_access_control_and_content_protection.md) |
| 가드 | 글로벌 `AuthGuard`(기본 차단)가 라우트의 **인증 방식 메타데이터**를 읽어 해당 검증만 수행한다. 메타데이터가 없는 라우트는 관리자 JWT를 요구한다. 경로별 적용은 아래 "경로별 인증·CSRF 표" |
| Access 토큰 | JWT 15분, 쿠키 `jb_at` (httpOnly, Secure, SameSite=Lax, Path=/). 페이로드에 `tv`(User.tokenVersion) 포함 |
| 즉시 차단 | 관리자 JWT 검증(글로벌 `AuthGuard`의 기본 방식)이 매 관리자 요청마다 `jwt.tv === User.tokenVersion`을 확인한다 (관리자 요청량이 적어 DB 조회 비용은 무시 가능). "모든 기기 로그아웃"과 refresh 재사용 감지 시 `tokenVersion+1` → **이미 발급된 access 토큰도 즉시 무효** |
| Refresh 토큰 | 랜덤 256bit, 7일, 쿠키 `jb_rt` (httpOnly, Secure, SameSite=Strict, Path=/api/auth). DB에는 SHA-256 해시만 저장 |
| 회전 | refresh 시 이전 토큰을 revoke하고 새 토큰을 발급한다. **revoke된 토큰이 재사용되면 해당 사용자의 모든 토큰을 폐기**한다 (탈취 감지) |
| 회전의 원자성 | 회전은 `UPDATE RefreshToken SET revokedAt=now(), replacedById=<새 ID> WHERE tokenHash=$1 AND revokedAt IS NULL` 한 문장으로 처리한다. 영향 행이 1이면 이 요청이 회전에 성공한 것이고, 0이면 이미 회전된 토큰이다. 두 요청이 동시에 와도 회전은 한 번만 일어난다 |
| 동시 갱신 유예 | 이미 회전된 토큰이 **회전 후 10초 이내**에 다시 오면 탈취로 보지 않는다. 같은 사용자의 정상 동시 갱신(여러 탭, 응답 유실 후 재시도)일 가능성이 높기 때문이다. 이때는 새 토큰을 하나 더 발급하지 않고 `409 REFRESH_IN_PROGRESS`를 돌려주며, 클라이언트는 짧게 기다린 뒤 다른 탭이 받아 둔 새 쿠키로 원 요청을 다시 시도한다. **10초가 지난 재사용은 기존대로 탈취로 처리**(전체 폐기 + tokenVersion+1) |
| 클라이언트 조정 | 탭 간에는 Web Locks API(`navigator.locks`)로 갱신을 한 번에 하나만 하고, 다른 탭은 잠금이 풀린 뒤 쿠키가 이미 바뀌었는지 확인한다 ([프론트엔드 §7.1](./02_frontend_plan.md#71-인증-흐름)). 서버 유예는 잠금을 못 쓰는 경우(구형 브라우저, 응답 유실)를 위한 안전망이다 |
| CSRF | SameSite=Lax + 상태 변경 요청에 커스텀 헤더 `X-Requested-With: jblog` 필수 (Guard에서 검사) |
| 로그인 실패/거부 | Throttle 10회/분/IP, 모든 시도를 `LoginAudit`에 기록, 거부 사유는 화면에 "허용되지 않은 계정입니다"로만 표시 |
| 테스트 로그인 | `NODE_ENV=test`에서만 로드되는 `TestAuthModule`. 운영 빌드에는 포함하지 않음 |

**경로별 인증·CSRF 표**

글로벌 가드 하나에 여러 인증 방식을 섞지 않도록, 라우트마다 **인증 방식을 하나만** 데코레이터로 지정한다. `@Public()`은 "모든 인증 생략"이 아니라 **"인증 없음" 방식 하나**를 뜻한다.

| 경로 | 데코레이터 (인증 방식) | 검증 내용 | CSRF 헤더 검사 (`X-Requested-With`) |
|---|---|---|---|
| 공개 조회 `GET /api/posts`, `/categories`, `/projects` … | `@Public()` | 없음 | 해당 없음 (GET) |
| 방문자 반응 `POST /api/posts/:slug/views`, `PUT/DELETE like` | `@Public()` + `VisitorIdMiddleware` | 없음 (방문자 쿠키만 발급·사용) | **적용** (쿠키 기반 상태 변경) |
| OAuth 시작·콜백 `GET /api/auth/github`, `/callback` | `@OAuthFlow()` | state 쿠키 대조 (콜백) | 해당 없음 (GET, state로 CSRF 방지) |
| `POST /api/auth/refresh` | `@RefreshAuth()` | refresh 쿠키 검증 + 허용 목록 재확인. **만료된 access JWT는 보지 않는다** | **적용** |
| `POST /api/auth/logout` | `@RefreshAuth()` | refresh 쿠키 (없어도 쿠키 삭제는 수행) | **적용** |
| `GET /api/auth/me`, `/api/admin/**` | (기본값) 관리자 JWT | access JWT 서명·만료 + `tokenVersion` + 허용 목록 | 상태 변경 요청에 **적용** |
| `/internal/**` | `@InternalOnly()` | `X-Internal-Key` 일치. JWT 보지 않음 | 해당 없음 (쿠키 미사용) |
| `/internal/media-auth` (M7) | `@InternalOnly()` + 자체 판정 | 내부 키 + 03 §4.3 판정 흐름 | 해당 없음 |
| `/mcp` (M7) | `@McpAuth()` | Bearer MCP 토큰 + scope + 발급자 허용 목록 | 해당 없음 (쿠키 미사용, Bearer) |
| `GET /api/health` | `@Public()` | 없음 | 해당 없음 |

- 한 라우트에 인증 데코레이터가 둘 이상 붙거나, 컨트롤러와 메서드에서 서로 다른 방식을 지정하면 **앱 시작 시 오류**로 막는다 (부팅 시 라우트 메타데이터 검사).
- 테스트: 위 표의 각 행에 대해 "올바른 자격 증명 → 통과", "다른 방식의 자격 증명(예: `/internal`에 관리자 JWT, `/mcp`에 쿠키) → 401", "CSRF 헤더 누락 → 403"을 검사한다.

### 5.7 캐시 정책 & 무효화

캐시는 두 층으로 나눠서 설계한다.

- **HTTP 캐시**: API 응답의 `Cache-Control`. 브라우저와 (나중에 붙을 수 있는) 공유 캐시가 대상이다.
- **Next.js 데이터/페이지 캐시**: web의 `fetch` 캐시와 ISR. 태그로 무효화한다.

**① HTTP 캐시 정책 (응답 유형별)**

| 응답 유형 | 예시 | `Cache-Control` |
|---|---|---|
| 공용 콘텐츠 | `GET /api/posts`, `/posts/:slug`(메타), `/categories`, `/projects`, `/profile` | `public, max-age=60, stale-while-revalidate=300` |
| 방문자별 상태 | `GET /posts/:slug/reactions`, `PUT/DELETE like`, `POST views` | `private, no-store` |
| 관리자 / 인증 | `/api/admin/*`, `/api/auth/*` | `private, no-store` |
| 내부 원문 | `/internal/*` | `private, no-store` (외부 비노출) |
| 검색 | `GET /search` | `public, max-age=30` |
| 업로드 파일 | `/uploads/*` (Nginx) | `public, max-age=31536000, immutable` (파일명이 UUID라 내용이 바뀌지 않음). M7 이후 비공개 미디어는 `private, no-store` ([03 §4.3](./03_ai_authoring_mcp_plan.md#43-비공개-미디어-m7-선행-과제)) |

- 방문자 쿠키(`jb_vid`)나 인증 쿠키를 읽는 응답은 예외 없이 `private, no-store`다. `NoStoreInterceptor`를 해당 컨트롤러에 적용한다.

**② Next.js 캐시 태그**

태그는 **API 응답에 포함되는 연관 데이터까지** 기준으로 붙인다. 한 fetch가 여러 종류의 데이터를 담으면 해당 태그를 모두 붙인다.

| 태그 | 이 태그를 붙이는 fetch (= 무효화 시 갱신되는 화면) |
|---|---|
| `posts` | 글 목록(카테고리·태그 필터 포함), Home 최신글/Featured, 카테고리·태그 목록과 글 수, 글 상세의 이전/다음·관련 글, RSS, **사이트맵** |
| `post:<slug>` | 글 상세 (내부 API 한 응답: 메타 + 원문) |
| `projects` | 프로젝트 목록, Home Featured Projects, 프로젝트 상세(기술스택 표시 포함), **사이트맵** |
| `project:<slug>` | 프로젝트 상세 |
| `tech-stacks` | Home 기술스택 행, About 기술스택, 기술스택 필터 칩 |
| `profile` | Hero, About, Footer, AuthorInfoBox (모든 공개 페이지의 레이아웃 fetch) |
| `experiences` | About 경력 |

**③ 이벤트별 무효화 대상**

개인 블로그 규모라 **글이 바뀌면 `posts` 태그 전체를 무효화**하는 단순한 방식을 쓴다. 이전/다음, 관련 글, 카테고리·태그 수, RSS, 사이트맵이 모두 `posts` 태그에 묶여 있다.

| 이벤트 | 무효화 태그 |
|---|---|
| 초안 저장, 작업본 저장 | **없음** |
| 발행 / 예약 시각 도달 / 수정사항 발행 | `posts`, `post:<slug>` |
| 비공개 전환 / 삭제 | `posts`, `post:<slug>` |
| slug 변경 | `posts`, `post:<이전 slug>`, `post:<새 slug>` |
| Featured 변경 / 예약 시각 변경 | `posts` |
| 카테고리 이름·slug·순서 변경, 삭제 | `posts` |
| **태그 이름·slug 변경, 삭제** | `posts` + 해당 태그가 붙은 글들의 `post:<slug>` |
| 프로젝트 공개 / 수정 / 비공개 / 삭제 / 순서 / slug 변경 | `projects`, `project:<slug>` (slug 변경 시 이전·새 slug 둘 다). 사이트맵은 `projects` 태그로 함께 갱신 |
| **기술스택 이름·아이콘·순서 변경, 삭제** | `tech-stacks`, `projects` (프로젝트 카드·상세의 기술 표시) |
| 프로필 수정 | `profile` |
| 경력 수정 | `experiences` |

**④ 처리 방식: outbox 테이블**

DB 커밋 직후나 재시도 중에 프로세스가 죽어도 갱신 요청이 사라지지 않도록, 메시지 서버 없이 PostgreSQL 테이블 하나(`RevalidateEvent`)로 outbox 패턴을 쓴다.

```
[콘텐츠 변경 트랜잭션]
  UPDATE Post ... ;
  INSERT INTO RevalidateEvent(tags, reason) ... ;     ← 같은 트랜잭션. 둘 다 커밋되거나 둘 다 롤백
COMMIT
  → 작업자에게 "새 이벤트 있음" 신호 (즉시 처리 시도, 실패해도 무관)

[RevalidateWorker] 5초 주기 + 신호 수신 시
  SELECT ... WHERE status='PENDING' AND nextAttemptAt <= now()
    ORDER BY id LIMIT 20 FOR UPDATE SKIP LOCKED
  → 태그를 합쳐 POST WEB_REVALIDATE_URL { tags }   (헤더 x-revalidate-secret)
     ├ 성공 → status=DONE, processedAt=now()
     └ 실패 → attempts = attempts + 1
              attempts < 5 → nextAttemptAt = now() + BACKOFF[attempts - 1]
                             BACKOFF = [5s, 30s, 2m, 10m]   (1~4회 실패 후 대기)
              attempts = 5 → status=FAILED  (최초 시도 포함 총 5회 시도 후 종료)
```
- 프로세스가 재시작되면 남아 있던 `PENDING` 이벤트를 그대로 이어서 처리한다. 갱신 요청은 멱등이므로 중복 처리돼도 문제없다.
- `FAILED` 이벤트가 있으면 관리자 화면 상단에 "캐시 갱신 실패 N건 – [재시도]" 배너를 띄운다. 재시도는 `PENDING`으로 되돌린다.
- `POST /admin/revalidate/all`: 모든 태그를 담은 이벤트를 하나 만든다 (최후 수단).
- `DONE` 이벤트는 7일 후 정리한다.

**⑤ 완료 기준 (무엇을 보장하고 무엇을 보장하지 않는가)**

| 구분 | 기준 |
|---|---|
| 서버 캐시 무효화 완료 | 이벤트 커밋 후 작업자가 처리하면 완료. 정상 상태에서 **수 초 이내**. 예약 글은 예약 시각 후 다음 1분 주기 작업이 이벤트를 만든 뒤 처리된다. web 장애 시에는 재시도 일정에 따라 늦어지며 `FAILED`면 관리자에게 표시된다 |
| 새 요청 | 무효화 완료 **이후에 들어온** 페이지 요청은 최신 데이터를 받는다. 무효화는 즉시 만료 방식으로 호출한다 (stale 응답을 먼저 주지 않음, 프론트엔드 §4) |
| 이미 열린 화면 | 자동 갱신하지 않는다. 새로고침이나 다른 페이지 이동 시 반영된다. 열린 목록의 Load More는 **처음 연 시점의 결과에 이어서** 다음 페이지를 붙이므로 중간에 발행된 글이 빠지거나 겹칠 수 있다 (중복은 slug 기준으로 제거) |
| 브라우저/HTTP 캐시 | 공용 API 응답은 `max-age=60, stale-while-revalidate=300`이다. 브라우저가 직접 API를 부른 결과(Load More 등)는 60초 동안 캐시에서 나오고, 그 뒤 최대 5분까지는 **이전 응답을 먼저 보여주고 뒤에서 갱신**할 수 있다. 즉 최신 반영까지 **최대 약 6분** 걸릴 수 있으며, 새로고침해도 같은 규칙이다 |
| 시간 기반 재검증 | 보조 수단일 뿐이며 노출 지연의 상한으로 쓰지 않는다 |

### 5.8 동시 실행 보장과 검증 시나리오

"같은 트랜잭션"만으로는 동시 실행 안전이 보장되지 않는다 (PostgreSQL 기본 `READ COMMITTED`). 핵심 보장마다 처리 방식과 **반드시 통과해야 할 동시 실행 테스트**를 정한다. 구현 세부는 Backend Agent가 정하되, 아래 시나리오는 Test Agent의 필수 검증 항목이다.

| 보장 | 처리 방식 | 필수 동시 실행 시나리오 |
|---|---|---|
| 버전 저장 (공개본·작업본·프로젝트) | 버전 조건을 포함한 **원자적 갱신**: `UPDATE ... SET version = version + 1 WHERE id = $id AND version = $expected` → 영향 행 0이면 409 | 같은 version으로 저장 요청 2개 동시 → 정확히 1개 성공, 1개 409 |
| 작업본 생성 | `PostDraft.postId` unique 제약 + 생성 전 `Post` 행 잠금(`SELECT ... FOR UPDATE`) 후 `Post.version` 대조 | 최초 생성 2개 동시 → 1개 성공, 1개 `DRAFT_EXISTS` / 생성과 수정사항 발행 동시 → 덮어쓰기 없음 |
| 수정사항 발행 | `Post` 행 잠금 → `baseVersion`·작업본 ID·version 확인 → 반영 → 작업본 삭제 → outbox 이벤트, 한 트랜잭션 | 발행 2개 동시 → 1개 성공 / 발행과 작업본 재저장 동시 → 재저장은 `DRAFT_REPLACED` 또는 `VERSION_CONFLICT` |
| refresh 회전 | 조건부 `UPDATE`(§5.6 회전의 원자성) | 같은 refresh 토큰 2개 동시 → 회전 1회, 다른 1개는 `REFRESH_IN_PROGRESS`, 세션 유지 / 응답 유실 후 10초 내 재시도 → 세션 유지 / 10초 후 재사용 → 전체 폐기 |
| 상세 응답 | 단일 조회 또는 읽기 전용 `REPEATABLE READ` 스냅샷 (§4.5) | 상세 조회 중 수정사항 발행 → 응답의 메타·원문·version이 한 시점으로 일치 |
| slug 예약 | `PostSlug.slug` PK | 같은 slug로 생성·변경 2개 동시 → 1개 성공, 1개 `SLUG_RESERVED` |
| 미디어 공개 여부 (M7) | 재계산 대상 `Media` 행을 **ID 순서로 잠근 뒤** 참조를 다시 세어 갱신 (교착 방지), 직렬화 실패 시 최대 3회 재시도 | 같은 이미지를 참조하는 글 A 비공개 전환과 글 B 발행 동시 → 최종 `isPublic=true` / 둘 다 비공개 전환 동시 → 최종 `false` |
| outbox 처리 | `FOR UPDATE SKIP LOCKED` | 작업자 2개 동시 → 같은 이벤트 중복 처리 없음 |

---

## 6. 비기능 요구사항

| 항목 | 기준 |
|---|---|
| 민감 정보 | 비밀값·접속 정보는 `backend/.env`로만 주입하고 코드에 하드코딩하지 않는다. `ConfigModule`의 스키마 검증으로 누락 시 부팅 실패, 비밀값 기본값 금지, `ConfigService` 밖에서 `process.env` 접근 금지. 상세: [개요 §6-b](./00_overview.md#6-b-민감-정보-관리-규칙-필수) |
| 보안 | helmet, ValidationPipe(`whitelist`, `forbidNonWhitelisted`, `transform`), Prisma 파라미터 바인딩, 업로드 매직바이트 검사, 에러 응답에 스택 미노출, `.env` 미커밋. 상세는 `api-security-checklist` 스킬 기준으로 점검한다 |
| 성능 | 공개 목록 API p95 < 100ms (로컬 기준). 목록 쿼리는 `select`로 `contentMd`를 제외한다 |
| 캐시 | 응답 유형별 정책과 무효화 규칙은 §5.7. 방문자별·관리자·내부 응답은 공유 캐시에서 제외 |
| 로깅 | pino JSON, 요청 ID(`x-request-id`) 전파, 운영 레벨 `info`. 민감정보(비밀번호, 토큰, 쿠키)는 redact 처리 |
| 헬스체크 | `GET /api/health` (DB ping). Docker `HEALTHCHECK`에 연결 |
| 종료 | `enableShutdownHooks()`로 graceful shutdown |

---

## 7. 테스트 전략

| 레벨 | 도구 | 대상 |
|---|---|---|
| 단위 | Jest | slugify, readingTime, excerpt 생성, visitorHash, 발행 상태 판정 |
| 통합/E2E | Jest + Supertest + **Testcontainers(postgres:17)** | 각 모듈 API: 공개 필터링(DRAFT/예약글 비노출), 인증 흐름(GitHub 콜백 모킹: 허용 ID 통과·비허용 ID 거부·state 불일치 거부 → refresh 회전 → 재사용 감지 → 허용 목록 제거 시 refresh 실패), 미인증 `/api/admin/*` 전부 401, 공개 API에 `contentMd` 미포함·`/internal/*`는 키 없으면 401, 좋아요 멱등, 조회수 일 1회 + `PostViewDaily` 집계, 업로드 MIME 거부·PDF 허용 |
| 콘텐츠 상태 | Jest + Testcontainers | 발행 글 `PATCH` 거부, 작업본 저장이 공개 응답을 바꾸지 않음, 수정사항 발행 후 반영, 버전 규칙 표 전 항목(최초 생성 `DRAFT_EXISTS`·`POST_CHANGED`, 폐기 후 재생성된 작업본에 이전 ID로 저장 시 `DRAFT_REPLACED`, 재저장/발행/폐기 `VERSION_CONFLICT`, `DRAFT_BASE_OUTDATED`, 강제 발행 시 `confirmedPostVersion` 불일치 재확인), 이전 slug 복귀 거부·A→B→C 후 A·B 모두 C로 301, 예약 글 작업본 발행 시 예약 시각 유지, slug 재사용 `SLUG_RESERVED`·이전 slug 301·비공개/삭제 글 404, 사용 중 미디어 삭제 409 |
| 캐시/outbox | Jest + Testcontainers | 콘텐츠 변경과 `RevalidateEvent`가 같은 트랜잭션(롤백 시 이벤트 없음), 작업자 재시작 후 `PENDING` 이어서 처리, 실패 시 재시도 일정·5회 후 `FAILED`, 예약 cron의 `JobState`·이벤트 동시 커밋, 이벤트별 태그 표(태그·기술스택·프로젝트 slug 변경 포함), 응답 유형별 `Cache-Control` 헤더 스냅샷 |
| 인증 | Jest + Supertest | "모든 기기 로그아웃" 직후 기존 access 토큰으로 `/api/admin` 요청 시 401, refresh 동시 2건·응답 유실 재시도·유예 후 재사용 (§5.8) |
| 동시 실행 | Jest + Testcontainers (실제 PostgreSQL, 병렬 요청) | §5.8 표의 필수 동시 실행 시나리오 전부 |
| 계약 | OpenAPI 스냅샷 | CI에서 `backend/openapi.json`을 생성해 커밋된 파일과 diff를 확인하고, 프론트엔드 생성 타입(`frontend/src/generated/**`)도 재생성해 diff를 확인한다 |

커버리지 목표: Service 레이어 80% 이상.

---

## 8. 컨테이너 & 배포

**Dockerfile (multi-stage)**
```
base(node:24-alpine) → deps(pnpm fetch) → build(turbo build --filter=api, prisma generate) → runner
runner: 비root 사용자, dist + node_modules(prod) + prisma, HEALTHCHECK
ENTRYPOINT: prisma migrate deploy && node dist/main.js
```

**docker-compose (로컬, `infra/docker-compose.yml`)**
```yaml
services:
  db:
    image: postgres:17-alpine
    environment: { POSTGRES_USER: jblog, POSTGRES_PASSWORD: jblog, POSTGRES_DB: jblog }
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U jblog"], interval: 5s, retries: 10 }
volumes: { pgdata: {} }
```

**배포는 보류**한다 (개요 D6, [§6-a](./00_overview.md#6-a-배포-보류-범위)). 지금은 Dockerfile 작성과 CI에서의 이미지 빌드 검증까지만 한다. 배포 파이프라인, 운영 구성, 백업 자동화는 인프라가 정해진 뒤 별도 마일스톤에서 계획한다. 백업 요구사항(DB 일 1회 이상, 업로드 파일 포함, 외부 보관)은 그때의 기준으로 유지한다.

---

## 9. 작업 분해 (WBS)

| ID | 작업 | 마일스톤 |
|---|---|---|
| BE-01 | Nest 프로젝트 생성, config/logging/helmet/ValidationPipe/Swagger/에러필터 | M0 |
| BE-02 | Prisma 스키마, 마이그레이션, pg_trgm, seed | M0 |
| BE-03 | Posts/Categories/Tags 공개 조회 + 검색 | M2 |
| BE-04 | Auth: GitHub OAuth + 허용 목록, refresh/logout/me, 글로벌 `AuthGuard`(인증 방식 데코레이터, 부팅 시 메타데이터 검사), CSRF 헤더 검사, LoginAudit/세션 관리 (SEC-01~03) | M3 |
| BE-04a | 내부 API `/internal/posts/:slug`·`/internal/projects/:slug`(메타+원문 단일 응답) + `InternalKeyGuard`, 응답 유형별 `Cache-Control` (SEC-05, §4.5, §5.7-①) | M2 |
| BE-05 | Admin Posts CRUD/발행, **작업본(PostDraft)·수정사항 발행**, 필드별 반영 규칙·즉시 반영 API, 버전 규칙, slug 영구 예약(`PostSlug`)/301, 태그 upsert, readingTime/excerpt | M3 |
| BE-06 | Media 업로드 (이미지 + PDF, sharp, StorageService), MediaUsage 참조 추적·삭제 보호 | M3 |
| BE-07 | 캐시 갱신 outbox(`RevalidateEvent` + 작업자), 이벤트별 태그, 예약 발행 1분 cron(`JobState`), 실패 배너 API | M3 |
| BE-08 | Profile/TechStack/Experience/Project 공개 + 관리자 API | M4 |
| BE-10 | E2E 테스트, 운영용 Dockerfile 작성·CI 빌드 검증, 헬스체크 | M5 |
| BE-12 | (보류) 배포 스크립트, 운영 구성, 백업 자동화 — 배포 인프라 결정(개요 D6) 후 M-Deploy에서 계획 | M-Deploy |
| BE-09 | Reactions (views/likes, visitor 쿠키, cron 정리), `PostViewDaily` 집계, Admin Stats. 기능 스위치 `FEATURE_REACTIONS`가 꺼져 있으면 관련 라우트가 404 | M6 |
| BE-11 | AI 자동 작성 MCP 서버 (`McpModule`, MCP 토큰, Tools/Prompts, 시크릿 스캐너, 스키마 변경) — [03_ai_authoring_mcp_plan.md §3, §4, §6, §9](./03_ai_authoring_mcp_plan.md) | M7 |

> **M7 대비 설계 메모**: 글/프로젝트/경력의 생성·수정 로직은 Controller가 아니라 Service에 두어, 이후 MCP Tool handler가 같은 Service를 그대로 호출할 수 있게 한다.
