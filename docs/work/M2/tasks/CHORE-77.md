# CHORE-77 개발 서버 휴대폰 접속 허용: `allowedDevOrigins`를 환경변수로 (Issue #77)

- 마일스톤: M2(부수 작업, 개발자 요청) · 이슈: #77 · 브랜치: `chore/dev-allowed-origins` (`dev` `978f6ac`에서 생성)
- 실행 방식: 서브에이전트 조합 — test-engineer(단위 선작성) → frontend-dev → test-engineer(검증)
- 난도·모델: 낮음 → Sonnet
- 배경: Next 16 개발 서버는 `localhost`가 아닌 주소의 개발 자원 요청(`/_next/*`, HMR)을 막는다. 휴대폰에서 같은 와이파이 IP로 접속하면 자바스크립트가 연결되지 않아 메뉴·테마 토글·복사 버튼이 동작하지 않는다(개발 서버 로그 `Blocked cross-origin request ... from "<IP>"`)
- 참조: 개요 §6(환경변수 목록, v0.13에 `JBLOG_DEV_ALLOWED_ORIGINS` 추가 — 오케스트레이터가 이 PR에 포함), Next.js `allowedDevOrigins` 설정
- 쓰기 범위: test-engineer `frontend/**/*.spec.ts(x)`, frontend-dev `frontend/**`(spec 제외)
- 하지 말 것: 운영 빌드 설정 변경, IP·호스트 값을 코드에 쓰기, `.env*` 읽기·쓰기(값은 개발자가 자기 `.env`에 넣는다)

## 규칙

| 항목 | 규칙 |
|---|---|
| 변수 | `JBLOG_DEV_ALLOWED_ORIGINS` — 쉼표로 구분한 호스트(예: `192.168.0.10,my-mac.local`). 앞뒤 공백과 빈 항목은 버린다. 비었거나 없으면 설정하지 않는다(Next 기본: localhost만) |
| 적용 단계 | `next.config.ts`에서 **개발 서버 단계(`PHASE_DEVELOPMENT_SERVER`)에서만** `allowedDevOrigins`에 넣는다. 빌드·운영에는 넣지 않는다 |
| 위치 | `JBLOG_DEV_PAGES`처럼 빌드·개발 전용 스위치라 `env.schema`(앱 런타임 설정)에 넣지 않는다. 쉼표 해석은 순수 함수(`frontend/src/lib/dev-allowed-origins.ts`의 `parseDevAllowedOrigins(raw?: string): string[]`)로 분리한다 |
| 값 형식 | 호스트만 받는다(Next 문서 형식). `http://`가 붙은 값이나 경로가 붙은 값은 무엇이 잘못인지 알 수 있는 오류로 개발 서버 시작을 멈춘다 |

## 필수 검증

- [ ] 단위: 없음·빈 문자열·공백만 → `[]`, `"a, b ,,c"` → `["a","b","c"]`, `http://a`·`a/b` → 오류
- [ ] 개발 단계 설정에만 `allowedDevOrigins`가 들어가고, 운영 단계 설정에는 없다(설정 함수 단위 — `createNextConfig(phase)`를 phase별로 불러 확인)
- [ ] 기존 단위·E2E·`pnpm verify`·시각 회귀 불변

## 인계 노트
