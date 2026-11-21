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
  - [x] `readEnvFile`이 임시 폴더의 더미 `.env`(예: `API_PORT=4123`, 따옴표·주석 줄 포함)를 객체로 읽는다, 없는 경로는 `{}`
  - [x] `mergeEnvSources`: 파일에만 있는 값이 들어가고, 같은 키는 프로세스 값이 이긴다, 프로세스 값이 `undefined`인 키는 파일 값이 남는다
- 성공(② 후, 오케스트레이터가 실행 확인)
  - [x] 스크래치 클론에서 `backend/.env`(자리표시자 값)만으로 `pnpm --filter @jblog/backend start` 기동, 셸 `API_PORT`를 주면 그 포트로 뜬다
  - [x] 파일 없이 셸 환경변수만으로 기동, 둘 다 없으면 기존처럼 변수 이름을 담아 실패
- 회귀
  - [x] backend 단위·e2e, 루트 lint·format:check·typecheck·test 통과

## 인계 노트

(단계별로 덧붙인다)

### ① 재현 테스트 (test-engineer)

- 파일: `backend/src/config/env.source.spec.ts` (구현 파일 수정 없음, 저장소 `.env*` 미사용 — `os.tmpdir()` 아래 `mkdtemp` 폴더의 더미 파일만, 테스트 후 삭제)
- `readEnvFile`: KEY=값 읽기(`API_PORT=4123`) / 따옴표 값 / 주석·빈 줄 무시 / 없는 경로는 `{}`
- `mergeEnvSources`: 파일 전용 키 포함 / 프로세스 전용 키 포함 / 같은 키는 프로세스 값 우선 / 프로세스 값 `undefined`면 파일 값 유지 / 입력 객체 불변
- 프로세스 값은 인자 객체로만 넘긴다(실제 `process.env` 미사용)
- 실패 확인: 신규 9건 실패, 기존 19건 통과. 원인은 `TypeError: (0 , env_source_1.mergeEnvSources) is not a function`(`readEnvFile`도 동일) 즉 두 함수가 아직 내보내지지 않아서이며 테스트 오류가 아님
- backend-dev 참고: 따옴표 제거·주석 처리는 `node:util` `parseEnv`의 동작에 기대고 있다

### ② 수정 (backend-dev)

- 변경 요약: `backend/src/config/env.source.ts`에 `readEnvFile`(없으면 `{}`, `node:util` `parseEnv`)·`mergeEnvSources`(프로세스 우선, `undefined`면 파일 값 유지, 입력 불변)를 추가하고 `readProcessEnv()`가 `backend/.env`와 `process.env`를 병합한다. `ConfigModule`의 `ignoreEnvFile: true`는 그대로, `createApp(rawEnv)` 계약 변경 없음
- 경로 기준: **모듈 위치**(`__dirname/../../.env`). 작업 폴더 기준이면 루트에서 `node backend/dist/main.js`로 실행할 때 다른 파일을 찾는다. `src/config`와 `dist/config`는 깊이가 같아 `nest start`·빌드 결과 모두 `backend/.env`를 가리키고, 패키지 폴더에서 실행하는 pnpm·turbo 경우도 같다
- 출력: ENOENT는 조용히 `{}`, 그 밖의 읽기 오류는 경로·오류 코드(cause)만 남긴 일반 메시지로 바꿔 던진다
- 검사: backend test 28건, test:e2e, build, 루트 lint·format:check·typecheck·test 결과는 아래 커밋 기준 통과(`.env`는 만들지 않음)

### 오케스트레이터 독립 확인 (실제 기동, Codex r1 대응)

- 대상: `f3719a5`, 스크래치 클론(`git clone --branch fix/M0-04-backend-env-file`) → `corepack pnpm install --frozen-lockfile` → `pnpm --filter @jblog/backend build`
- 실행: `backend/`에서 `env -i PATH=... node dist/main.js`(셸 환경변수를 비운 상태에서 지정한 값만 전달). `backend/.env`는 클론 안에만 자리표시자 값(`NODE_ENV=development`, 테스트용 포트)으로 만들고 확인 후 삭제했다

| 시나리오 | 결과 |
|---|---|
| 파일만(`.env`에 포트 A) | 포트 A에서 `/api/x` → 404 에러 형식 응답(기동 성공) |
| 파일 + 셸 `API_PORT`=B | 포트 B에서 응답, 포트 A는 응답 없음 → 셸 값 우선 |
| 파일 없음 + 셸 값만 | 셸 포트에서 응답(기동 성공) |
| 파일·셸 모두 없음 | 기동 실패, `환경변수가 올바르지 않습니다` 오류(종료) |

- 같은 클론에서 루트 `lint`·`format:check`·`typecheck`·`test`, backend `build` 통과
- 필수 검증: 재현·성공·회귀 전 항목 완료, 실패·보류 없음
