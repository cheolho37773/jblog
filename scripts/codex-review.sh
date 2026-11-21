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

# --- 설정 -------------------------------------------------------------------
DEFAULT_TIMEOUT_SECONDS=480            # Codex 검수가 멈췄다고 판단하는 기본 시간
TIMEOUT_EXIT_CODE=124                  # GNU timeout과 같은 종료 코드
POLL_INTERVAL_SECONDS=0.2              # 감시 루프 확인 간격
KILL_GRACE_SECONDS=1                   # SIGTERM 후 SIGKILL을 보내기까지 기다리는 시간
SHIM_DIR_MARKER="cmux-cli-shims"       # 터미널 shim 경로 표식 (MCP 연동을 붙여 멈추는 문제, Issue #2)
DATE_REGEX='[0-9]{4}-[0-9]{2}-[0-9]{2}'  # 피드백 파일 날짜 형식

usage() {
  echo "사용: $0 <작업ID> [--plan]" >&2
  exit 1
}

# Codex 실행 파일 경로를 출력한다. CODEX_BIN 우선, 없으면 PATH에서 shim 디렉터리를 건너뛰고 찾는다.
# 왜: shim의 codex는 MCP 연동을 붙여 비대화형 검수에서 멈출 수 있다.
find_codex_bin() {
  if [[ -n "${CODEX_BIN:-}" ]]; then
    echo "$CODEX_BIN"
    return 0
  fi
  local dir candidate
  local -a path_dirs
  IFS=: read -r -a path_dirs <<< "${PATH:-}"
  for dir in "${path_dirs[@]}"; do
    [[ -n "$dir" && "$dir" != *"$SHIM_DIR_MARKER"* ]] || continue
    candidate="${dir}/codex"
    if [[ -f "$candidate" && -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

# --plan 모드의 다음 회차 번호를 출력한다. 날짜와 무관하게 같은 작업 ID의 최대 회차 + 1.
# 왜: 날짜가 바뀌어도 회차가 r1로 되돌아가면 안 된다. ID는 이스케이프해 다른 ID 파일을 제외한다.
next_plan_round() {
  local escaped_id="${TASK_ID//./\\.}"
  local pattern="^${DATE_REGEX}_${escaped_id}(_r([0-9]+))?\\.md$"
  local max_round=0 name round
  for name in docs/plan/feedback/*; do
    name="${name##*/}"
    [[ "$name" =~ $pattern ]] || continue
    round="${BASH_REMATCH[2]:-1}"   # 접미사 없는 파일은 r1
    (( 10#$round > max_round )) && max_round=$(( 10#$round ))
  done
  echo $(( max_round + 1 ))
}

# 작업 모드의 다음 회차 번호를 출력한다. 기존 r<N>.codex.md 최대 + 1.
next_task_round() {
  local last
  last="$(ls "$REVIEW_DIR" 2>/dev/null | sed -n 's/^r\([0-9][0-9]*\)\.codex\.md$/\1/p' | sort -n | tail -1)"
  echo $(( ${last:-0} + 1 ))
}

# 프로세스 그룹 전체(Codex와 자식)를 종료한다. 먼저 정중히(TERM), 남으면 강제(KILL).
kill_process_group() {
  local group_id="$1"
  kill -TERM -- "-${group_id}" 2>/dev/null || true
  sleep "$KILL_GRACE_SECONDS"
  kill -KILL -- "-${group_id}" 2>/dev/null || true
}

# Codex를 시간 제한 안에서 실행한다. macOS에는 timeout 명령이 없어 백그라운드 실행 + 감시 루프로 구현.
# 왜: set -m으로 Codex를 별도 프로세스 그룹에 두어야 시간 초과 시 자식까지 한 번에 종료할 수 있다.
# 왜: codex exec는 stdin이 열려 있으면 "Reading additional input from stdin..."을 출력하고 EOF를 기다리며 멈춘다.
#     그래서 표준 입력을 /dev/null로 연결한다 (set -m에서는 백그라운드 작업이 stdin을 물려받는다).
run_codex_with_timeout() {
  local timeout_seconds="$1"; shift
  local deadline=$(( SECONDS + timeout_seconds ))
  local codex_pid status=0
  set -m
  "$@" > /dev/null < /dev/null &
  codex_pid=$!
  set +m
  while kill -0 "$codex_pid" 2>/dev/null; do
    if (( SECONDS >= deadline )); then
      kill_process_group "$codex_pid"
      wait "$codex_pid" 2>/dev/null || true
      return "$TIMEOUT_EXIT_CODE"
    fi
    sleep "$POLL_INTERVAL_SECONDS"
  done
  wait "$codex_pid" || status=$?
  return "$status"
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
  ROUND="$(next_plan_round)"  # 재검수는 _r2, _r3 … 로 새 파일을 만든다 (기존 결과는 수정하지 않음)
  if (( ROUND == 1 )); then
    OUTPUT_FILE="docs/plan/feedback/${TODAY}_${TASK_ID}.md"
  else
    OUTPUT_FILE="docs/plan/feedback/${TODAY}_${TASK_ID}_r${ROUND}.md"
  fi
  TASK_BRIEF="(기획 문서 변경 검수 — 작업 지시서 없음)"
else
  REVIEW_DIR="docs/reviews/${TASK_ID}"
  mkdir -p "$REVIEW_DIR"
  ROUND="$(next_task_round)"
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

CODEX_PATH="$(find_codex_bin)" || {
  echo "codex 실행 파일을 찾지 못했습니다. CODEX_BIN에 경로를 지정하거나 PATH에 codex를 설치하세요." >&2
  exit 1
}
TIMEOUT_SECONDS="${CODEX_REVIEW_TIMEOUT:-$DEFAULT_TIMEOUT_SECONDS}"

echo "Codex 검수 시작: ${TASK_ID} (base ${BASE_SHA:0:7} · head ${HEAD_SHA:0:7}) · 제한 ${TIMEOUT_SECONDS}초"
CODEX_STATUS=0
run_codex_with_timeout "$TIMEOUT_SECONDS" "$CODEX_PATH" exec \
  --sandbox read-only \
  --cd "$REPO_ROOT" \
  --ephemeral \
  --output-last-message "$OUTPUT_FILE" \
  "$PROMPT" || CODEX_STATUS=$?

if (( CODEX_STATUS == TIMEOUT_EXIT_CODE )); then
  rm -f "$OUTPUT_FILE"  # 부분 결과는 검수 결과로 오인될 수 있어 남기지 않는다
  echo "시간 제한(${TIMEOUT_SECONDS}초)을 넘겨 Codex를 종료했습니다. CODEX_REVIEW_TIMEOUT으로 조정할 수 있습니다." >&2
  exit "$TIMEOUT_EXIT_CODE"
elif (( CODEX_STATUS != 0 )); then
  rm -f "$OUTPUT_FILE"
  echo "Codex 실행이 실패했습니다 (종료 코드 ${CODEX_STATUS})." >&2
  exit "$CODEX_STATUS"
fi

echo "검수 결과: ${OUTPUT_FILE}"
echo "다음 단계: 지적마다 대응 기록을 남기세요 (스킬 codex-review)."
