---
name: jblog-dev
description: "jblog 오케스트레이터 작업 절차. 마일스톤 시작(예: 'M2 시작'), 작업 진행(예: 'BE-05 진행', '다음 작업 해줘'), 작업 지시서 작성, 서브에이전트 위임, PR·검수·Merge 승인 요청, 체크리스트 갱신 때 사용한다. 협업 아키텍처(docs/plan/05_collaboration_architecture.md)를 실행 절차로 옮긴 것이다."
---

# jblog-dev — 오케스트레이터 작업 절차

이 스킬은 `docs/plan/05_collaboration_architecture.md`의 실행 절차다. 충돌하면 문서가 우선한다.

## 0. 항상 지키는 것

- 기획 문서(`docs/plan/*`, `docs/ui_design/*`)가 단일 기준이다. 문서에 없는 결정은 내리지 않는다 → G2
- 개발자 승인 관문: **G1** 마일스톤 계획, **G2** 기획 변경, **G3** Claude·Codex 의견 충돌, **G4** Merge(PR 번호 + head SHA)
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
2. **지시서** `docs/work/<M>/tasks/<ID>.md` (협업 §9 형식): 실행 방식·이유, 난도·모델, 선행 준비, 계약 기준(경로 @ SHA), 참조 섹션, 쓰기 범위, 실행 명령, 필수 검증(성공·거부·회귀), 비밀값은 변수명만, 인계 대상, 중간 보고 조건, 하지 말 것
3. **이슈·브랜치**
   ```bash
   gh issue create --title "[<ID>] <요약>" --label "<M>,<영역>,type:<유형>" --body "<지시서 링크·완료 기준>"
   gh issue develop <번호> --base dev --name <feat|fix|contract>/<ID>-<요약>
   git worktree add ../jblog-worktrees/<브랜치> <브랜치>
   ```
4. **위임**: 서브에이전트를 실행하기 전에 worktree에 역할을 기록한다 (`echo <역할> > .claude/.current-role`, 소유권 훅이 읽음). 난도 높음이면 모델을 Opus로 지정
   - 테스트 선작성(test-engineer) → 의도대로 실패 확인 → 구현(담당 에이전트) → 독립 검증(test-engineer)
5. **자체 검사 확인**: 지시서의 실행 명령, `git diff --name-only $(git merge-base origin/dev HEAD)`가 참여 역할 범위 합집합 안인지, 민감 정보 없음
6. **기록**: docs-writer(또는 단일 실행이면 인계 노트) — **검수 전에** 커밋
7. **Draft PR**: `gh pr create --base dev --draft` (PR 템플릿, 마지막 줄 `Closes #<이슈>`) → CI
8. **CI 통과 후 Codex 로컬 검수**: `scripts/codex-review.sh <ID>` → `docs/reviews/<ID>/r<N>.codex.md`. 지적마다 `r<N>.response.md`에 수정함 / 후속 처리(Issue) / 반박 기록. 높음은 반드시 수정, 반박은 G3
9. **Ready 전환**: `gh pr ready <PR>` → GitHub Codex PR 리뷰 대응
10. **G4 요청**: PR 번호, head SHA, 완료 기준 체크, 필수 검증 상태, 검수 판정, 에러 수정 횟수, 후속 처리 목록을 보고
11. **Merge** (개발자가 "PR #N @ <SHA> 승인"이라고 지시한 경우에만):
    ```bash
    gh pr merge <PR> --squash --match-head-commit <승인 SHA>
    git worktree remove ../jblog-worktrees/<브랜치>
    ```
12. **체크리스트** `docs/work/00_master_checklist.md`에서 항목 체크 (이슈·PR 번호, 날짜)

## 3. 검수 후 커밋이 추가되면 (협업 §6.5)

| 추가 내용 | 할 일 |
|---|---|
| `docs/reviews/<ID>/**`만 | 재검수 없음 |
| 코드·테스트·설정·문서 | CI + 재검수 `r<N+1>` (직전 검수 이후 변경 중심) |
| rebase만 | CI. `dev`에 들어온 변경 중 이 작업의 관련 범위(계약·import 모듈·가드·공용 유틸)가 있으면 영향 범위 재검수 |
| G4 승인 이후 무엇이든 | G4 재승인 |

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
