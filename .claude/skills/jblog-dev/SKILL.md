---
name: jblog-dev
description: "jblog 오케스트레이터 작업 절차. 마일스톤 시작(예: 'M2 시작'), 작업 진행(예: 'BE-05 진행', '다음 작업 해줘'), 작업 지시서 작성, 서브에이전트 위임, PR·검수·Merge 승인 요청, 체크리스트 갱신 때 사용한다. 협업 아키텍처(docs/plan/05_collaboration_architecture.md)를 실행 절차로 옮긴 것이다."
---

# jblog-dev — 오케스트레이터 작업 절차

이 스킬은 `docs/plan/05_collaboration_architecture.md`의 실행 절차다. 충돌하면 문서가 우선한다.

## 0. 항상 지키는 것

- 기획 문서(`docs/plan/*`, `docs/ui_design/*`)가 단일 기준이다. 문서에 없는 결정은 내리지 않는다 → G2
- 개발자 승인 관문: **G1** 마일스톤 계획, **G2** 기획 변경, **G3** Claude·Codex 의견 충돌, **G4** Merge
- **PR 생성과 Merge는 개발자가 GitHub에서 직접 한다.** 오케스트레이터는 `gh pr create`·`gh pr merge`를 실행하지 않는다 (협업 C17)
- 모든 작업 PR은 `dev` 대상. `dev` → `main` Merge는 하지 않는다
- 에러 수정은 루프마다 **3회까지**, 넘으면 개발자 승인 요청 (§8 형식)
- 민감 정보 하드코딩 금지, `.env`로만 (개요 §6-b)
- 보고할 때 완료 / 실패 / 보류를 섞지 않는다

## 1. 마일스톤 시작 (G1)

1. `docs/work/00_master_checklist.md`에서 해당 마일스톤 항목과 개요 §8 "구현 착수 조건" 확인
2. `docs/work/<M>/plan.md` 작성: 작업 목록(검증 가능한 결과 하나 단위, 협업 §4.0-a), 의존 관계, 실행 방식, 담당, 난도·모델, 완료 기준, 병렬 계획(동시 구현 최대 3개), 크로스커팅 변경이 있으면 §5.3-a 단계
3. (선택) `scripts/codex-review.sh`로 계획서 검수
4. 개발자에게 G1 승인 요청 — 결정이 필요한 것만 요약

## 2. 작업 1건 진행

1. **실행 방식 결정** (협업 §4.0): 공유 계약 변경? → 계약 책임자 단계별 / 새 완료 기준 테스트 필요? → 서브에이전트 조합 / 아니면 단일 실행. 버그 수정은 재현 테스트 먼저
2. **지시서** `docs/work/<M>/tasks/<ID>.md` (협업 §9 형식): 실행 방식·이유, **`- 참여 역할: a, b` 줄**(CI `ownership-check`가 읽음 — 빠지면 PR 검사 실패), 난도·모델, 선행 준비, 계약 기준(경로 @ SHA), 참조 섹션, 쓰기 범위, 실행 명령, 필수 검증(성공·거부·회귀), 비밀값은 변수명만, 인계 대상, 중간 보고 조건, 하지 말 것
3. **이슈·브랜치**
   ```bash
   gh issue create --title "[<ID>] <요약>" --label "<M>,<영역>,type:<유형>" --body "<지시서 링크·완료 기준>"
   gh issue develop <번호> --base dev --name <feat|fix|contract>/<ID>-<요약> --checkout
   git branch --show-current   # 작업 브랜치인지 확인한 뒤 시작
   ```
   - 작업은 주 작업 폴더에서 한다. worktree를 쓰면 소유권 훅이 저장소 경로 밖 파일을 검사하지 못한다(M0 report). 의존성이 겹치는 작업(잠금 파일)은 동시에 진행하지 않는다
4. **위임**: 서브에이전트를 실행하기 전에 역할을 기록한다 (`echo <역할> > .claude/.current-role`, 소유권 훅이 읽음). 난도 높음이면 모델을 Opus로 지정
   - 위임 프롬프트에 항상 넣는 공통 규칙 (M0에서 사고가 난 항목):
     - 모든 명령 전 `source ~/.nvm/nvm.sh && nvm use`. 커밋 훅이 pnpm 전환(ENOEXEC)에 실패하면 `corepack pnpm`을 부르는 래퍼를 PATH 앞에
     - **`git config` 변경 금지** (`core.hooksPath`는 `.husky/_`. 세션 시작 때 읽은 예전 안내를 따르지 않게)
     - 저장소 `.env*` 생성·읽기 금지, 접속 URL을 `이름:값@` 형태로 쓰지 않기(비밀정보 검사가 막음)
     - `git add`는 파일을 지정한다 (오케스트레이터나 다른 단계의 미커밋 변경·검수 결과 파일이 섞이지 않게)
     - 테스트 선작성 단계가 있으면 "테스트 대상 인터페이스"(경로·시그니처)를 지시서에 먼저 확정한다
   - 테스트 선작성(test-engineer) → 의도대로 실패 확인 → 구현(담당 에이전트) → 독립 검증(test-engineer)
