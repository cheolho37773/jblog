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

### ① 테스트 선작성 (test-engineer)

- `frontend/src/lib/dev-allowed-origins.spec.ts` (10건): 없음·빈 문자열·공백만·쉼표만 → `[]`(4), `"a, b ,,c"` → `["a","b","c"]`, IP·호스트 이름 유지, `http://a`·`a/b` → 오류(메시지에 `JBLOG_DEV_ALLOWED_ORIGINS`·"호스트만"), 여러 값 중 하나만 잘못돼도 오류
- `frontend/test/next-config.spec.ts` (4건): 개발 단계 + `192.168.0.10` → `['192.168.0.10']`, 개발 단계 변수 없음 → 없음/빈 값, 운영 빌드 단계는 값이 있어도 없음, 개발 단계 `http://` 값 → 설정 로드 오류. 필수 환경변수는 `vi.stubEnv` 더미 값으로 채움
- 실패 확인: 모듈 `./dev-allowed-origins` 없음으로 첫 파일 전체 실패(의도한 이유), next-config는 4건 중 2건 실패(허용 목록 반영·오류 던지기 없음). 나머지 2건(변수 없음·운영 단계)은 현재 코드에서도 통과하는 회귀 방지 테스트다
- tsc: 구현 모듈이 없다는 TS2307 한 건만(구현 후 해소). eslint·prettier 통과

### ② 구현 (frontend-dev)

- `frontend/src/lib/dev-allowed-origins.ts`: `parseDevAllowedOrigins` 추가. 쉼표 분리, 공백·빈 항목 제거, `://`나 `/`가 있으면 변수 이름과 "호스트만" 안내가 담긴 오류
- `frontend/next.config.ts`: 개발 서버 단계에서만 `allowedDevOrigins`를 넣고, 값이 없으면 키를 넣지 않음. `env.schema`는 변경 없음
- 검사: `pnpm --filter @jblog/frontend test` 통과(760건, 종료 0), `pnpm verify` 통과(종료 0)
- 미실행: `pnpm test:e2e`·`pnpm test:visual`은 포트 4100을 개발자의 픽스처 서버(PID 27330, `next dev`와 함께 기동 중)가 점유해 시작 단계에서 종료 1(`already used`). 개발자 서버라 건드리지 않았다. 해당 서버를 내린 뒤 재실행이 필요하다


### Codex r1 대응 ① (test-engineer)

- `frontend/src/lib/dev-allowed-origins.spec.ts`에 14건 추가(10 → 24건): 받음 4(`192.168.0.10`, `my-mac.local`, `localhost`, `*.example.local`), 거부 9(`example.invalid:3000`, `192.168.0.10:3000`, `?x=1`, `#f`, 내부 공백, `*`만, `a.*.b`, `-bad.local`, `bad..local` — 메시지에 `JBLOG_DEV_ALLOWED_ORIGINS`), IPv6 2(`[::1]`, `::1` — 메시지에 변수 이름과 "IPv4나 호스트 이름")
- 현재 코드에서 실패 확인: 24건 중 11건 실패(거부 9 + IPv6 2, 오류를 던지지 않음), 받음 4건은 통과(회귀 방지). tsc·eslint·prettier 통과
