---
name: codex-review
description: "Codex 독립 검수 실행과 대응 기록 절차. 자체 검사를 통과한 작업 브랜치를 push 전에 Codex로 검수할 때, 기획 문서 변경을 검수받을 때, 검수 지적에 대응 기록을 남길 때 사용한다."
---

# codex-review — Codex 독립 검수

기준: `docs/plan/05_collaboration_architecture.md` §6, 검수 지침: 루트 `AGENTS.md`

## 실행

```bash
scripts/codex-review.sh <작업ID>            # 작업 브랜치 검수 (자체 검사 통과 후, push 전)
scripts/codex-review.sh <작업ID> --plan     # 기획 문서 변경 검수 → docs/plan/feedback/
```

- 기준은 `origin/dev`와의 merge-base ~ HEAD. 결과 첫 줄에 base·head SHA가 기록된다
- Codex는 읽기 전용 샌드박스로 실행된다. 코드를 바꾸지 않는다
- 결과: `docs/reviews/<ID>/r<N>.codex.md` (N은 자동 증가)

## 독립성 규칙

- Codex에게 Claude의 작업 과정이나 자기 평가를 넘기지 않는다. 산출물(diff·문서)만 본다
- `*.codex.md`는 **수정 금지** (소유권 훅과 CI가 차단)

## 대응 기록 `docs/reviews/<ID>/r<N>.response.md`

```markdown
<!-- codex-file-sha256: <r<N>.codex.md의 sha256> -->
# r<N> 대응 기록 (head <SHA>)
| # | 심각도 | 지적 요약 | 대응 | 근거·링크 |
|---|---|---|---|---|
| 1 | 높음 | ... | 수정함 | 커밋 <SHA> |
| 2 | 중간 | ... | 후속 처리 | Issue #<N> |
| 3 | 낮음 | ... | 반박 | <근거> → G3 |
```

- 높음: 반드시 수정 (반박은 G3)
- 중간: 수정 또는 후속 처리 Issue (G4에서 개발자 확인)
- 낮음: 담당 에이전트 판단
- 수정 후 재검수는 같은 명령으로 다시 실행 (회차 증가). 재검수는 3회차(r4)까지, 넘으면 개발자 승인
- **push 허용 조건** (협업 §6.4-a): 최근 검수가 push할 head SHA 대상 · 높음 0건 · 중간은 모두 재검수 해소 / 후속 Issue / G3 수용 반박
