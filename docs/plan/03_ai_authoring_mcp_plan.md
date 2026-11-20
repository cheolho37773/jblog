# jblog AI 자동 작성 기획서 (MCP 서버)

> 버전 v0.1 · 작성일 2026-11-20 · 마일스톤 **M7** (MVP 이후)
> 관련: [개요](./00_overview.md) · [백엔드](./01_backend_plan.md) · [프론트엔드](./02_frontend_plan.md)

---

## 1. 개요

jblog가 **MCP(Model Context Protocol) 서버**를 제공한다. 사용자는 이미 쓰고 있는 AI 클라이언트(**Claude Code, Claude Desktop, Codex CLI**)를 여기에 연결해 블로그 글과 포트폴리오 콘텐츠의 **초안**을 자동으로 작성한다.

```
┌──────── 사용자 PC ────────┐
│ Claude Code / Codex CLI    │  ① 로컬 레포·git log·메모 읽기 (AI 클라이언트의 자체 능력)
│ Claude Desktop             │  ② 글 작성
└────────────┬───────────────┘
             │ MCP Streamable HTTP  (Authorization: Bearer <MCP 토큰>)
             ▼
┌──────── VPS ──────────────────────────────────────────────┐
│ Nginx /mcp ──▶ NestJS McpModule ──▶ 기존 Service ──▶ PostgreSQL │  ③ DRAFT로 저장
└───────────────────────────────────────────────────────────┘
             │
             ▼
   관리자 /admin/ai-inbox  ④ 검토 → 수정 → 직접 발행
```

### 확정된 결정사항

| # | 항목 | 결정 |
|---|---|---|
| A1 | 연결 방식 | jblog가 MCP 서버를 제공하고 외부 AI 클라이언트가 접속 (에디터 내장 AI는 하지 않음) |
| A2 | AI 권한 | **초안까지만**. 발행/삭제/공개 콘텐츠 수정 도구는 아예 제공하지 않음 |
| A3 | 작성 대상 | 주제 기반 블로그 글 · 레포 분석 → 프로젝트 소개 · 커밋/PR → 개발일지/회고 · 프로필/경력 정리 |
| A4 | 일정 | M7 (M3~M4의 글/포트폴리오 API 안정화 이후) |

### 이 방식을 고른 이유

- **비용**: 추론은 사용자의 AI 클라이언트(기존 구독)에서 일어난다. jblog 서버는 LLM을 호출하지 않으므로 API 키와 종량제 비용이 없다.
- **컨텍스트**: 레포 코드, `git log`, PR 이력은 사용자 PC에 있다. 이를 읽는 일은 Claude Code/Codex가 원래 잘하므로 jblog는 **저장 도구만** 제공하면 된다.
- **클라이언트 중립**: MCP 표준을 따르므로 Claude든 Codex든 같은 서버를 쓴다.

---

## 2. 사용 시나리오

| # | 사용자가 AI에게 하는 말 (예시) | AI 동작 | jblog 결과 |
|---|---|---|---|
| S1 주제 글 | "NestJS에서 Refresh 토큰 회전 구현한 경험으로 블로그 글 써줘" | `get_site_context`로 카테고리/문체 가이드 확인 → 작성 → `create_post_draft` | Post(DRAFT, source=AI_MCP) |
| S2 프로젝트 | (레포 폴더에서) "이 레포 분석해서 포트폴리오 프로젝트로 올려줘" | README·의존성·구조·내 커밋 분석 → 기술스택을 기존 목록과 매칭 → 스크린샷 업로드 → `create_project_draft` | Project(isPublished=false) |
| S3 개발일지 | "11월 1일~15일 커밋이랑 머지된 PR로 개발일지 써줘" | `git log --since --until --author`, `gh pr list --state merged` → 요약 → `create_post_draft`(category: 회고) | Post(DRAFT) |
| S4 프로필/경력 | "내 이력서(resume.pdf) 보고 About 페이지 채워줘" | 이력서 파싱 → `propose_profile_update`, `create_experience_draft` × N | ProfileProposal(PENDING), Experience(isPublished=false) |
| S5 초안 수정 | "방금 쓴 초안에서 코드 예제 더 넣어줘" | `get_post` → 수정 → `update_post_draft` | 같은 DRAFT 갱신 (발행된 글은 거부) |

