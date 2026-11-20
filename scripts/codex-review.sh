#!/usr/bin/env bash
# Codex 독립 검수 실행 (docs/plan/05_collaboration_architecture.md §6)
#
# 사용:
#   scripts/codex-review.sh <작업ID>          작업 브랜치 검수 → docs/reviews/<작업ID>/r<N>.codex.md
#   scripts/codex-review.sh <이름> --plan     기획 문서 변경 검수 → docs/plan/feedback/<날짜>_<이름>.md
#
# 검수 범위는 origin/dev와의 merge-base ~ HEAD 이다. Codex는 읽기 전용 샌드박스로 실행되며
# 검수 지침은 저장소 루트의 AGENTS.md를 따른다.
set -euo pipefail

usage() {
  echo "사용: $0 <작업ID> [--plan]" >&2
  exit 1
}

[[ $# -ge 1 ]] || usage
TASK_ID="$1"
MODE="${2:-task}"
[[ "$TASK_ID" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "작업ID에는 영문·숫자·.-_만 쓸 수 있습니다." >&2; exit 1; }

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "커밋되지 않은 변경이 있습니다. 검수는 커밋된 head SHA를 기준으로 합니다." >&2
  exit 1
fi

git fetch -q origin dev
BASE_SHA="$(git merge-base origin/dev HEAD)"
HEAD_SHA="$(git rev-parse HEAD)"
TODAY="$(date +%Y-%m-%d)"

if [[ "$MODE" == "--plan" ]]; then
  OUTPUT_FILE="docs/plan/feedback/${TODAY}_${TASK_ID}.md"
  ROUND=1
  while [[ -e "$OUTPUT_FILE" ]]; do  # 재검수는 _r2, _r3 … 로 새 파일을 만든다 (기존 결과는 수정하지 않음)
    ROUND=$(( ROUND + 1 ))
    OUTPUT_FILE="docs/plan/feedback/${TODAY}_${TASK_ID}_r${ROUND}.md"
  done
  TASK_BRIEF="(기획 문서 변경 검수 — 작업 지시서 없음)"
else
  REVIEW_DIR="docs/reviews/${TASK_ID}"
  mkdir -p "$REVIEW_DIR"
  LAST_ROUND="$(ls "$REVIEW_DIR" 2>/dev/null | sed -n 's/^r\([0-9][0-9]*\)\.codex\.md$/\1/p' | sort -n | tail -1)"
  ROUND=$(( ${LAST_ROUND:-0} + 1 ))
  OUTPUT_FILE="${REVIEW_DIR}/r${ROUND}.codex.md"
  TASK_BRIEF="$(git ls-files 'docs/work/*/tasks/*' | grep -E "/${TASK_ID}\.md$" | head -1 || true)"
  TASK_BRIEF="${TASK_BRIEF:-(작업 지시서를 찾지 못함 — docs/work/*/tasks/${TASK_ID}.md)}"
fi

[[ -e "$OUTPUT_FILE" ]] && { echo "이미 존재합니다: $OUTPUT_FILE" >&2; exit 1; }

PROMPT="AGENTS.md의 지침에 따라 독립 검수를 수행하라. 파일을 수정하지 말고 검수 결과 문서만 최종 응답으로 출력하라.

- 검수 대상: ${TASK_ID}
- 비교 기준: base ${BASE_SHA} (origin/dev와의 merge-base) ~ head ${HEAD_SHA}
- 변경 확인: git diff ${BASE_SHA}..${HEAD_SHA} 와 git diff --name-only ${BASE_SHA}..${HEAD_SHA}
- 작업 지시서: ${TASK_BRIEF}
- 출력 첫 줄: <!-- base: ${BASE_SHA} · head: ${HEAD_SHA} · reviewed: ${TODAY} -->"

echo "Codex 검수 시작: ${TASK_ID} (base ${BASE_SHA:0:7} · head ${HEAD_SHA:0:7})"
codex exec \
  --sandbox read-only \
  --cd "$REPO_ROOT" \
  --ephemeral \
  --output-last-message "$OUTPUT_FILE" \
  "$PROMPT" > /dev/null

echo "검수 결과: ${OUTPUT_FILE}"
echo "다음 단계: 지적마다 대응 기록을 남기세요 (스킬 codex-review)."
