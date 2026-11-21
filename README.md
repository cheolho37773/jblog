# jblog

개인 포트폴리오 겸 기술 블로그.

- 프론트엔드: Next.js (App Router) · Tailwind CSS
- 백엔드: NestJS · Prisma · PostgreSQL
- 개발 방식: Claude Code 에이전트 팀 구현 + Codex 독립 검수

## 문서

| 문서 | 내용 |
|---|---|
| [docs/plan/00_overview.md](docs/plan/00_overview.md) | 개요 · 기술 스택 · 결정사항 · 마일스톤 |
| [docs/plan/01_backend_plan.md](docs/plan/01_backend_plan.md) | 백엔드 기획 |
| [docs/plan/02_frontend_plan.md](docs/plan/02_frontend_plan.md) | 프론트엔드 기획 |
| [docs/plan/03_ai_authoring_mcp_plan.md](docs/plan/03_ai_authoring_mcp_plan.md) | AI 자동 작성 (MCP) 기획 |
| [docs/plan/04_access_control_and_content_protection.md](docs/plan/04_access_control_and_content_protection.md) | 접근 통제 · 콘텐츠 복사 방지 |
| [docs/plan/05_collaboration_architecture.md](docs/plan/05_collaboration_architecture.md) | 협업 아키텍처 (에이전트 · 검수 · Git 운영) |
| [docs/ui_design/ui_design_spec.md](docs/ui_design/ui_design_spec.md) | UI 디자인 기획 |
| [docs/work/00_master_checklist.md](docs/work/00_master_checklist.md) | 전체 진행 체크리스트 |

## 개발 환경

```bash
nvm use                          # Node 24 (.nvmrc)
corepack enable                  # pnpm 버전은 package.json의 packageManager로 고정
pnpm install                     # Husky 훅 설치: 커밋 전 비밀정보 검사·lint-staged, 커밋 메시지 검사(Conventional Commits)
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
```

프론트엔드 E2E(`pnpm test:e2e`)는 필요한 환경변수를 테스트 설정이 직접 넣습니다. 다만 Next.js가 `frontend/.env.local`도 함께 읽으므로, 그 파일의 다른 변수가 E2E 서버에 들어갈 수 있습니다(CI에는 파일이 없음). 단위·컴포넌트 테스트(Vitest)는 환경파일을 읽지 않습니다.

로컬 DB(PostgreSQL 17, Docker Compose): `cp infra/.env.example infra/.env` 후 `pnpm db:up` — 자세한 내용은 [infra/README.md](infra/README.md).

비밀값은 `.env` 파일로만 주입하고 커밋하지 않습니다 ([개요 §6-b](docs/plan/00_overview.md)).

## 브랜치

- `dev` — 기본 브랜치. 모든 작업 PR의 대상
- `main` — 릴리스용 (현재 Merge하지 않음)

## 기여

개인 프로젝트이므로 외부 Pull Request는 받지 않습니다.
