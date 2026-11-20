# M0 셋업 — 작업 계획서

> 작성 2026-11-21 · 상태: **G1 승인됨 (2026-11-21, 개발자)**
> 기준: [전체 체크리스트 M0](../00_master_checklist.md#m0-셋업), [개요 §2·§4·§6](../../plan/00_overview.md), [협업 아키텍처](../../plan/05_collaboration_architecture.md) v0.7.4

## 1. 목표

빈 백엔드(NestJS)·프론트엔드(Next.js) 앱이 모노레포 안에서 **로컬 자체 검사와 GitHub CI를 모두 통과**하고, 협업 흐름(이슈 → 브랜치 → 자체 검사 → Codex 최종 검수 → push → CI → 개발자 PR·Merge)을 실제로 한 바퀴 이상 돌려 문제를 찾아 고친다.

**M0에서 하지 않는 것**: 기능 API·화면(M2~), 디자인 토큰(M1), 배포(보류).

## 2. 작업 목록

작업 단위는 "한 번에 검증할 수 있는 결과 하나"다 (협업 §4.0-a). 각 작업은 브랜치 1개 → PR 1개다.

| ID | 작업 | 실행 방식 · 참여 역할 | 난도 · 모델 | 의존 |
|---|---|---|---|---|
| **M0-01** | 검수 스크립트 보완 (Issue #2, 버그 수정): `--plan` 회차를 날짜와 무관하게 증가, Codex 실행 시간 제한(시간 초과 시 Codex 자식 프로세스까지 종료), **터미널 shim을 거치지 않고 실제 Codex 실행 파일 사용**(`CODEX_BIN` 환경변수로 지정 가능). 테스트는 가짜 `codex`(stub)로 네트워크 없이 실행 | **단일 실행 + 재발 방지 테스트** · test-engineer(재현 테스트 선작성: 날짜 넘김 회차, 작업 ID 경계, 시간 초과) → devops-engineer. 테스트 위치 `scripts/tests/**`를 test-engineer 쓰기 범위에 추가(오케스트레이터가 `roles.json` 갱신) | 보통 · Sonnet | 없음 |
| **M0-02** | 모노레포·도구 기반: pnpm workspace, Turborepo, 루트 `package.json`·`tsconfig`, `packages/tsconfig`·`packages/eslint-config`, ESLint flat(가독성 규칙·`process.env` 제한), Prettier, Husky + lint-staged + commitlint, Husky pre-commit이 `check-secrets.sh` 호출 | 단일 실행 · devops-engineer | 보통 · Sonnet | 없음 |
| **M0-03** | 로컬 DB: `infra/docker-compose.yml`(PostgreSQL 17 + healthcheck), `infra/.env.example`, `infra/README.md` | 단일 실행 · devops-engineer | 낮음 · Sonnet | 없음 |
| **M0-04** | BE-01 Nest 기반: `apps/api` 생성, 환경변수 스키마 검증(누락 시 부팅 실패), pino(redact), helmet, ValidationPipe, Swagger(운영 비활성), 공통 에러 필터(01 §4.1 형식), `apps/api/.env.example`, Jest 설정 | 서브에이전트 조합 · devops-engineer(Jest 설정) → test-engineer(테스트 선작성) → backend-dev | 보통 · Sonnet | M0-02 |
| **M0-05** | FE-01 Next 기반: `apps/web` 생성(Next.js 버전 고정), Tailwind v4, next-themes, 폰트 로딩 골격, `lib/env.ts`(스키마 검증), `apps/web/.env.example`, Vitest 설정, **Playwright 공통 설정**(`playwright.config.ts`, `webServer`로 web 기동, `pnpm test:e2e`). **개요 Q5**: 고정한 버전의 `revalidateTag` 시그니처·즉시 만료 옵션 확인 결과를 인계 노트에 기록 | 서브에이전트 조합 · devops-engineer(Vitest·Playwright 설정) → test-engineer(단위 테스트 + E2E 스모크 1건) → frontend-dev | 보통 · Sonnet | M0-02 |
| **M0-06** | BE-02 Prisma (공유 계약): MVP 스키마 전체(01 §3.2, M7 관계 제외), 마이그레이션, `pg_trgm`·`PostSlug` 부분 unique 인덱스 수동 SQL, 더미 seed, `/api/health` DB ping, Testcontainers 통합 테스트 기반 | 공유 계약 변경 · test-engineer → backend-dev (계약 책임자) | **높음 · Opus** (스키마가 이후 모든 작업의 계약) | M0-03, M0-04 |
| **M0-07** | api-types 파이프라인 (**공유 계약**, 브랜치 `contract/M0-07-api-types`): backend-dev — Nest Swagger에서 `apps/api/openapi.json` 출력 명령 / devops-engineer — `packages/api-types` 패키지와 생성 스크립트 `pnpm gen:api-types`(`--check`로 커밋된 결과와 불일치 검출) / frontend-dev — `apps/web`에서 `@jblog/api-types` import 연결. 계약 책임자 backend-dev. **DTO 변경 → 타입 반영 확인은 로컬 임시 시험으로만 하고 커밋하지 않는다** | 공유 계약 변경 · backend-dev → devops-engineer → frontend-dev | 보통 · Sonnet | M0-04, M0-05 |
| **M0-08** | CI: `ci.yml`(작업 브랜치 push + `dev` 대상 pull_request) — lint · typecheck · test(Testcontainers) · build · Dockerfile 빌드 검증 · **`ownership-check`**(`roles.json` + `pr_common_allow.py` + 지시서의 참여 역할) · 잠금 파일 검사 · SHA 3종 출력 · `permissions` 최소화. 루트 `pnpm verify`(CI와 같은 로컬 검사). `apps/api`·`apps/web` Dockerfile. 완료 후 `dev` Ruleset에 필수 상태 검사 추가 | 서브에이전트 조합 · test-engineer(ownership-check 판정 테스트) → devops-engineer | **높음 · Opus** (소유권 판정 로직, CI 보안 설정) | M0-02 ~ M0-07 |
| **M0-09** | 협업 흐름 시험 마무리 + M0 report: 시험 항목 확인(아래 §5), 협업 문서·스킬 보정 제안(G2), `docs/work/M0/report.md`, 체크리스트 진행 현황 | 단일 실행 · docs-writer (+ 오케스트레이터) | 낮음 · Haiku | M0-08 |

## 3. 순서와 병렬

```
1단계 (병렬 최대 3):  M0-01 ── M0-02 ── M0-03
2단계 (병렬 2):       M0-04 (BE-01) ── M0-05 (FE-01)        ← M0-02 Merge 후
3단계:                M0-06 (Prisma, 계약)                   ← M0-03·M0-04 Merge 후
                      M0-07 (api-types)                      ← M0-04·M0-05 Merge 후 (M0-06과 병렬)
4단계:                M0-08 (CI)                             ← 위 모두 Merge 후
5단계:                M0-09 (시험 마무리·report)
```

- **첫 PR은 M0-01**로 한다. 가장 작고 독립적이라 이슈 → 브랜치 → Codex 검수 → push → 개발자 PR·Merge → 이슈 자동 종료 흐름을 먼저 확인하기 좋다. (CI는 아직 없음)
- CI(M0-08)가 생기기 전 작업(M0-01~07)은 **로컬 자체 검사 결과를 PR에 기록**하고 push한다. CI 단계는 해당 없음으로 표시한다.
- 동시에 진행하는 구현 작업은 최대 3개 (협업 §4.4).

## 4. 작업별 완료 기준 (필수 검증 요약)

상세는 작업마다 지시서(`docs/work/M0/tasks/<ID>.md`)에 성공·거부·회귀로 적는다.

| ID | 성공 | 거부·회귀 |
|---|---|---|
| M0-01 | 이전 날짜에 r2가 있으면 다음 날 `--plan` 재검수가 r3, stub `codex`로 정상 실행 시 결과 파일 생성 | 다른 작업 ID 파일은 회차 계산에서 제외 / 시간 초과 시 결과 파일 없이 실패 코드 + stub 자식 프로세스 종료 확인 / PATH 앞에 shim이 있어도 `CODEX_BIN` 또는 실제 실행 파일 사용 |
| M0-02 | `pnpm install`·`pnpm lint`·`pnpm format:check` 통과, Conventional Commits 메시지 통과 | 형식이 틀린 커밋 메시지 거부 / `.env` 커밋 거부 / 가독성 규칙 위반 샘플이 lint 실패 |
| M0-03 | `docker compose up -d` 후 healthcheck 정상, 앱 없이 `psql` 접속 | 비밀값 없이 `.env.example`만으로 실행 안내가 완결 |
| M0-04 | `pnpm --filter api start`·`test` 통과, 에러 응답이 01 §4.1 형식 | 필수 환경변수 누락 시 부팅 실패 / 운영 모드에서 `/api/docs` 404 / 로그에 쿠키·Authorization 미출력 |
| M0-05 | `pnpm --filter web build`·`test` 통과, `pnpm test:e2e`가 web을 띄워 스모크 1건 통과, Light/Dark 전환 골격 동작 | 필수 환경변수 누락 시 빌드 실패 / `NEXT_PUBLIC_`에 비밀값 없음 |
| M0-06 | 마이그레이션 적용, seed 실행, `/api/health` DB ping 200 | 같은 slug 두 번 예약 시 DB 제약 위반 / 한 글에 `isCurrent=true` 2개 불가 / M7 관계(`McpToken`) 미포함 |
| M0-07 | `pnpm gen:api-types` 실행 → `packages/api-types` 생성, web에서 import 후 typecheck 통과 / (로컬 임시 시험) DTO 필드 추가 시 생성 타입에 반영 | `pnpm gen:api-types --check`가 커밋된 결과와 다르면 실패 (M0-08 CI에서 사용) |
| M0-08 | push·PR에서 CI 전체 통과, SHA 3종 출력, `pnpm verify`가 CI와 같은 검사 | 범위 밖 파일 변경 시 `ownership-check` 실패 / `package.json` 없는 잠금 파일 변경 실패 / 다른 작업 ID의 검수 결과 파일 실패 |
| M0-09 | 체크리스트 M0 전 항목 상태 확정, report 작성 | 실패·보류 항목을 완료와 섞지 않음 |

## 5. 협업 흐름 시험 항목 (체크리스트 M0 "협업 흐름 시험")

| 항목 | 확인 시점 |
|---|---|
| 이슈 → 브랜치 → 자체 검사 → Codex 최종 검수 → push → 개발자 PR·Merge → 이슈 자동 종료 | M0-01 |
| PR 생성 링크의 제목·본문·`Closes #n` 채움과 이슈 자동 종료 | M0-01 |
| 서브에이전트 위임과 역할 기록(`.claude/.current-role`), 소유권 훅 동작 | M0-04 |
| 검수 후 코드 커밋 시 재검수 후 push | 해당 상황이 처음 생기는 작업 |
| push 이벤트 CI 실행, SHA 3종 출력 | M0-08 |
| 범위 밖 변경 시 `ownership-check` 실패 (시험용 브랜치, Merge하지 않음) | M0-08 |

## 6. 위험과 대응

| 위험 | 대응 |
|---|---|
| 가독성 ESLint 수치(복잡도 10 등)가 생성 코드·설정 파일에서 과도하게 실패 | M0-02에서 실제 파일로 시험, 필요하면 조정안을 G2로 제안 |
| Testcontainers가 로컬 Docker·CI에서 느리거나 실패 | M0-06에서 측정, 환경 문제는 DevOps가 처리 (협업 §4.3-a) |
| Codex 실행 멈춤 재발 | 원인: 터미널(cmux) shim이 Codex에 MCP 연동을 붙여 실행 → M0-01에서 실제 실행 파일 사용 + 시간 제한. 그전까지는 `PATH="/opt/homebrew/bin:$PATH"`로 실행 |
| Next.js 최신 API가 기획 예시와 다름 (Q5) | M0-05 인계 노트에 기록 → 프론트엔드 기획 §4 갱신은 G2 |

## 7. 개발자 확인이 필요한 사항 (G1)

1. 위 작업 분할(9개)과 순서
2. 난도 높음 2건(M0-06 Prisma 스키마, M0-08 CI)을 Opus로 실행
3. CI가 생기기 전(M0-01~07)에는 로컬 자체 검사 결과로 push하는 것