---

## 3. MCP 서버 설계

### 3.1 구현 위치 / 전송 방식

| 항목 | 결정 |
|---|---|
| 위치 | **NestJS 내부 모듈 `McpModule`** (별도 서비스 없음). 기존 Service를 직접 호출해 검증과 비즈니스 로직을 재사용한다 |
| SDK | 공식 `@modelcontextprotocol/sdk` (TypeScript) — `McpServer` + `StreamableHTTPServerTransport` |
| 전송 | **Streamable HTTP**, `POST /mcp` 단일 엔드포인트, **stateless 모드** (세션 저장소 불필요) |
| 엔드포인트 | 운영 `https://<도메인>/mcp` (Nginx → api:4000), 로컬 `http://localhost:4000/mcp` |
| 입력 스키마 | Zod (SDK 기본). 기존 DTO 제약(길이, slug 패턴)과 동일하게 맞춘다 |

### 3.2 Tools

모든 쓰기 도구는 **DRAFT/비공개 상태로만** 저장한다. 공개 상태의 데이터는 읽기만 가능하다.

| Tool | 필요 scope | 입력 | 동작 / 반환 |
|---|---|---|---|
| `get_site_context` | `content:read` | — | 프로필 요약, 카테고리, 태그 Top 50, 기술스택(iconKey 포함), **작성 가이드**(§3.4) 반환 |
| `list_posts` | `content:read` | `status?`, `q?`, `limit≤20` | 글 요약 목록 (중복 주제 확인, 내부 링크용) |
| `get_post` | `content:read` | `id` 또는 `slug` | 본문 포함 상세. 문체 참고와 초안 수정에 사용 |
| `create_post_draft` | `draft:write` | `title`, `contentMd`, `excerpt?`, `categorySlug?`, `tags[]`, `coverImageUrl?`, `seoDescription?` | DRAFT 생성 → `{ id, slug, adminUrl, previewUrl }` |
| `update_post_draft` | `draft:write` | `id`, `expectedVersion`, 위 필드 일부 | **status=DRAFT, source=AI_MCP, `aiEditable=true`인 글만** 수정 가능 (§4.4). 조건 불충족 시 `FORBIDDEN_NOT_AI_DRAFT` / `HUMAN_EDITED`, 버전 불일치 시 `VERSION_CONFLICT` + 최신 버전 번호 |
| `upload_image` | `media:write` | `filename`, `base64`(≤5MB), `alt` | 기존 Media 파이프라인(MIME/매직바이트 검사, WebP 변환) → `{ url, width, height }`. 업로드 파일은 **비공개 미디어**로 시작한다 (§4.3). **원격 URL 가져오기(`sourceUrl`)는 제공하지 않는다** — 서버가 임의 URL에 접속하는 SSRF 위험을 없애기 위해서다. 웹 이미지가 필요하면 AI 클라이언트가 내려받아 base64로 올린다 |
| `list_projects` / `get_project` | `content:read` | | |
| `create_project_draft` | `portfolio:draft` | `title`, `summary`, `contentMd`, `thumbnailUrl?`, `role?`, `startedOn?`, `endedOn?`, `githubUrl?`, `demoUrl?`, `techStackSlugs[]`, `newTechStacks?[]` | `isPublished=false`로 생성. `thumbnailUrl`은 비워 둘 수 있다 (공개할 때 관리자가 지정, 없으면 공개 불가 — 백엔드 Project 모델). 기술스택 목록에 없는 항목은 `newTechStacks`로 제안 → 관리자 승인 시 생성 |
| `update_project_draft` | `portfolio:draft` | `id`, `expectedVersion`, 일부 필드 | 비공개 + AI가 만든 + `aiEditable=true`인 프로젝트만 |
| `create_experience_draft` | `portfolio:draft` | `company`, `role`, `startedOn`, `endedOn?`, `description` | `isPublished=false` |
| `propose_profile_update` | `portfolio:draft` | `title?`, `headline?`, `intro?`, `bio?`, `socialLinks?` | Profile은 단일 행이라 직접 수정하지 않는다. **ProfileProposal(PENDING)** 을 만들고, 관리자가 diff를 보고 승인/거절한다 |

