---
name: api-security-checklist
description: "jblog 백엔드(apps/api, NestJS) 보안 체크리스트. 인증 방식별 가드, GitHub OAuth 허용 목록, JWT·refresh 회전, CSRF, 입력 검증, 내부 API·MCP 토큰, 업로드 검증, 보안 헤더, Rate limit, 민감 정보 관리를 점검한다. backend-dev가 인증·인가·보안 관련 코드를 구현하거나 점검할 때 사용한다."
---

# API Security Checklist — jblog 백엔드

기준 문서: `docs/plan/01_backend_plan.md` §5.6, `docs/plan/04_access_control_and_content_protection.md`, `docs/plan/03_ai_authoring_mcp_plan.md` §4, `docs/plan/00_overview.md` §6-b.

## 1. 인증 방식 (라우트마다 하나)

| 경로 | 데코레이터 | 확인 |
|---|---|---|
| 공개 조회·방문자 반응·health | `@Public()` | 상태 변경(views·like)에는 CSRF 헤더 검사 |
| OAuth 시작·콜백 | `@OAuthFlow()` | state 쿠키 대조, scope `read:user`만, GitHub access_token 저장 안 함 |
| refresh·logout | `@RefreshAuth()` | 원자적 회전, 10초 유예, 그 이후 재사용은 전체 폐기 + `tokenVersion+1` |
| 관리자 (`/api/admin/**`, `/auth/me`) | (기본값) | JWT 서명·만료 + `tokenVersion` + `ADMIN_GITHUB_ID` 허용 목록 |
| `/internal/**` | `@InternalOnly()` | `X-Internal-Key`. JWT 보지 않음 |
| `/mcp` (M7) | `@McpAuth()` | Bearer PAT 해시 대조 + scope + 발급자 허용 목록 |

- [ ] 데코레이터가 없는 라우트는 관리자 JWT를 요구한다 (기본 차단)
- [ ] 한 라우트에 인증 데코레이터가 둘 이상이면 부팅 실패
- [ ] 다른 방식의 자격 증명(예: `/internal`에 JWT)은 401

## 2. 세션·쿠키

- [ ] `jb_at` httpOnly·Secure·SameSite=Lax·Path=/, 15분
- [ ] `jb_rt` httpOnly·Secure·SameSite=Strict·Path=/api/auth, 7일, DB에는 SHA-256 해시만
- [ ] 회원가입·비밀번호 로그인·비밀번호 재설정 엔드포인트가 **없다**
- [ ] 로그인 시도는 모두 `LoginAudit`에 기록, 거부 메시지는 일반화

## 3. CSRF·CORS

- [ ] 쿠키 기반 상태 변경 요청에 `X-Requested-With: jblog` 필수
- [ ] 동일 오리진 구조라 CORS는 쓰지 않는다 (허용 오리진 설정 금지)

## 4. 입력 검증

- [ ] 모든 DTO에 `class-validator`, `ValidationPipe(whitelist, forbidNonWhitelisted, transform)`
- [ ] slug `^[a-z0-9-]+$`, 길이 제한, 페이지 크기 최대 50
- [ ] Raw SQL은 `$queryRaw` 파라미터 바인딩만 (문자열 결합 금지)
- [ ] 버전 조건부 UPDATE로 동시 수정 방지 (01 §5.8)

## 5. 업로드

- [ ] 크기 제한(이미지·PDF 10MB, MCP base64 5MB), MIME 화이트리스트 + **매직바이트** 검사
- [ ] 이미지는 sharp로 EXIF 제거·재인코딩, 파일명은 UUID
- [ ] 원격 URL 가져오기 기능 없음 (SSRF 방지)

## 6. 응답·헤더·제한

- [ ] helmet, 에러 응답에 스택 미노출
- [ ] 응답 유형별 `Cache-Control` (방문자별·관리자·내부는 `private, no-store`)
- [ ] Throttle: 로그인 10/분, 조회 30/분, 좋아요 10/분, MCP 60/분
- [ ] 운영에서 Swagger 비활성화

## 7. 민감 정보 (개요 §6-b)

- [ ] 비밀값·접속 정보 하드코딩 없음, `ConfigService`로만 읽음
- [ ] 필수 환경변수는 부팅 시 스키마 검증, 비밀값 기본값 없음
- [ ] pino redact: 쿠키, Authorization, 비밀번호·토큰 필드
- [ ] 새 환경변수는 `apps/api/.env.example`에 추가

## 8. OWASP API Top 10 빠른 점검

| 항목 | jblog에서 확인할 것 |
|---|---|
| 객체 수준 인가 | 관리자 1인이지만 `/admin` 외 경로에서 비공개 데이터(초안·작업본·비공개 미디어)가 새지 않는가 |
| 인증 결함 | §1·§2 |
| 과도한 데이터 노출 | 공개 API에 `contentMd`·내부 필드 없음 |
| 리소스 제한 | Throttle, 페이지 크기, 업로드 크기 |
| 기능 수준 인가 | MCP에 발행·삭제 도구 없음, scope 확인 |
| SSRF | 서버가 외부로 요청하는 기능은 GitHub OAuth 교환과 내부 revalidate뿐 |
| 보안 설정 오류 | Swagger, 헤더, 쿠키 속성 |
