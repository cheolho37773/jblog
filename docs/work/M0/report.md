# M0 결과 보고

- 작성일: 2026-11-22
- 대상 커밋: `dev` = `8a4945e` (M0-08 Merge 직후). 이 보고서는 브랜치 `docs/M0-09-report`(이슈 #23)에서 작성
- 기간: 2026-11-21 ~ 2026-11-22 (로컬 시각 기준)
- 근거: 작업 지시서·인계 노트(`docs/work/M0/tasks/`), 검수 기록(`docs/reviews/`, `docs/plan/feedback/`), 체크리스트, `git log --oneline dev`
- 작성: docs-writer(본문), 오케스트레이터(저장, PR 번호·SHA 대조, §9 불일치 정리)
- 표기: 확인하지 못한 값은 "확인 안 함", 기록이 없는 값은 "기록 없음"으로 쓴다

## 1. 요약

- 목표: 빈 백엔드·프론트엔드 앱이 모노레포에서 로컬 검사와 CI를 통과하고, 협업 흐름을 한 바퀴 이상 시험한다 (`plan.md` §1)
- 결과: 계획 작업 9개 중 **8개 완료(M0-01~08)**, 추가 작업 M0-04-fix 완료, M0-09(이 보고서)는 진행 중. **실패한 작업은 없다**
- Codex 검수 21회(작업 9건 기준). 지적 12건(높음 2 · 중간 10 · 낮음 0). 모두 처리했고, 1건은 일부를 개발자 승인(G3)으로 수용했다. 마지막 회차는 모두 통과
- CI는 8개 잡(lint · test · integration · e2e · build · contract · docker · ownership-check)이고, `dev` 필수 상태 검사로 등록됐다 (2026-11-22)
- 보류 1건: M0-05 규약 5의 "비밀값 이름 공개 변수 정의 시 모듈 로드 실패"는 테스트로 만들 수 없어 단위 검증만 했다 (§2, §7)

## 2. 작업별 결과

### 2-1. 작업 표

| 작업 ID | 이슈 / PR | 결과 | Codex 회차 · 지적 수 | 에러 수정 횟수 (자체 / Codex / CI) |
|---|---|---|---|---|
| M0-01 검수 스크립트 보완 | #2 / #5 | 완료 | r1 통과 0건 · r2 통과 0건 (r2는 규약 6 stdin 차단 추가 뒤 재검수) | 기록 없음 / 0 / 해당 없음(CI 없음) |
| M0-02 모노레포·도구 | #6 / #8 | 완료 (D25·D26로 Merge 전 재작업 1회) | r1 중간 1 · r2 통과 · r3 중간 1 · r4 통과 | 기록 없음 / 2 (r1 1, r3 1) / 해당 없음 |
| M0-03 로컬 DB | #9 / #10 | 완료 | r1 중간 1 · r2 통과 | 1 (비밀정보 패턴) / 1 / 해당 없음 |
| M0-04 BE-01 Nest 기반 | #11 / #12 | 완료 | r1 높음 1 · 중간 1 · r2 통과 | 기록 없음 / 1 (2건을 한 번에 수정) / 해당 없음 |
| M0-05 FE-01 Next 기반 | #13 / #14 | 완료 | r1 중간 1 · r2 중간 1 · r3 통과 | 1 (ThemeToggle 하이드레이션) / 2 (r1 1, r2 1) / 해당 없음 |
| M0-04-fix `.env` 읽기 | #15 / #16 | 완료 | r1 중간 1 · r2 통과 | 기록 없음 / 1 (코드 변경 없음, 검증 기록 보완) / 해당 없음 |
| M0-06 BE-02 Prisma | #17 / #18 | 완료 | r1 통과 0건 | 기록 없음 (③ 단계 `format:check` 실패는 devops 설정으로 해소, 횟수 미기재) / 0 / 해당 없음 |
| M0-07 API 타입 파이프라인 | #19 / #20 | 완료 | r1 중간 2 · r2 통과 | 기록 없음 / 1 (2건을 한 번에 수정) / 해당 없음 |
| M0-08 CI | #21 / #22 | 완료 | r1 높음 1 · r2 중간 1 · r3 통과 | 1 (④ 발견 3건) / 2 (r1 코드 수정 1, r2 검증 보완 1) / 시험 브랜치 CI 실패 수정 기록 없음 |
| M0-09 협업 시험 마무리·report | #23 / (Merge 전) | 진행 중 (이 문서) | 검수 전 | 해당 없음 |

- 근거: 지적 수·등급은 `docs/reviews/M0-*/r*.codex.md`의 "지적 사항"에서 센 값이다. 에러 수정 횟수는 `r*.response.md`의 "에러 수정 횟수" 줄과 인계 노트에서 가져왔다. 대응 기록의 횟수는 누적 값인 경우가 있다 (M0-02 r3 · M0-05 r2 · M0-08 r2)
- M0-05 r2 지적 1건은 둘로 나눠 대응했다. Vitest 환경파일 로드는 수정(`3d189ca`), E2E의 로컬 환경파일 로드는 반박하고 문서화했다 (개발자 G3 수용, 2026-11-21). r3은 이 결정을 근거로 잔여 지적으로 세지 않았다
- 이슈 번호는 지시서 머리말, PR 번호는 `dev`의 squash 커밋 제목 `(#n)` 기준이다

### 2-2. dev 반영 SHA (`git log --oneline dev`로 대조함)

| 작업 | dev 반영 SHA (squash) | PR |
|---|---|---|
| M0-01 | `91b0924` | #5 |
| docs/M0-structure (지시서 없음) | `0157dda` | #7 |
| M0-02 | `5786db7` | #8 |
| M0-03 | `2bedcba` | #10 |
| M0-04 | `3743bfd` | #12 |
| M0-05 | `3a61346` | #14 |
| M0-04-fix | `91ff43a` | #16 |
| M0-06 | `506c2d8` | #18 |
| M0-07 | `ce6974c` | #20 |
| M0-08 | `8a4945e` | #22 |

### 2-3. 기획 검수 (작업 지시서가 없는 PR)

| 대상 | 회차 · 지적 수 | 결과 |
|---|---|---|
| M0 계획서 (`docs/reviews/M0-plan`) | r1 중간 3 · r2 통과 | 3건 수정 (M0-07 계약 작업화, M0-01 재현 테스트 배정, Playwright 배정) |
| 저장소 구조 변경 (`M0-structure`) | r1 중간 1 · r2 통과 · r3 통과 (r3은 D26 반영 뒤) | 1건 수정 (계약 생성물 PR 단위 허용 규칙) |

### 2-4. 완료 · 실패 · 보류

| 구분 | 항목 |
|---|---|
| 완료 | M0-01 ~ M0-08, M0-04-fix |
| 실패 | 없음 |
| 보류 | M0-05 규약 5 "비밀값 이름 공개 변수 정의 시 모듈 로드 실패": 현재 스키마에서 공개 키를 주입할 수 없어 테스트 불가. `findSecretLikePublicKeys` 단위로만 검증 (M0-05 ⑤ 독립 검증) |
| 진행 중 | M0-09 |

## 3. 만들어진 것

### 3-1. 도구·구조

| 영역 | 내용 | 근거 |
|---|---|---|
| 워크스페이스 | pnpm 12.21.0 workspace(`frontend`, `backend`), Turborepo 2.11.13, Node 24(`.nvmrc`), 공용 코드 패키지 없음 (D25) | M0-02 |
| 린트·서식 | ESLint 10.15.0 flat 설정 루트 1개, Prettier 3.10.1, TypeScript 6.0.3 | M0-02 |
| 로컬 ESLint 규칙 | `jblog/import-boundaries`(FE↔BE·기능 간·계층 import 금지), `jblog/denied-names`(금지 이름은 선언만 검사), 가독성 규칙(complexity 10, max-depth 3, max-params 3, no-explicit-any), 설정 모듈 밖 `process.env` 금지 | M0-02, M0-06 |
| 커밋 도구 | Husky 9.1.7, lint-staged 17.6.1, commitlint 21.2.4(scope에 WBS ID 허용, 영문 대소문자 규칙 해제), pre-commit `check-secrets.sh` | M0-02 |
| 검수 스크립트 | `scripts/codex-review.sh`: `CODEX_BIN`, `CODEX_REVIEW_TIMEOUT`(기본 480초, 시간 초과 시 종료 코드 124), `--plan` 회차 날짜 무관, stdin `/dev/null` | M0-01 |
| 로컬 DB | `infra/docker-compose.yml`: `postgres:17.12`, `127.0.0.1:5432`만 노출, 볼륨 `pgdata`, `pg_isready -h 127.0.0.1` healthcheck, 비밀번호 필수. 루트 `db:up`·`db:down`·`db:psql` | M0-03 |

### 3-2. 백엔드

| 항목 | 내용 | 근거 |
|---|---|---|
| 기반 | NestJS 12.5.1, 환경변수 검증(`NODE_ENV`, `API_PORT`, `DATABASE_URL` 필수·기본값 없음), pino(redact), helmet, ValidationPipe, Swagger(운영 비활성), 공통 에러 필터(5개 키) | M0-04, M0-06 |
| `.env` 읽기 | `backend/.env`를 읽고 셸 환경변수가 우선. `createApp(rawEnv)` 계약은 유지 | M0-04-fix |
| DB | Prisma 7.10.1, MVP 모델 21개·enum 3개, 초기 마이그레이션 `20261121000000_init`, `pg_trgm`, trgm GIN 인덱스 2개, `PostSlug` 부분 unique 인덱스, seed(Profile 1·카테고리 4·글 9) | M0-06 |
| health | `GET /api/health`(Terminus 12.2.0): 정상 200, DB 불가 503(에러 형식) | M0-06 |
| 계약 출력 | `pnpm --filter @jblog/backend openapi:generate` → `backend/openapi.json`(결정적 출력) | M0-07 |

### 3-3. 프론트엔드

| 항목 | 내용 | 근거 |
|---|---|---|
| 기반 | Next.js 16.4.6, React 19.3.1, Tailwind 4.3.5, next-themes 0.4.6, 폰트 5종 골격, Light/Dark 토큰 3개, `src/lib/env.ts`(Zod 4.6.7, 누락 시 빌드 실패) | M0-05 |
| 로컬 프록시 | 개발 서버에서만 `/api/*` rewrites | M0-05 |
| 타입 파이프라인 | `pnpm gen:api-types`(`--check` 지원) → `frontend/src/generated/api-types.ts`, `openapi-fetch` 0.17.0 기반 `lib/api/server.ts`·`client.ts` | M0-07 |
| 빌드 | `output: 'standalone'` | M0-08 |

### 3-4. CI · Docker

| 항목 | 내용 | 근거 |
|---|---|---|
| 워크플로 | `.github/workflows/ci.yml`: 작업 브랜치 push + `dev` 대상 PR. 잡 8개 `lint` · `test` · `integration` · `e2e` · `build` · `contract` · `docker` · `ownership-check`. `permissions: contents: read`, 외부 액션 SHA 고정, 러너 `ubuntu-24.04` | M0-08 |
| SHA 3종 | `scripts/ci/resolve-shas.sh`가 head · base · 검사 SHA를 실행 요약에 기록 | M0-08 |
| 소유권 판정 | `scripts/ownership/pr_ownership_check.py`(R1~R9), `roles.json`에 `pr_orchestrator_allow`·`pr_contract_openapi` 추가, 규칙 확대 경고 | M0-08 |
| 로컬 검사 | `pnpm verify`(lint · format · typecheck · test · api e2e · scripts 테스트 · build · contract), `pnpm verify:full`(+ 통합 · E2E · Docker 빌드) | M0-08 |
| Docker | `backend/Dockerfile`·`frontend/Dockerfile`·`.dockerignore`. 베이스 `node:24.22.3-alpine`, 비root, HEALTHCHECK. 이미지 크기(로컬 arm64): backend 약 793MB, frontend 약 294MB | M0-08 |
| 브랜치 보호 | `dev` Ruleset에 CI 8개 잡을 필수 상태 검사로 추가 (2026-11-22, GitHub Actions 앱 한정, 최신 `dev` 기준 필수) | 체크리스트 |

### 3-5. 테스트 수

각 인계 노트의 마지막 기록 기준이다. 이 보고서 작성 시점에 다시 실행하지 않았다.

| 영역 | 건수 | 근거 |
|---|---|---|
| 루트 `node --test` (ESLint 규칙 · api-types 스크립트) | 66 | M0-08 ③ `pnpm verify` (`aee8a05`) |
| backend 단위 | 39 | M0-06 ④, M0-08 ③ |
| backend e2e (DB 없음) | 34 | M0-07 Codex r1 대응, M0-08 ③ |
| backend 통합 (Testcontainers) | 27 | M0-06 ④, M0-08 ③ |
| frontend 단위 | 22 | M0-05, M0-08 ② |
| frontend E2E (Playwright) | 3 | M0-07 ③, M0-08 ② |
| Python `unittest` (검수 스크립트 15 + 소유권 판정 94) | 109 | M0-08 Codex r1 대응 |
| `pr_common_allow.py --self-test` | 12 | M0-08 ③ |
| 합계 (self-test 제외) | 300 | 위 7행의 합 |

## 4. 협업 흐름 시험 결과

`plan.md` §5의 6개 항목이다. 판정은 체크리스트·인계 노트·검수 기록의 기록을 따랐다.

| 시험 항목 | 확인 시점 | 결과 | 근거 |
|---|---|---|---|
| 이슈 → 브랜치 → 자체 검사 → Codex 최종 검수 → push → 개발자 PR·Merge → 이슈 자동 종료 | M0-01 | 확인됨. M0-01~08 모두 같은 흐름. CI 단계는 M0-08부터 | 체크리스트 M0 "협업 흐름 시험" 1행 |
| PR 본문 `Closes #n`으로 이슈 종료 | M0-01 | 확인됨 (이슈 #2, PR #5) | 계획서 §5, 체크리스트 |
| 서브에이전트 위임, 역할 기록, 소유권 훅 | M0-04 | 확인됨. M0-04~08에서 서브에이전트 조합 사용. 훅이 범위 밖 쓰기를 실제로 막은 사례: M0-08 ③에서 `.dockerignore`(지시서 범위에 있으나 규칙에 없음)가 막혀 `roles.json`을 보정함. backend-dev가 devops 소유 파일을 직접 고치지 않고 변경 요청으로 넘긴 사례: M0-06 ③ | M0-08·M0-06 인계 노트 |
| 검수 후 코드 커밋 시 재검수 후 push | 해당 상황이 처음 생긴 작업 | 확인됨. 코드 수정이 생긴 작업(M0-02, 03, 04, 05, 07, 08)은 모두 수정 뒤 재검수(r2 이상)를 받았고 통과한 회차에서 push. 자동 차단 장치가 아니라 절차 이행으로 확인한 것이다 | `docs/reviews/M0-*` |
| push 이벤트 CI 실행, SHA 3종 출력 | M0-08 | 확인됨. 시험 브랜치 `chore/M0-08-ci-trial` run 44914034172에서 8개 잡 통과. SHA 3종은 run 44916562916 | M0-08 인계 노트, 체크리스트 |
| 범위 밖 변경 시 `ownership-check` 실패 (시험 브랜치, Merge 안 함) | M0-08 | 확인됨. 실제 CI에서 R9(`backend/src/main.ts`) · R3(기존 `*.codex.md` 수정) · R6(`frontend/src/generated/**`) · R7(`backend/openapi.json`) · R5(잠금 파일만, run 44916305479) 실패. 시험 브랜치는 원격에서 삭제 | M0-08 인계 노트 |

- CI가 실패해 코드를 고친 사례: 인계 노트에 기록 없음. 체크리스트의 "CI 실패 수정 포함" 문구에 해당하는 사례가 있었는지는 확인 안 함
- 시험하지 않은 것: 개발자 Merge 이후 `dev`에서의 CI 실행 결과, 같은 브랜치에 push와 PR 이벤트가 둘 다 도는 실제 실행 시간

## 5. 발생한 문제와 대응

### 5-1. 환경·도구

| # | 작업 | 문제 | 원인 | 대응 |
|---|---|---|---|---|
| 1 | M0-01 | `codex exec`가 멈춤 | 열린 표준 입력을 계속 기다림. 처음 추정한 터미널 shim은 원인이 아니었음 | stdin을 `/dev/null`로 연결, 시간 제한(124), `CODEX_BIN`. 계획서 위험 표 정정 (M0-01 규약 6) |
| 2 | M0-03 | 커밋 3개가 훅 없이 들어감 | 세션 시작 때 읽은 예전 `CLAUDE.md` 안내(`.githooks`)를 따라 에이전트가 `core.hooksPath`를 바꿈 | 값을 `.husky/_`로 복구. 이후 위임 프롬프트에 "`git config` 변경 금지" 명시. 훅 재생에서 `infra/.env.example` 주석이 비밀정보 패턴에 걸려 문장 수정 |
| 3 | 공통 | 커밋 훅에서 pnpm 전환이 ENOEXEC로 실패 | `~/Library/pnpm`의 다른 pnpm을 먼저 잡아 pnpm 12 전환에서 실패 | `nvm use` 후 커밋, 또는 `corepack pnpm` 래퍼를 PATH 앞에 둠 |
| 4 | 공통 | 소유권 훅이 저장소 경로 밖 파일(worktree 등)을 검사하지 못함 | 훅은 저장소 안 경로만 판정 | CI `ownership-check`가 PR 단위로 보완 |
| 5 | M0-03·06·08 | 비밀정보 검사가 자리표시자 접속 URL(`이름:값@` 형태)을 거부 | 검사 패턴이 형태만 봄 | 예시는 문장이나 `{사용자}` 형태로 씀. M0-06 `backend/.env.example`은 `DATABASE_URL=`을 비우고 형식을 주석으로 설명 (`secret-scan:allow`는 쓰지 않음) |
| 6 | M0-02 | commitlint 기본 `subject-case`가 영문 대문자로 시작하는 제목을 거부 | 기본 규칙 | 커밋 제목의 영문 대소문자 규칙을 해제 (M0-02 커밋 `ce118cb`) |
| 7 | M0-02 | `.prettierignore`에 규약 외 경로 포함 | 범위 밖 파일의 기존 서식 유지 | M0-02에서 `.claude/`·`.github/`·`scripts/ownership/roles.json` 포함, M0-07에서 생성물(`backend/openapi.json`, `frontend/src/generated/`) 제외, M0-06에서 `backend/src/generated/` 제외 |
| 8 | M0-04~08 | 버전 호환 판단 필요 | TypeScript 6.0.3(typescript-eslint peer가 `<6.1`), `openapi-typescript` 7.13.0 peer는 TS 5(경고만, 생성물은 TS 6 검사 통과), Prisma 7.10.1(npm `latest`는 8.0.0-rc.34라 정식 최신 선택, `partialIndexes` 프리뷰 사용), Nest 12는 ESM 전용 | 각 인계 노트에 버전 표와 이유 기록. Jest는 `--experimental-vm-modules`로 실행 |
| 9 | M0-04·06 | pnpm 12가 설치 스크립트 미승인으로 `ERR_PNPM_IGNORED_BUILDS` | `allowBuilds` 필요 | 허용: `@prisma/engines`. 거부: `@scarf/scarf`, `@parcel/watcher`, `ssh2`, `cpu-features`, `protobufjs`, `prisma`, `esbuild`. 이유는 M0-04·06 인계 노트 |
| 10 | M0-05 | Turbo strict env 모드가 `API_INTERNAL_URL`을 걸러 루트 `pnpm build` 실패 (Codex r1) | 환경변수 허용 목록 누락 | `turbo.json`에 `@jblog/frontend#build` `env`, `dev` `passThroughEnv` 추가 |
| 11 | M0-05 | Vitest·E2E가 `frontend/.env*`를 자동으로 읽음 (Codex r2) | Vite·Next의 환경파일 자동 로드 | Vitest는 `envDir: false`. E2E는 개발자 G3 수용 후 README에 문서화. 같은 기준으로 M0-06 통합 헬퍼가 `backend/.env`를 함께 읽는 것도 수용 (M0-06 ④ 발견 1) |
| 12 | M0-05 | 다크 선택 후 새로고침에서 React #418 하이드레이션 오류 (⑤ 독립 검증이 발견) | 서버는 `resolvedTheme`이 없어 라이트, 클라이언트는 저장된 다크 | `useSyncExternalStore`로 마운트 여부를 알아내 마운트 전에는 라이트로 그림 |
| 13 | M0-05 | `next dev`가 `frontend/AGENTS.md`·`next-env.d.ts`를 생성 | 생성물 | `.gitignore`에 추가 |
| 14 | M0-06 | `format:check` 실패 (③ 단계) | 생성 클라이언트 `backend/src/generated/` 29개 파일 | devops가 `.gitignore`·`.prettierignore`·ESLint `ignores` 추가 (backend-dev는 범위 밖이라 변경 요청으로 전달) |
| 15 | M0-06 | 내장 `id-denylist`가 Prisma 인자 키 `data`에 걸림 | 규칙이 객체 키까지 검사 | 로컬 규칙 `jblog/denied-names`로 교체(선언만 검사). 개발자 승인, 협업 문서 v0.8.1 |
| 16 | M0-06 | `PostSlug` 부분 unique 설정 시 `findUnique({ where: { postId } })`가 `isCurrent` 조건 없이 이전 slug를 반환 | Prisma가 부분 unique의 `where`를 조회에 붙이지 않음 | 스키마 주석에 기록. 현재 slug는 `findFirst` + `isCurrent: true`로 조회 (§7로 이관) |
| 17 | M0-07 | `openapi.json`이 lint-staged의 Prettier 형식으로 바뀌어 재생성 때 차이 발생 | JSON 형식 차이 | `.prettierignore`에 추가 후 재생성 |
| 18 | M0-08 | R1이 `fix/M0-04-backend-env-file`을 `M0-04`로 판정 (① 판정 테스트가 발견) | 접두사 규칙만 사용 | 지시서 머리말 `브랜치:` 줄 정확 일치를 먼저 보도록 변경 (오케스트레이터 결정) |
| 19 | M0-08 | 판정 스크립트 구멍 3건 (④ 독립 검증) | merge 커밋 안의 보호 파일 수정 누락 / 지시서 없는 기획 PR의 피드백 파일이 R3 오탐 / PR이 자기 규칙을 넓힐 수 있음 | 각각 `--cc` 보충, 브랜치 `<나머지>`를 R3 검수 기록 ID로 허용, `roles.json` 변경·참여 역할 변경 시 경고 출력(실패 아님). Codex r1(높음)이 보조 브랜치 merge 경로 누락을 추가로 찾아 `--first-parent` 제거 |
| 20 | M0-08 | 과거 PR 재생에서 위반 2건 | M0-07의 `backend/test/openapi-contract.e2e-spec.ts`를 test-engineer가 썼으나 지시서 실행 방식에 test-engineer 없음 / `docs/M0-structure`의 `.gitignore` 변경 | 둘 다 정탐으로 판정 (이미 Merge된 작업이라 영향 없음). 지시서에 `참여 역할` 줄이 없는 M0-01~07은 브랜치를 다시 push하면 R2로 실패함 |

### 5-2. Codex 검수 중 나온 주요 지적

| 작업 · 회차 | 등급 | 지적 | 대응 |
|---|---|---|---|
| M0-04 r1 | 높음 | 상태 500 `HttpException`이 내부 메시지를 노출하고 로그를 생략 | 5xx는 예외 종류와 무관하게 일반 문구, 원래 예외는 error 로그에 기록 (회귀 테스트 4건) |
| M0-04 r1 | 중간 | `/api/docs`에 요청 ID 미적용 | 요청 ID 미들웨어를 helmet 앞에 등록 |
| M0-08 r1 | 높음 | 보조 브랜치에서 수정한 검수 결과를 `--no-ff` merge하면 R3 통과 | 커밋별 이력을 `<merge-base>..<head>` 전체로 수집 |
| M0-08 r2 | 중간 | R5 실제 CI 거부 검증이 Merge 뒤로 보류됨 | Merge 전에 시험 브랜치로 R5 실패 확인 (run 44916305479) |
| M0-02 r1·r3 | 중간 | `process.env` 예외 범위가 넓음 / `@/` 별칭의 `..` 미정규화 | 예외를 루트·앱 루트 바로 아래 `*.config.*`로 한정 / `path.posix.normalize` 적용 |
| M0-03 r1 | 중간 | 초기화용 임시 서버를 healthy로 판정할 수 있음 | `pg_isready -h 127.0.0.1` |
| M0-04-fix r1 | 중간 | 실제 기동 성공 검증의 완료 근거 부재 | 스크래치 클론에서 4개 시나리오 실행 결과를 인계 노트에 기록 |
| M0-07 r1 | 중간 | health 503 OpenAPI가 실제 에러 본문과 다름 / 루트 `tsconfig.json` 변경이 쓰기 범위에 없음 | 공통 `ErrorResponseDto`로 문서화 / 지시서 쓰기 범위 갱신 |

### 5-3. Codex 검수 환경의 한계

- Codex는 읽기 전용으로 실행되어 Docker 소켓 접근(M0-03 r1·r2), Jest 임시 파일 쓰기(M0-06 r1, EPERM), 전체 `unittest`(M0-01 r1·r2)를 재실행하지 못했다. 이 경우 Codex는 구현자의 실행 보고를 독립 검증 근거로 쓰지 않았다
- 이 한계를 메우려고 오케스트레이터가 스크래치 클론에서 독립 확인한 결과를 인계 노트에 기록했다 (M0-04-fix 실제 기동, M0-06 로컬 DB 기동·health 200, M0-07 DTO 반영 시험, M0-08 CI·거부 시험)
- M0-08 r3은 실제 GitHub CI 결과를 독립 조회하지 않았다고 적었다

## 6. 기획 변경 · 결정 이력

개발자 승인 표시는 기록에서 확인되는 것만 썼다. "표시 없음"은 승인이 없었다는 뜻이 아니라 문서에 적힌 것이 없다는 뜻이다.

| 시점 | 항목 | 내용 | 개발자 승인 | 근거 |
|---|---|---|---|---|
| 2026-11-21 | M0 작업 분할 (G1) | 9개 작업, 난도 높음 2건(M0-06·M0-08) Opus, CI 전 작업은 로컬 검사로 push | 승인됨 | `plan.md` 머리말·§7 |
| 2026-11-21 | M0 계획 검수 반영 | M0-07을 계약 작업으로, M0-01에 재현 테스트, M0-05에 Playwright 배정 | 표시 없음 (Codex 중간 3건 수정, r2 통과) | `docs/reviews/M0-plan` |
| 2026-11-21 | D25 저장소 구조 | `frontend/`·`backend/` 분리, 공용 패키지 없음, 계약은 `backend/openapi.json` 하나. M0-02는 Merge 전 재작업 | 승인됨 (결정자: 사용자) | 개요 D25, v0.9 |
| 2026-11-21 | D26 프론트엔드 구조 | `app → features → components·lib` 기능별 구조와 import 규칙 | 승인됨 (결정자: 사용자) | 개요 D26, v0.10 |
| 2026-11-21 | 계약 생성물 PR 단위 허용 | `pr_contract_generated`(`contract/` 브랜치 + 생성 검사 통과 시 허용). 이후 M0-08에서 `pr_contract_openapi` 추가 | 표시 없음 (Codex r1 지적 수정) | 협업 v0.8, `M0-structure` r1 |
| 2026-11-21 | PR 생성 링크 전달 중단 | 개발자가 PR을 직접 생성·Merge (C17) | 승인됨 (개발자 지시) | 협업 v0.8 |
| 2026-11-21 | 금지 이름 규칙 | `id-denylist` → 선언만 검사하는 `jblog/denied-names` | 승인됨 (M0-06 중) | 협업 v0.8.1, 커밋 `670ac38` |
| 2026-11-21 | Codex 결과 보호 방식 | 해시 기록 대신 커밋별 "추가만 허용" 판정. 지시서에 `참여 역할` 줄 추가 | 표시 없음 | 협업 v0.8.2 (M0-08) |
| 2026-11-21 | PR 단위 소유권 R1~R9 | 규칙 표는 오케스트레이터가 확정. R1·R5·R3 해석과 ④ 발견 3건의 처리도 오케스트레이터 결정 | 표시 없음 (Merge로 승인) | `M0-08.md` |
| 2026-11-21 | 개요 Q5 해결 | Next.js 16.4.6, `revalidateTag(tag, { expire: 0 })`이 즉시 만료. 기획 예시와 일치 | 표시 없음 | 개요 §8, M0-05 인계 노트 |
| 2026-11-21 | 백엔드 §3.2 문법 | Prisma 7 문법으로 구현 (생성기, `prisma.config.ts`, 어댑터, 인덱스를 스키마로 선언). 모델·필드·제약 의미는 그대로 | 표시 없음 (기획 문서 본문은 수정하지 않음) | M0-06 인계 노트 표 |
| 2026-11-21 | G3 수용 | M0-05 E2E가 로컬 `.env.local`을 함께 읽음. M0-06 통합 헬퍼가 `backend/.env`를 함께 읽음 | 승인됨 (개발자) | M0-05 r2 대응, M0-06 ④ |
| 2026-11-21 | 백엔드 §8 예시 교체 | docker-compose·Dockerfile 예시를 실제 구조로 교체 (G2) | 승인됨 (2026-11-21) | `M0-09.md` |
| 2026-11-22 | `dev` 필수 상태 검사 | CI 8개 잡을 필수 검사로 등록, 최신 `dev` 기준 | 개발자가 요청, 오케스트레이터가 설정 | 체크리스트 |

- `ownership-check`의 R3는 협업 §5.2에 처음 쓰인 "해시 기록" 방식이 아니라 커밋별 이력 방식으로 구현했다(협업 v0.8.2에서 본문 갱신). 같은 보장을 낸다는 판단은 M0-08 지시서에 있다
- M0 이전(P1)의 협업 절차 변경은 이 보고서 범위 밖이다. 다만 M0-01의 출발점은 그 검수 r5의 후속 처리(Issue #2, 개발자 승인 2026-11-21)였다

## 7. 이후로 넘기는 일

후속 Issue는 아직 만들지 않았다.

| 항목 | 넘기는 곳 | 담당 작업 ID | 근거 |
|---|---|---|---|
| `x-request-id` 길이·문자 제한 (지금은 들어온 값을 그대로 사용) | M2 | 해당 M2 백엔드 작업 (ID는 지시서에서 확정) | M0-04 ④ |
| health 외 에러 응답을 OpenAPI에 문서화. `@ApiOkResponse`는 `@HealthCheck()` 위에 써야 반영됨 | M2 | 해당 M2 백엔드 작업 | M0-07 ①, 오케스트레이터 확인 |
| `postSlug` 현재 slug 조회: `findUnique({ where: { postId } })` 금지, `findFirst` + `isCurrent: true` | M2 | BE-03 지시서에 주의 사항으로 | M0-06 ③ |
| `X-Internal-Key` 원문 헤더 추가 | M2 이후 | `/internal/*` API 작업 (BE-04a) | M0-07 ③ |
| 인증·CSRF·refresh | M3 | SEC-01 등 | M0-07 ③ |
| 프론트엔드 동적 라우트가 생기면 런타임에 `API_INTERNAL_URL`·`NEXT_PUBLIC_SITE_URL` 주입 | M1~ | 첫 동적 라우트 작업 | M0-08 ③ |
| `NEXT_PUBLIC_SITE_URL`을 배포 시 실제 주소로 `--build-arg` 재빌드 | M-Deploy | 배포 작업 | M0-08 ③ |
| backend 이미지 크기(약 793MB) 최적화 검토 | M-Deploy | 배포 작업 | M0-08 ③ |
| `openapi-typescript`가 TS 6을 지원하면 갱신하고 peer 경고 기록 삭제. CI에 `pnpm peers check`·`--strict-peer-dependencies`를 넣으면 `peerDependencyRules.allowedVersions` 추가 | 해당 시점 | 미배정 | M0-07 ② |
| Prisma 업그레이드 시 `partialIndexes` 프리뷰 문법과 마이그레이션 diff 확인 | 해당 시점 | 미배정 | M0-06 ③ |
| Swagger UI가 helmet 기본 CSP에서 브라우저에 정상 렌더링되는지 (200만 확인함) | 미정 | 미배정 | M0-04 ④ |
| 비밀값 이름 공개 변수 정의 시 모듈 로드 실패 (보류) | 미정 | 미배정 | M0-05 ⑤ |
| `/uploads/*` rewrites, Pretendard·Noto Serif KR | 업로드 기능 / FE-02·FE-05 | FE-02, FE-05 | M0-05 규약 6·9 |
| PR이 `roles.json`·자기 지시서의 참여 역할을 넓혀 같은 PR의 범위 밖 변경을 통과시킬 수 있음 (지금은 경고만). base에서 읽도록 바꾸려면 G2 필요 | 협업 문서 제안으로 이관 | §8 제안 3 | M0-08 ④ |
| CI `docker` 잡은 이미지 캐시를 저장하지 않음, push·PR 이벤트가 둘 다 돌아 실행 시간이 늘 수 있음 (push 트리거를 PR 없는 브랜치로 줄이는 방법은 기획 변경) | 필요 시 | 미배정 | M0-08 ③ 알아둘 점 |
| `pnpm install --ignore-scripts`로 설치하면 생성 클라이언트가 없어 `typecheck`·Jest 실패 → `pnpm --filter @jblog/backend db:generate` | 문서화 | 미배정 | M0-06 devops 노트 |

## 8. 협업 문서 · 스킬 보정 제안 (G2)

제안만 적는다. 협업 문서 본문은 이 작업에서 수정하지 않았다. 스킬·`CLAUDE.md` 보정은 오케스트레이터가 M0-09에서 반영했다(`.claude/skills/jblog-dev/SKILL.md`: 위임 공통 규칙 — `git config` 변경 금지, `nvm use`·pnpm 래퍼, `.env` 금지, `git add` 파일 지정, 테스트 대상 인터페이스 / 시험 브랜치 / 최신 `dev` rebase / `pnpm verify`. `CLAUDE.md`: 자체 검사 명령을 `pnpm verify`로).

| # | 어디를 | 무엇을 | 왜 (근거 사건) |
|---|---|---|---|
| 1 | 협업 §3.3 서브에이전트 공통 규칙 | 위임 프롬프트 공통 규칙에 "`git config` 변경 금지", "`nvm use` 후 실행", "pnpm 전환 실패 시 래퍼"를 넣는다 | M0-03 `core.hooksPath` 사건(커밋 3개가 훅 없이 들어감), 커밋 훅 ENOEXEC. 스킬에는 반영됐고 협업 문서와 맞추기 위함 |
| 2 | 협업 §5.2 소유권 | 역할 단위 훅은 저장소 경로 밖 파일을 검사하지 못하고 CI `ownership-check`가 PR 단위로 보완한다고 명시 | 오케스트레이터가 기록으로 제공한 한계. 현재 문서에는 장치 간 역할 분담만 있음 |
| 3 | 협업 §5.2 PR 단위 판정 | PR이 `roles.json`·자기 지시서의 참여 역할을 바꾸면 경고만 낸다는 현재 동작과 한계를 적고, base에서 읽는 방식으로 강화할지 결정한다 | M0-08 ④ 발견 3. 새 지시서를 같은 PR에 넣는 흐름과 충돌해 G2 사안으로 남김 |
| 4 | 협업 §9 지시서 형식 | `참여 역할` 줄을 필수로 두고, Codex 대응 등으로 역할이 추가되면 같은 PR에서 지시서의 참여 역할과 쓰기 범위를 갱신하는 단계를 둔다 | M0-07 r1 #2(쓰기 범위 누락), 과거 PR 재생에서 M0-07 test-engineer R9 정탐, M0-01~07에 `참여 역할` 줄이 없음 |
| 5 | 협업 §9 지시서 형식 | "테스트 대상 인터페이스" 절(경로·시그니처·동작)을 공유 계약·서브에이전트 조합 작업의 표준 절로 추가 | M0-04·05·06·08에서 이 절을 두고 테스트 선작성과 구현을 이어 갔음. 협업 §4.3 보강 |
| 6 | 협업 §6.4 지적 처리 · 대응 기록 형식 | "에러 수정 횟수" 줄을 "이번 회차 / 누적" 두 값으로 구분한다 | 대응 기록의 횟수가 회차별(M0-04 · M0-04-fix)과 누적(M0-02 r3 · M0-05 r2 · M0-08 r2)이 섞여 있어 이 보고서가 합산하기 어려움 |
| 7 | 협업 §6.4-a · §10 완료 기준 | 필수 검증의 "보류" 항목은 Merge 전에 해소하거나 개발자 승인 사유를 남긴다 | M0-08 r2(R5 검증 보류), M0-04-fix r1(기동 검증 근거 없음) |
| 8 | 협업 §6.1 · §6.2 | Codex 읽기 전용 실행의 한계(Docker·임시 파일·CI 조회 불가)를 적고, 그 항목은 오케스트레이터의 독립 확인 기록(SHA·명령·결과)을 근거로 검수하도록 한다 | M0-03 r1·r2, M0-06 r1, M0-01 r1·r2, M0-08 r3 |
| 9 | 협업 §5.1 · §12 P2 | CI 워크플로처럼 push해야 확인되는 변경은 Codex 최종 검수 전 push 금지 규칙과 충돌하므로, 시험용 브랜치(같은 작업 ID로 판정)에 push하고 확인 뒤 삭제하는 절차를 적는다 | M0-08 "CI 확인 방법"과 거부 시험 브랜치 6개 |
| 10 | 협업 §5.4 커밋 규칙 · 개요 §6-b | 접속 URL 예시는 `이름:값@` 형태를 쓰지 말고 문장이나 `{사용자}` 형태로 쓴다. 비밀정보 검사가 이를 거부한다는 점을 함께 적는다 | M0-03·06·08에서 반복 |
| 11 | 협업 §5.4 커밋 규칙 | 제목의 영문 대소문자 규칙을 해제했다는 점과 본문 100자 초과는 경고라는 점을 반영한다 | M0-02 commitlint 설정 |
| 12 | 협업 §4.0-b 모델 배정 | "대조할 자료가 많은 문서 작업은 한 단계 위 모델"을 배정 기준에 넣는다 | M0-09는 계획서가 Haiku였으나 지시서에서 Sonnet으로 올림 |
| 13 | 협업 §4.3 · docs-writer 정의 | docs-writer가 보고서 파일을 직접 쓸 수 있는지(현재 도구 정책상 서브에이전트의 보고서 파일 쓰기가 거부됨) 확인하고, 안 되면 "docs-writer는 본문을 반환하고 오케스트레이터가 저장"으로 절차를 바꾼다 | M0-09: docs-writer의 `report.md` 쓰기가 거부되어 오케스트레이터가 저장함 |

## 9. M1 착수 조건 확인 (개요 §8)

| 개요 §8 항목 | 조건 | 상태 | 근거 |
|---|---|---|---|
| 구현 착수 조건, M0~M1 | 없음 (바로 시작 가능) | **충족** | 개요 §8 표 |
| Q0 배포 인프라 (D6) | 보류. 결정되면 M-Deploy 계획 | 해당 없음 (M1 착수 조건 아님) | 개요 §8 |
| Q1 도메인 | 미정. D6 결정 후 | 해당 없음 | 개요 §8 |
| Q2 관리자 로그인 방식 | 확정 (D10) | 충족 | 개요 §8 |
| Q3 블로그 카테고리 초기 목록 | 시드: Backend, Frontend, DevOps, Retrospect | **충족** (M0-06 seed에 4개 반영) | M0-06 ③ |
| Q4 UI 기획서 §10 미확정 9개 항목 | Figma MCP 한도가 리셋된 뒤 M1 시작 시 확인 | **미충족** (M1 첫 작업 항목, 체크리스트 M1 첫 줄). 착수를 막는 조건은 아님 | 개요 §8, 체크리스트 M1 |
| Q5 Next.js 버전과 `revalidateTag` | 해결 | 충족 (Next.js 16.4.6, `{ expire: 0 }`) | M0-05 ④, 개요 §8 |
| M3 전 · M4 전 · M5 전 · M7 전 조건 | 각 마일스톤 시작 전 확정 | 해당 없음 (M1 착수와 무관) | 개요 §8 표 |

M0 완료 기준(개요 §7 "빈 앱 두 개가 CI 통과")도 함께 확인했다.

| 항목 | 상태 | 근거 |
|---|---|---|
| 빈 앱 두 개가 CI 통과 | 충족 | 시험 브랜치 run 44914034172, `chore/M0-08-ci` run 44916562916에서 8개 잡 통과 |
| 모노레포·Docker(db)·Prisma·ESLint/Prettier/Husky·CI | 충족 | §3 |
| 체크리스트 M0 전 항목 상태 확정 | 충족 | 체크리스트 (아래 정리 포함) |

### 오케스트레이터가 정리한 불일치 (docs-writer 발견)

- 체크리스트 `ownership-check` 항목의 "R5는 Merge 후 재확인" 문구 → M0-08 r2 대응에서 Merge 전에 확인(run 44916305479)했으므로 문구 갱신
- P1 절 "Codex 로컬 검수 실제 1회 실행 확인 (M0 첫 작업에서)" → M0-01 r1·r2 검수 결과 파일로 수행 확인, 체크
- 진행 현황표 "M0 셋업" 🔄 → 이 report PR에서 ✅로 갱신 (체크리스트 사용법)
- PR 번호와 dev 반영 SHA → `git log --oneline dev`로 대조해 §2에 반영 (docs-writer가 reflog로 추정한 SHA와 모두 일치)