> 제공하지 않는 도구: publish, delete, 발행된 글 수정, 카테고리 생성/삭제, 토큰/설정 관련 전부.

### 3.3 Prompts (작성 워크플로 템플릿)

MCP **Prompts**로 시나리오별 작업 지시서를 제공한다. 클라이언트에서 슬래시 명령처럼 고를 수 있다 (예: Claude Code의 `/mcp__jblog__project_from_repo`). 어느 AI를 쓰든 결과물의 구조와 품질이 같아지도록 하는 장치다.

| Prompt | 인자 | 지시 내용 (요약) |
|---|---|---|
| `blog_post_from_topic` | `topic`, `notes?`, `category?` | 사이트 컨텍스트 조회 → 기존 글 중복 확인 → 구조(도입-문제-해결-코드-정리) → 코드블록에 언어/파일명 → 초안 저장 |
| `project_from_repo` | `repoPath?`, `role?` | README·manifest(package.json, build.gradle 등)·디렉터리 구조·`git log --author=<me>` 분석 → 기술스택 slug 매칭 → 섹션(개요/주요 기능/기술 선택 이유/내가 맡은 부분/트러블슈팅/성과/회고) → 대표 스크린샷 업로드 → 프로젝트 초안 |
| `devlog_from_git` | `since`, `until`, `repoPath?` | `git log`(+ `gh pr list --state merged`) 수집 → 주제별 묶음 → 개발일지/회고 초안 (카테고리 Retrospect) |
| `profile_from_resume` | `resumePath` 또는 텍스트 | 이력서 파싱 → 프로필 제안 + 경력 초안 N개 (기간 형식 `YYYY-MM-DD`) |

모든 Prompt에는 공통 규칙(§3.4)을 덧붙인다.

### 3.4 작성 가이드 (서버가 제공, 관리자 화면에서 편집 가능)

`get_site_context`와 모든 Prompt에 포함되는 지침이다. `SiteSetting.aiWritingGuide`(Markdown)에 저장한다.

