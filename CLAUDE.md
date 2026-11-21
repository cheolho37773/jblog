# jblog — Claude Code 작업 규칙

개인 포트폴리오 겸 기술 블로그. Next.js(`frontend/`) + NestJS·Prisma·PostgreSQL(`backend/`) 모노레포. 두 프로젝트는 서로의 코드를 import하지 않고 공용 코드 패키지를 두지 않는다 (개요 D25).
Claude Code 오케스트레이터 + 서브에이전트가 구현하고, Codex가 독립 검수한다.

## 단일 기준 문서

문서에 없는 결정은 내리지 않는다. 기획과 다르게 가야 하면 멈추고 개발자에게 제안한다 (G2).

| 문서 | 내용 |
|---|---|
| `docs/plan/00_overview.md` | 결정사항(D1~), 스택, 아키텍처, 환경·**민감 정보 규칙(§6-b)**, 마일스톤 |
| `docs/plan/01_backend_plan.md` | API, 데이터 모델, 상태·버전·캐시·인증·동시성 규칙 |
| `docs/plan/02_frontend_plan.md` | 라우팅·캐시, 디자인 토큰, 에디터, 관리자 |
| `docs/plan/03_ai_authoring_mcp_plan.md` | AI 자동 작성 MCP (M7) |
| `docs/plan/04_access_control_and_content_protection.md` | 접근 통제, 복사 방지 |
| `docs/plan/05_collaboration_architecture.md` | **협업 절차** (역할, 소유권, Git, 검수, 승인 관문) |
| `docs/ui_design/ui_design_spec.md` | 디자인 토큰·컴포넌트·페이지 |
| `docs/work/00_master_checklist.md` | 전체 진행 체크리스트 |

## 역할

| 역할 | 정의 |
|---|---|
| 오케스트레이터 (메인 세션) | 계획·지시서·계약 확정·위임·통합·보고. 절차는 스킬 `jblog-dev` |
| `backend-dev` · `frontend-dev` · `test-engineer` · `devops-engineer` · `docs-writer` | `.claude/agents/` |
| Codex | 독립 검수 (읽기 전용). 지침은 루트 `AGENTS.md`, 실행은 스킬 `codex-review` |

## 반드시 지키는 규칙

1. **브랜치**: 작업 1개 = `dev`에서 만든 브랜치 1개 → 자체 검사 → **Codex 최종 검수** → **push**(검수 통과 후에만) → CI → **브랜치·head SHA·연결 이슈 번호 보고** (PR 생성 링크는 보내지 않는다). `dev` → `main` Merge는 하지 않는다
2. **PR·Merge는 개발자가 GitHub에서 직접 한다.** `gh pr create`, `gh pr merge`를 실행하지 않는다. 개발자의 Merge가 G4 승인이다. 승인 관문: G1 마일스톤 계획 · G2 기획 변경 · G3 Claude·Codex 충돌 · G4 Merge
3. **에러 수정 3회 상한**: 자체 검사·CI·Codex 지적 수정 각각 3회까지. 넘으면 시도 내역과 함께 개발자 승인 요청
4. **민감 정보**: 비밀값·접속 정보는 코드에 하드코딩하지 않고 `.env`로만 주입. `.env` 파일은 읽지도 커밋하지도 않는다
5. **가독성**: 협업 문서 §10-a 규칙 (이름, 작은 함수, early return, "왜"를 설명하는 주석, 매직 값 금지)
6. **파일 소유권**: `scripts/ownership/roles.json`. 서브에이전트를 실행하기 전에 worktree의 `.claude/.current-role`에 역할을 기록한다 (훅이 범위 밖 Write/Edit를 차단)
7. **검수 결과 보호**: `docs/reviews/**/*.codex.md`, `docs/plan/feedback/**`는 수정하지 않는다
8. **보고**: 완료 / 실패 / 보류를 섞지 않는다. 결정이 필요한 것만 요약한다
9. **체크리스트**: `docs/work/00_master_checklist.md`의 해당 항목을 **작업 PR 안에서**(기록 단계) 체크한다. `dev` 직접 push는 막혀 있다

## 자주 쓰는 명령

```bash
nvm use                                   # Node 24 (.nvmrc)
corepack enable && pnpm install           # 최초 1회: pnpm 준비 + Husky 훅 설치 (비밀정보·커밋 메시지 검사)
pnpm verify                               # CI와 같은 로컬 자체 검사 (통합·E2E·Docker 포함: pnpm verify:full)
scripts/codex-review.sh <작업ID>          # Codex 로컬 검수
gh issue develop <번호> --base dev --name <브랜치>
git push -u origin <브랜치>               # PR은 개발자가 GitHub에서 생성·Merge
```
