# M0-04-fix backend가 `backend/.env`를 읽지 않음 (Issue #15)

- 마일스톤: M0 · 이슈: #15 · 브랜치: `fix/M0-04-backend-env-file` (`dev`에서 생성)
- 실행 방식: **서브에이전트 조합(버그 수정)** — ① test-engineer(재현 테스트, 실패 확인) → ② backend-dev(수정)
- 선택 이유: 버그 수정은 재현 테스트 먼저(jblog-dev 2단계). 테스트와 구현 소유자가 다르다
- 난도·모델: 낮음 → Sonnet
- 현상: `backend/.env.example`은 "`backend/.env`로 복사해서 사용"을 안내하지만 `ConfigModule`이 `ignoreEnvFile: true`이고 `node dist/main.js`·`nest start`도 `.env`를 불러오지 않는다. 셸 환경변수로만 값을 넣을 수 있다 (M0-05 진행 중 발견)
- 참조: 개요 §6-b(파일 구성: `backend/.env`), 백엔드 §6(민감 정보), M0-04 지시서의 "테스트 대상 인터페이스"
- 쓰기 범위: test-engineer `backend/src/**/*.spec.ts` / backend-dev `backend/src/config/**`(spec 제외), 필요하면 `backend/package.json` 스크립트
- 실행 명령: `pnpm --filter @jblog/backend test` · `test:e2e` · `build` · 루트 `pnpm lint` · `format:check` · `typecheck` · `test`
- 비밀값: 없음. 테스트는 OS 임시 폴더에 더미 값만 담은 파일을 만들어 쓰고, 저장소의 `backend/.env`를 만들거나 읽지 않는다
- 중간 보고 조건: 에러 수정 3회 도달, 아래 규약과 다른 방법이 필요함
- 하지 말 것: `ConfigModule`이 파일을 직접 읽게 바꾸기(테스트의 `createApp(rawEnv)` 격리가 깨진다), `dotenv` 의존성 추가(Node 24 내장 `util.parseEnv`로 충분), `git config` 변경, 저장소 `.env*` 생성·읽기

## 동작 규약

| # | 항목 | 규약 |
|---|---|---|
| 1 | 위치 | `.env` 읽기는 `backend/src/config/env.source.ts`의 `readProcessEnv()` 안에서만 한다. `createApp(rawEnv)`의 계약은 그대로(테스트는 파일을 읽지 않음) |
| 2 | 파일 경로 | 백엔드 패키지 폴더(`backend/`)의 `.env`. `pnpm --filter @jblog/backend start`·`dev`·루트 `pnpm dev`(turbo, 작업 폴더 = 패키지 폴더)에서 같은 파일을 찾는다. 기준을 현재 작업 폴더로 할지 모듈 위치로 할지는 구현자가 정하고 이유를 남긴다 |
| 3 | 우선순위 | **셸(프로세스) 환경변수가 파일 값보다 우선**한다(Node `--env-file`과 같은 규칙). CI·컨테이너는 파일 없이 환경변수만 쓴다 |
| 4 | 파일 없음 | 파일이 없으면 조용히 건너뛴다(오류 아님). 필수 값이 없으면 기존처럼 `validateEnv`가 실패시킨다 |
| 5 | 순수 함수 | 테스트 가능하게 병합은 순수 함수로 둔다: `mergeEnvSources(fileEnv: Record<string, string>, processEnv: Record<string, string \| undefined>): Record<string, unknown>`, 파일 읽기는 `readEnvFile(path: string): Record<string, string>`(없으면 `{}`, 내용 파싱은 `node:util`의 `parseEnv`). 둘 다 `env.source.ts`에서 내보낸다 |
| 6 | 출력 | 파일 경로·값을 로그나 오류에 출력하지 않는다 |

## 필수 검증

- 재현(① 작성, 수정 전 실패)
  - [ ] `readEnvFile`이 임시 폴더의 더미 `.env`(예: `API_PORT=4123`, 따옴표·주석 줄 포함)를 객체로 읽는다, 없는 경로는 `{}`
  - [ ] `mergeEnvSources`: 파일에만 있는 값이 들어가고, 같은 키는 프로세스 값이 이긴다, 프로세스 값이 `undefined`인 키는 파일 값이 남는다
- 성공(② 후, 오케스트레이터가 실행 확인)
  - [ ] 스크래치 클론에서 `backend/.env`(자리표시자 값)만으로 `pnpm --filter @jblog/backend start` 기동, 셸 `API_PORT`를 주면 그 포트로 뜬다
  - [ ] 파일 없이 셸 환경변수만으로 기동, 둘 다 없으면 기존처럼 변수 이름을 담아 실패
- 회귀
  - [ ] backend 단위·e2e, 루트 lint·format:check·typecheck·test 통과

## 인계 노트

(단계별로 덧붙인다)