기본값:
- 언어: 한국어, 문체 "~다/~한다" 평서체. 기술 용어는 원어 그대로 쓴다.
- 지원 Markdown: GFM, ` ```ts title="file.ts" `, `> [!NOTE]` 콜아웃, 이미지 캡션 `![alt](url "caption")`. H1은 쓰지 않는다 (제목은 별도 필드).
- 분량: 블로그 1,500~4,000자, 프로젝트 상세 1,000~3,000자. `excerpt`는 160자 이내.
- **보안**: `.env`, API 키, 토큰, 비밀번호, 사내 도메인/IP, 고객 정보, 비공개 레포의 민감 코드는 포함하지 않는다. 회사 프로젝트는 일반화해서 서술한다.
- **사실성**: 레포/이력서에서 확인되지 않은 수치(성능 향상 %, 사용자 수)는 지어내지 말고 `TODO(확인 필요)`로 남긴다.
- 이미지: 로컬 파일은 `upload_image`로 올린 뒤 반환된 URL만 쓴다.

---

## 4. 인증 & 보안

### 4.1 MCP 토큰 (Personal Access Token)

| 항목 | 설계 |
|---|---|
| 발급 | `/admin/settings/mcp` 에서 생성: 이름(예: "MacBook Claude Code"), scope 선택, 만료(30/90일/무기한) |
| 형식 | `jbl_mcp_` + 랜덤 32바이트(base62). 생성 시 **한 번만** 원문을 보여준다. DB에는 SHA-256 해시만 저장 |
| scope | `content:read`, `draft:write`, `media:write`, `portfolio:draft`. **publish scope는 존재하지 않는다** |
| 전달 | `Authorization: Bearer <token>` |
| 관리 | 마지막 사용 시각/클라이언트 표시, 즉시 폐기(revoke) |
| 분리 | MCP 토큰은 `/mcp`에서만 유효하다. 관리자 쿠키 JWT로는 `/mcp`를 쓸 수 없고, MCP 토큰으로는 `/api/admin/*`를 쓸 수 없다 |
| 발급 주체 | GitHub OAuth로 로그인한 **허용 목록의 본인만** 발급할 수 있다. 토큰에 발급자(`McpToken.userId` → `User`)를 저장하고, 검증할 때마다 `User.githubId`가 아직 `ADMIN_GITHUB_ID`와 일치하는지 확인한다. 그래서 허용 목록이 바뀌면 기존 토큰은 모두 무효가 된다 ([04 §1.2](./04_access_control_and_content_protection.md)) |

> OAuth 2.1(MCP 인증 스펙) 지원은 P2로 미룬다. 1인 사용자 환경에서는 PAT로 충분하다. Claude Desktop의 원격 커넥터처럼 OAuth를 요구하는 클라이언트는 우선 §5의 `mcp-remote` 브리지로 연결한다.

### 4.2 안전장치

| 위험 | 대응 |
|---|---|
| 검토 없이 공개 | 발행 도구 미제공. 모든 결과는 DRAFT/비공개/Proposal |
| 사람이 쓴 글 훼손 | `update_*`는 `source=AI_MCP` + DRAFT/비공개 + `aiEditable=true`인 대상만 허용. 사람이 관리자에서 한 번이라도 저장하면 `aiEditable=false` (§4.4) |
| 비밀정보 유출 | 저장 전 **시크릿 스캐너**(정규식: AWS Key, GitHub/Slack/OpenAI/Anthropic 토큰 패턴, `-----BEGIN .* PRIVATE KEY-----`, `password\s*=`). 탐지되면 저장은 하되 `secretWarning=true`로 표시하고, 해당 플래그가 있으면 관리자 발행 시 차단 다이얼로그를 띄운다. 도구 응답에도 경고를 넣어 AI가 스스로 고치도록 유도한다 |
| 남용/폭주 | Throttle: 토큰당 60 req/분, 쓰기 도구 20회/시간. `contentMd` ≤ 200KB, 이미지 ≤ 5MB |
| 프롬프트 인젝션 (분석 대상 레포 안의 악성 지시) | 서버 권한이 초안 쓰기로 한정되어 있어 피해 범위가 작다. 관리자 검토 단계에서 최종 차단 |
| 감사 | `AiActivityLog`에 모든 도구 호출(토큰, 도구명, 대상 ID, 결과, 시각)을 기록하고 관리자 화면에서 조회한다 |
| SSRF | 원격 URL 가져오기 도구를 제공하지 않는다. 서버가 외부로 요청을 보내는 MCP 도구는 하나도 없다 |
| 초안 이미지 노출 | §4.3 비공개 미디어 |

### 4.3 비공개 미디어 (M7 선행 과제)

AI가 올린 스크린샷에는 비공개 정보가 섞일 수 있다. 그래서 **M7 착수 전에** 미디어를 공개/비공개로 나눈다. URL은 바꾸지 않는다.

| 항목 | 설계 |
|---|---|
| 상태 | `Media.isPublic` (기본 `false`). 관리자가 직접 올린 미디어도 같은 규칙을 따른다 |
| 공개 여부 정의 | `Media.isPublic`은 저장값이지만 **파생값**으로 취급한다: "지금 방문자에게 보이는 콘텐츠 중 하나라도 이 미디어를 참조하는가". 보이는 콘텐츠 = 글 `status=PUBLISHED && publishedAt <= now()` (작업본 제외), 프로젝트·경력 `isPublished=true`, 프로필. 예약 글(미래 `publishedAt`)과 작업본은 **보이지 않는 콘텐츠**다 |
| 재계산 시점 | 아래 "공개 여부 재계산" 표의 이벤트마다, 영향받는 미디어(변경 전·후 참조의 합집합)에 대해 **같은 트랜잭션에서** 다시 계산한다 |
| 서빙 | Nginx `location /uploads/` → `auth_request /internal/media-auth` (아래 판정 흐름). 인증 서브요청은 **200(허용) 또는 401(거부)만** 반환한다. Nginx `auth_request`는 2xx를 허용, 401·403을 거부로 처리하고 그 밖의 코드는 서버 오류로 취급하기 때문이다. 바깥 응답은 `error_page 401 403 =404`로 **404로 변환**해 비공개 파일의 존재를 숨긴다 |
| 인증 결과 캐시 | **관리자 인증 결과는 어디에도 캐시하지 않는다.** Nginx에서 `auth_request` 결과 캐시를 쓰지 않는다. 캐시하는 것은 **"이 미디어가 공개인가"(`isPublic`)뿐**이며, API 프로세스 메모리에 미디어 경로 기준으로 60초 보관한다 (요청자와 무관한 값이므로 권한이 섞이지 않는다). 같은 프로세스에서 `isPublic`이 바뀌면 즉시 지운다 |
| 판정 흐름 | ① `isPublic` 조회(메모리 캐시) → true면 200 ② false면 **매 요청마다** `jb_at` 서명·만료 검증 + `tokenVersion` DB 확인 → 유효하면 200 ③ 그 외 401 |
| 캐시 헤더 | 공개 미디어 `public, max-age=31536000, immutable` / 비공개 미디어 `private, no-store` (Nginx가 `auth_request_set`으로 받은 공개 여부에 따라 헤더를 붙인다) |
| 이미지 최적화 | 공개 미디어만 Next.js 이미지 최적화를 쓴다. **비공개 미디어는 `unoptimized`** 로 렌더링해 브라우저가 관리자 쿠키를 붙여 원본을 직접 요청한다 (최적화기는 원본 요청에 쿠키를 전달하지 않으므로, 최적화를 거치면 관리자 프리뷰에서 비공개 이미지가 깨진다) |
| 미리보기 | 관리자 미리보기와 에디터 프리뷰는 위 방식으로 비공개 이미지를 볼 수 있다 |

**공개 여부 재계산**

| 이벤트 | 재계산 대상 미디어 | 결과 예 |
|---|---|---|
| 즉시 발행 | 그 글이 참조하는 미디어 | 비공개 → 공개 |
| **예약 등록** | 없음 (예약 글은 아직 보이지 않음) | 예약 등록만으로는 공개되지 않는다 |
| **예약 시각 도달** (1분 주기 작업) | 시각이 된 글이 참조하는 미디어. `RevalidateEvent` 생성과 **같은 트랜잭션** | 비공개 → 공개 |
| 수정사항 발행 (본문 교체) | 교체 전 참조 ∪ 교체 후 참조 | 새로 넣은 이미지는 공개, **빠진 이미지는 다른 공개 참조가 없으면 비공개로 복귀** |
| 비공개 전환, 삭제 | 그 글이 참조하던 미디어 | 다른 공개 참조가 없으면 비공개 |
| 프로젝트·경력 공개/비공개, 프로필 수정 | 해당 콘텐츠의 참조 전·후 | 같은 규칙 |
| 미디어 긴급 교체 | 교체 전·후 미디어 | 이전 파일은 참조 0 → 비공개 후 삭제 |

- 같은 미디어를 참조하는 콘텐츠들이 동시에 바뀌어도 결과가 맞도록, 재계산 대상 `Media` 행을 ID 순서로 잠근 뒤 참조를 다시 센다 (교착 방지, 직렬화 실패 시 최대 3회 재시도). 필수 동시 실행 시나리오는 [백엔드 §5.8](./01_backend_plan.md#58-동시-실행-보장과-검증-시나리오).
- 계산은 `MediaUsage`와 소유 콘텐츠의 상태를 조인해 한 번의 쿼리로 한다. 결과가 바뀐 미디어만 갱신하고, API 프로세스의 공개 여부 메모리 캐시에서 해당 항목을 지운다.
- 하루 1회 전체 재계산 작업으로 어긋난 값이 없는지 확인한다 (차이가 있으면 로그 경고 후 교정).

**공개 철회의 범위 (정의)**

공개 미디어를 비공개로 되돌리는 것은 **"앞으로의 원본 접근을 막는다"** 는 뜻이다. 이미 퍼진 사본은 회수를 보장하지 않는다.

| 대상 | 철회 후 상태 |
|---|---|
| 서버 원본 (`/uploads/...`) | 메모리 캐시 만료 후(최대 60초) 비로그인 요청은 404 |
| 방문자 브라우저 캐시 | 1년 `immutable`로 이미 받은 사본은 남는다 (회수 불가) |
| Next.js 최적화 이미지 캐시 (`/_next/image`) | 해당 원본의 최적화 사본이 캐시 기간 동안 남을 수 있다 |
| 외부 (검색엔진 이미지, 스크린샷 등) | 회수 불가 |

**민감 이미지 유출 대응 절차** (실수로 공개된 이미지에 비밀정보가 있는 경우)
1. 관리자 미디어 화면의 **[긴급 교체]**: 수정본 이미지를 **새 UUID 파일**로 올리고, 이 미디어를 참조하는 모든 콘텐츠의 URL을 새 파일로 바꾼다 (캐시 이벤트 생성)
2. 원본 파일을 **디스크에서 삭제**한다 (참조가 없어졌으므로 삭제 보호에 걸리지 않음)
3. web 컨테이너의 Next.js 이미지 캐시 디렉터리(`.next/cache/images`)를 비우는 관리 명령을 실행한다
4. 노출된 비밀정보 자체(API 키 등)는 **즉시 폐기·교체**한다. 이미지 회수보다 이 단계가 우선이다

### 4.4 사람 편집과 AI 편집의 경계

| 상황 | 동작 |
|---|---|
| AI가 만든 초안을 사람이 관리자에서 저장 | `aiEditable=false`. 이후 AI의 `update_*`는 `HUMAN_EDITED`로 거부된다. AI에게 다시 맡기려면 관리자 화면의 [AI 편집 허용] 토글을 켠다 |
| AI와 사람이 거의 동시에 저장 | 양쪽 모두 `expectedVersion`을 보내므로 늦게 저장한 쪽이 `VERSION_CONFLICT`를 받는다. 덮어쓰기는 일어나지 않는다 |
| AI가 사람의 글을 개선하고 싶을 때 | 기존 글 수정 대신 `create_post_draft`로 새 초안을 만든다 (P2: 개정 초안 기능) |

---

## 5. 클라이언트 연결 방법 (사용자 가이드 초안)

관리자 화면 `/admin/settings/mcp`에 클라이언트별 설정 스니펫을 복사 버튼과 함께 보여준다.

**Claude Code**
```bash
claude mcp add --transport http jblog https://<도메인>/mcp \
  --header "Authorization: Bearer $JBLOG_MCP_TOKEN"
# 로컬 개발: http://localhost:4000/mcp
```

**Codex CLI** (`~/.codex/config.toml`)
```toml
[mcp_servers.jblog]
url = "https://<도메인>/mcp"
bearer_token_env_var = "JBLOG_MCP_TOKEN"
```

**Claude Desktop** (`claude_desktop_config.json`, stdio↔HTTP 브리지)
```json
{
  "mcpServers": {
    "jblog": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<도메인>/mcp", "--header", "Authorization: Bearer ${JBLOG_MCP_TOKEN}"],
      "env": { "JBLOG_MCP_TOKEN": "jbl_mcp_..." }
    }
  }
}
```

> 클라이언트별 설정 키는 버전에 따라 바뀔 수 있다. M7 착수 시 각 클라이언트의 최신 문서로 확인하고 이 섹션을 갱신한다.

---

## 6. 데이터 모델 변경

```prisma
enum ContentSource { MANUAL AI_MCP }
enum ProposalStatus { PENDING APPROVED REJECTED }

model Post {
  // ... 기존 필드 (version은 MVP부터 존재)
  source          ContentSource @default(MANUAL)
  aiTokenId       String?       @db.Uuid      // 작성한 MCP 토큰
  aiEditable      Boolean       @default(false) // AI 생성 시 true, 사람이 저장하면 false (§4.4)
  aiDisclosure    Boolean       @default(false) // 이 글의 공개 페이지에 "AI 보조 작성" 표기 여부. 발행·수정사항 발행 때 다이얼로그 토글 값으로 저장
  secretWarning   Boolean       @default(false)
}

model Project {
  // ... 기존 필드
  version         Int           @default(1)   // 낙관적 잠금
  source          ContentSource @default(MANUAL)
  aiTokenId       String?       @db.Uuid
  aiEditable      Boolean       @default(false)
  secretWarning   Boolean       @default(false)
  proposedTechStacks Json?                    // 승인 대기 중인 신규 기술스택 [{name, iconKey}]
}

model Media {
  // ... 기존 필드
  isPublic        Boolean       @default(false) // §4.3. M7 전 마이그레이션 시 기존 미디어 중 공개 콘텐츠가 참조하는 것은 true로 채움
}

model Experience {
  // ... 기존 필드
  isPublished     Boolean       @default(true) // AI 생성분은 false
  source          ContentSource @default(MANUAL)
}

model McpToken {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @db.Uuid               // 발급자 (검증 시 허용 목록 재확인 기준)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  tokenHash   String    @unique
  prefix      String                          // "jbl_mcp_ab12" (목록 식별용)
  scopes      String[]
  expiresAt   DateTime?
  lastUsedAt  DateTime?
  lastClient  String?                         // MCP initialize의 clientInfo.name
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())
}

model ProfileProposal {
  id         Int            @id @default(autoincrement())
  changes    Json                              // 바뀌는 필드만
  status     ProposalStatus @default(PENDING)
  aiTokenId  String?        @db.Uuid
  createdAt  DateTime       @default(now())
  decidedAt  DateTime?
}

model AiActivityLog {
  id         BigInt   @id @default(autoincrement())
  tokenId    String   @db.Uuid
  tool       String
  targetType String?                          // post | project | experience | profile | media
  targetId   String?
  success    Boolean
  errorCode  String?
  createdAt  DateTime @default(now())
  @@index([tokenId, createdAt])
}

model SiteSetting {                              // 단일 행
  id             Int     @id @default(1)
  aiWritingGuide String  @db.Text
  defaultAiDisclosure Boolean @default(false)    // 발행 다이얼로그의 "AI 보조 작성 표기" 토글 초기값 (글별 저장값은 Post.aiDisclosure)
}
```

---

## 7. 관리자 화면 추가 (프론트엔드)

| 화면 | 기능 |
|---|---|
| **AI 초안함** `/admin/ai-inbox` | AI가 만든 글/프로젝트/경력 초안과 프로필 제안을 한곳에 모은다. 탭: 글 · 프로젝트 · 경력 · 프로필 제안. 항목마다 작성 클라이언트, 시각, ⚠️ secretWarning 배지. 액션: 편집(기존 에디터로 이동), 미리보기, 삭제 |
| 프로필 제안 검토 | 현재 값 ↔ 제안 값 **필드별 diff**. 필드 단위 체크 후 승인 → Profile 반영 |
| 신규 기술스택 제안 | 프로젝트 승인 화면에서 `proposedTechStacks`를 확인하고 생성 여부를 고른다 |
| 글/프로젝트 목록 | `AI` 배지, source 필터 |
| 발행 다이얼로그 | AI 초안일 때 체크리스트: "사실 관계 확인", "TODO(확인 필요) 제거", "비밀정보 없음" + "AI 보조 작성 표기" 토글(초기값 `SiteSetting.defaultAiDisclosure`, 저장 위치 `Post.aiDisclosure`). `TODO(확인 필요)`가 남아 있거나 secretWarning이 있으면 발행을 차단한다 |
| MCP 설정 `/admin/settings/mcp` | 토큰 생성/폐기/목록, 클라이언트별 연결 스니펫, 작성 가이드 편집기, 활동 로그 |
| 대시보드 | "검토 대기 AI 초안 N건" 카드 |

공개 페이지: `Post.aiDisclosure`가 켜진 글은 상세 하단에 "이 글은 AI의 도움을 받아 작성되었습니다" 문구를 보여준다 (muted 14/20).

---

## 8. 테스트

| 대상 | 방법 |
|---|---|
| 도구 단위 | Jest: 각 tool handler에 대해 scope 검사, DRAFT 강제, `update_*`의 소유권 검사, 시크릿 스캐너 |
| 프로토콜 | `@modelcontextprotocol/sdk`의 Client로 `/mcp`에 연결 → `tools/list`, `prompts/list`, `tools/call` E2E (Testcontainers DB) |
| 수동 검증 | **MCP Inspector**(`npx @modelcontextprotocol/inspector`)로 도구 스키마와 응답 확인. Claude Code와 Codex CLI 각각으로 S1~S5 시나리오 수행 |
| 보안 | 만료/폐기 토큰 거부, 발급자가 허용 목록에서 빠지면 토큰 거부, 관리자 JWT로 `/mcp` 거부, MCP 토큰으로 `/api/admin` 거부, 발행된 글 update 거부, 사람이 편집한 초안 update 거부(`HUMAN_EDITED`), 버전 불일치 409, 비공개 미디어 비로그인 404, **임의·만료·폐기된 쿠키로 비공개 미디어 요청 시 404 (관리자가 직전에 같은 파일을 본 직후에도)**, 관리자 프리뷰에서 비공개 이미지 표시, 긴급 교체 후 원본 404 |

---

## 9. 작업 분해 (M7)

| ID | 작업 | 영역 |
|---|---|---|
| AI-00 | **선행**: 비공개 미디어(`Media.isPublic`, 공개 전환 로직, Nginx `auth_request` 200/401 + 404 변환, 인증 결과 무캐시·공개 여부만 메모리 캐시, 비공개 이미지 `unoptimized`, [긴급 교체] 기능, 기존 미디어 마이그레이션) (§4.3) | BE/FE/Infra |
| AI-01 | 스키마 변경(source, aiEditable, Project.version, McpToken + `User.mcpTokens` 관계, ProfileProposal, AiActivityLog, SiteSetting) + 마이그레이션 | BE |
| AI-02 | MCP 토큰 발급/검증 Guard(발급자 허용 목록 재확인), scope 데코레이터, Throttle | BE |
| AI-03 | `McpModule`: Streamable HTTP(stateless) 엔드포인트, Nginx `/mcp` 라우팅 | BE/Infra |
| AI-04 | Tools 구현 (글/이미지/프로젝트/경력/프로필 제안/컨텍스트) + 활동 로그 | BE |
| AI-05 | Prompts 4종 + 작성 가이드 기본값 | BE |
| AI-06 | 시크릿 스캐너 | BE |
| AI-07 | 관리자: MCP 설정(토큰, 스니펫, 가이드, 로그) | FE |
| AI-08 | 관리자: AI 초안함, 프로필 diff 승인, 기술스택 제안 승인, 발행 체크리스트 | FE |
| AI-09 | AI 배지/필터, 대시보드 카드, 공개 페이지 AI 표기 | FE |
| AI-10 | 테스트(단위/프로토콜/보안) + Claude Code·Codex 실사용 검증 + 사용자 가이드 갱신 | QA |

---

## 10. 후속 고려 (P2)

- OAuth 2.1 지원 → Claude Desktop/claude.ai 원격 커넥터에 브리지 없이 직접 연결
- 발행된 글의 "개정 초안"(revision) 지원: AI가 기존 글 개선안을 별도 초안으로 제출 → diff 승인
- MCP Resources: 기존 글을 `jblog://posts/{slug}` 리소스로 노출해 문체 학습용 컨텍스트 제공
- 에디터 내장 AI(요약/태그/SEO 자동 생성)는 필요해지면 별도 검토한다 (Claude API, 종량제)