5. **자체 검사 확인**: 지시서의 실행 명령, `git diff --name-only $(git merge-base origin/dev HEAD)`가 참여 역할 범위 합집합 안인지, 민감 정보 없음
6. **기록**: docs-writer(또는 단일 실행이면 인계 노트) + `docs/work/00_master_checklist.md`에서 이 작업 항목 체크(이슈 번호·날짜) — **검수 전에** 커밋. `dev`는 직접 push가 막혀 있으므로 체크리스트는 작업 PR 안에서 갱신한다
7. **Codex 최종 검수 (push 전)**: `scripts/codex-review.sh <ID>` → `docs/reviews/<ID>/r<N>.codex.md`. 지적마다 `r<N>.response.md`에 수정함 / 후속 처리(Issue) / 반박 기록. 높음은 반드시 수정 후 재검수, 반박은 G3. **push 허용 조건(협업 §6.4-a)을 만족할 때까지 push하지 않는다**: 최근 검수가 push할 head SHA 대상, 높음 0건, 중간은 모두 재검수로 해소·후속 Issue·G3 수용 반박 중 하나
8. **push**: Codex 최종 통과 후 `git push -u origin <브랜치>` (검수 결과·대응 기록 커밋 포함) → push 이벤트로 CI 실행(8개 잡: lint·test·integration·e2e·build·contract·docker·ownership-check). CI 실패 → 수정 → **재검수** → 다시 push (3회 상한)
   - push 전 로컬에서 `pnpm verify`(통합·E2E·Docker까지는 `pnpm verify:full`)
   - CI 설정 자체를 바꾸는 작업은 검수 전에 시험용 브랜치(`<유형>/<ID>-trial` 등, 같은 작업 ID로 판정됨)로 CI를 확인하고, 확인 후 원격에서 삭제한다
   - `dev` 필수 상태 검사는 **최신 `dev` 기준**을 요구한다. PR 전에 다른 PR이 Merge되면 `dev`에 rebase → 영향 범위 판단(§3 rebase 행) → push → 새 head SHA 보고
9. **PR 요청 (개발자에게 보고)**: 아래를 한 번에 전달한다
   - **브랜치 이름과 연결 이슈 번호** (PR 본문에 `Closes #<이슈>`를 넣으면 Merge 시 이슈 자동 종료). **PR 생성 링크는 보내지 않는다** (2026-11-21 개발자 지시)
   - **head SHA** (개발자가 Merge 전에 PR 최신 커밋과 대조)
   - 완료 기준 체크, 필수 검증 상태(완료·실패·보류), 검수 판정, 에러 수정 횟수, 후속 처리 목록
10. **개발자 작업**: GitHub에서 PR 생성 → PR CI 확인 → Merge (= G4). 수정 요청을 받으면 브랜치에서 수정 → 자체 검사 → Codex 재검수 → push → 새 head SHA로 다시 보고
11. **정리** (Merge 확인 후): `git checkout dev && git pull --ff-only`, squash Merge라 `git diff --quiet <브랜치> dev`로 내용이 같은지 확인한 뒤 `git branch -D <브랜치>`. `dev`의 체크리스트에 항목이 체크돼 있는지, 이슈가 닫혔는지 확인 (열려 있으면 개발자에게 알림)

## 3. 검수 후 커밋이 추가되면 (협업 §6.5)

| 추가 내용 | 할 일 |
|---|---|
| 이 작업 ID의 검수 기록만 (`docs/reviews/<ID>/**`, `--plan`이면 `docs/plan/feedback/<날짜>_<ID>[_r<N>].md`) | 재검수 없음 |
| 코드·테스트·설정·문서 | 재검수 `r<N+1>` (직전 검수 이후 변경 중심) 후 push → CI |
| rebase만 | `dev`에 들어온 변경 중 이 작업의 관련 범위(계약·import 모듈·가드·공용 유틸)가 있으면 영향 범위 재검수. 없으면 생략하되 대응 기록에 이전·이후 head SHA, 들어온 변경 파일, 판단 근거를 남긴다 (push 허용 조건의 예외) |
| PR 요청 이후 무엇이든 | 새 head SHA와 재검사 결과를 개발자에게 다시 보고 |

## 4. 에러 수정 3회 초과 보고 형식

```
[승인 요청] <ID> · <루프 종류> <N>회
- 시도 1: <에러> → <수정> → <결과>
- 시도 2: ...
- 시도 3: ...
- 추정 원인: ...
- 제안: ① 추가 시도 n회 ② 지시서·범위 수정 ③ 기획 변경(G2) ④ 보류
```

## 5. 마일스톤 종료

개요 §7 완료 기준 확인 → 다음 마일스톤 착수 조건 확인 → docs-writer가 `docs/work/<M>/report.md` 작성 → 체크리스트 진행 현황 갱신 → 개발자 보고
