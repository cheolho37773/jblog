#!/usr/bin/env bash
# CI 실행의 SHA 3종을 구한다 (협업 §6.5, M0-08 동작 규약 5).
#
#   head    : PR이면 PR 브랜치의 최신 커밋, push면 push된 커밋        → 검수·G4 승인의 대상
#   base    : PR이면 PR base(dev 쪽 커밋), push면 origin/dev와의 merge-base → 통합 기준
#   checked : CI가 실제로 checkout한 커밋 (PR이면 테스트용 merge commit) → CI 결과의 근거
#
# 입력(워크플로가 env로 넘긴다. 브랜치 이름은 사용자 입력이라 스크립트 본문에 직접 넣지 않는다):
#   EVENT_NAME, PR_HEAD_SHA, PR_BASE_SHA, PR_HEAD_REF, PUSH_REF_NAME
# 출력: $GITHUB_OUTPUT에 head·base·checked·branch. --summary면 $GITHUB_STEP_SUMMARY에 표를 쓴다.
# push의 merge-base를 구하려면 checkout이 전체 이력을 받아야 한다 (fetch-depth: 0).
set -euo pipefail

TARGET_BRANCH="dev"

checked="$(git rev-parse HEAD)"
if [[ "${EVENT_NAME}" == "pull_request" ]]; then
  head="${PR_HEAD_SHA}"
  base="${PR_BASE_SHA}"
  branch="${PR_HEAD_REF}"
else
  head="${checked}"
  base="$(git merge-base "origin/${TARGET_BRANCH}" HEAD)"
  branch="${PUSH_REF_NAME}"
fi

{
  echo "head=${head}"
  echo "base=${base}"
  echo "checked=${checked}"
  echo "branch=${branch}"
} >>"${GITHUB_OUTPUT}"

if [[ "${1:-}" == "--summary" ]]; then
  {
    echo "### 검사 대상 SHA (${EVENT_NAME})"
    echo
    echo "| 이름 | SHA |"
    echo "|---|---|"
    echo "| head SHA | \`${head}\` |"
    echo "| base SHA | \`${base}\` |"
    echo "| 검사 SHA | \`${checked}\` |"
    echo
    echo "브랜치: \`${branch}\`"
  } >>"${GITHUB_STEP_SUMMARY}"
fi
echo "head=${head} base=${base} checked=${checked} branch=${branch}"
