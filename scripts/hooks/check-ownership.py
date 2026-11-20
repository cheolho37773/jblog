#!/usr/bin/env python3
"""Claude Code PreToolUse 훅: 현재 역할이 수정할 수 없는 파일의 Write/Edit를 차단한다.

규칙 원본: scripts/ownership/roles.json (협업 아키텍처 §5.2)
목적은 에이전트의 실수 방지다. Bash로 실행한 명령이 바꾸는 파일은 막지 못하므로
변경 파일 대조(자체 검사)와 CI ownership-check가 함께 쓰인다.

역할 판정 순서:
  1. 훅 입력의 agent_type (서브에이전트 호출 시 제공되는 경우)
  2. 환경변수 JBLOG_ROLE
  3. 작업 디렉터리의 .claude/.current-role 파일 (오케스트레이터가 작업 위임 전에 기록)
  4. 없으면 orchestrator
"""
import json
import os
import re
import sys
from pathlib import Path

BLOCK_EXIT_CODE = 2  # Claude Code 훅: 2로 종료하면 도구 호출을 막고 stderr를 에이전트에게 보여준다
FILE_PATH_KEYS = ("file_path", "notebook_path")


def glob_to_regex(pattern: str) -> re.Pattern:
    """'**'(여러 단계 디렉터리)와 '*'(한 단계 안)를 지원하는 단순 glob 변환."""
    regex = ""
    i = 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            regex += "(?:.*/)?"
            i += 3
        elif pattern.startswith("**", i):
            regex += ".*"
            i += 2
        elif pattern[i] == "*":
            regex += "[^/]*"
            i += 1
        else:
            regex += re.escape(pattern[i])
            i += 1
    return re.compile(f"^{regex}$")


def matches_any(path: str, patterns: list) -> bool:
    return any(glob_to_regex(pattern).match(path) for pattern in patterns)


def resolve_role(hook_input: dict, project_dir: Path) -> str:
    role = hook_input.get("agent_type") or os.environ.get("JBLOG_ROLE")
    if role:
        return role
    role_file = project_dir / ".claude" / ".current-role"
    if role_file.is_file():
        return role_file.read_text(encoding="utf-8").strip() or "orchestrator"
    return "orchestrator"


def is_allowed(path: str, role: str, rules: dict) -> tuple:
    if matches_any(path, rules["protected"]["patterns"]):
        return False, "보호된 파일입니다 (Codex 검수 결과·외부 피드백은 수정할 수 없습니다)."
    if matches_any(path, rules["shared"]["patterns"]):
        return True, ""

    role_rules = rules["roles"].get(role)
    if role_rules is None:
        return False, f"알 수 없는 역할입니다: {role}"

    if matches_any(path, role_rules.get("allow_after_deny", [])):
        return True, ""
    if matches_any(path, role_rules.get("deny", [])):
        return False, f"{role}의 쓰기 범위에서 제외된 경로입니다."
    if matches_any(path, role_rules["allow"]):
        return True, ""
    return False, f"{role}의 쓰기 범위 밖입니다."


def main() -> int:
    hook_input = json.load(sys.stdin)
    tool_input = hook_input.get("tool_input", {})
    raw_path = next((tool_input[key] for key in FILE_PATH_KEYS if key in tool_input), None)
    if not raw_path:
        return 0

    project_dir = Path(os.environ.get("CLAUDE_PROJECT_DIR") or hook_input.get("cwd") or ".").resolve()
    target = Path(raw_path)
    if not target.is_absolute():
        target = Path(hook_input.get("cwd") or project_dir) / target
    target = target.resolve()

    try:
        relative_path = target.relative_to(project_dir).as_posix()
    except ValueError:
        return 0  # 저장소 밖 파일(스크래치 등)은 검사하지 않는다

    rules = json.loads((project_dir / "scripts" / "ownership" / "roles.json").read_text(encoding="utf-8"))
    role = resolve_role(hook_input, project_dir)
    allowed, reason = is_allowed(relative_path, role, rules)
    if allowed:
        return 0

    print(
        f"[소유권 검사] '{relative_path}' 수정이 차단되었습니다. {reason}\n"
        "필요하면 작업 결과에 '변경 요청'으로 남겨 오케스트레이터에게 넘기세요. "
        "(docs/plan/05_collaboration_architecture.md §5.2)",
        file=sys.stderr,
    )
    return BLOCK_EXIT_CODE


if __name__ == "__main__":
    sys.exit(main())
