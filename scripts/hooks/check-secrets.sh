#!/usr/bin/env bash
# 커밋 전 비밀정보 검사 (docs/plan/00_overview.md §6-b)
#  - .env 파일 커밋 차단 (.env.example 제외)
#  - 스테이징된 변경의 추가 줄에서 비밀정보 패턴 검사
# 오탐이면 해당 줄에 `secret-scan:allow` 주석을 붙이고 이유를 남긴다.
set -euo pipefail

SECRET_PATTERNS=(
  'AKIA[0-9A-Z]{16}'                                   # AWS 액세스 키
  'gh[pousr]_[A-Za-z0-9]{36,}'                         # GitHub 토큰
  'github_pat_[A-Za-z0-9_]{60,}'                       # GitHub fine-grained 토큰
  'xox[baprs]-[A-Za-z0-9-]{10,}'                       # Slack 토큰
  'sk-(proj-|ant-)?[A-Za-z0-9_-]{20,}'                 # OpenAI / Anthropic 키
  'jbl_mcp_[A-Za-z0-9]{20,}'                           # jblog MCP 토큰
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'                 # 개인 키
  'postgres(ql)?://[^:/[:space:]]+:[^@$[:space:]{]+@'  # 비밀번호가 들어간 DB 접속 문자열
  '(SECRET|PASSWORD|API_KEY|TOKEN)[A-Z_]*[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"'$[:space:]{]{8,}["'"'"']'  # 하드코딩된 비밀값 대입
)

blocked=0

staged_files=$(git diff --cached --name-only --diff-filter=ACMR)

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  base_name=$(basename "$file")
  if [[ "$base_name" == .env* && "$base_name" != ".env.example" ]]; then
    echo "[비밀정보 검사] .env 파일은 커밋할 수 없습니다: $file" >&2
    blocked=1
  fi
done <<< "$staged_files"

added_lines=$(git diff --cached -U0 --diff-filter=ACMR | grep -E '^\+[^+]' | grep -v 'secret-scan:allow' || true)

for pattern in "${SECRET_PATTERNS[@]}"; do
  matches=$(printf '%s\n' "$added_lines" | grep -E -- "$pattern" || true)
  if [[ -n "$matches" ]]; then
    echo "[비밀정보 검사] 비밀정보로 보이는 값이 있습니다 (패턴: $pattern)" >&2
    printf '%s\n' "$matches" | cut -c1-120 >&2
    blocked=1
  fi
done

if [[ "$blocked" -ne 0 ]]; then
  echo "비밀값은 .env 파일로만 주입하세요 (docs/plan/00_overview.md §6-b). 커밋이 중단되었습니다." >&2
  exit 1
fi
