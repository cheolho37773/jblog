#!/usr/bin/env python3
"""PR 단위 소유권 검사의 공통 허용 경로 판정 (협업 §5.2, §6.5).

규칙 원본: scripts/ownership/roles.json 의 pr_common_allow.regex
M0의 CI ownership-check가 이 함수를 사용한다.

사용:
  python3 scripts/ownership/pr_common_allow.py --self-test
"""
import json
import re
import sys
from pathlib import Path

ROLES_FILE = Path(__file__).with_name("roles.json")
TASK_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")  # scripts/codex-review.sh와 같은 규칙


def load_patterns(task_id: str) -> list:
    if not TASK_ID_PATTERN.match(task_id):
        raise ValueError(f"잘못된 작업 ID: {task_id}")
    rules = json.loads(ROLES_FILE.read_text(encoding="utf-8"))
    escaped_id = re.escape(task_id)
    return [re.compile(raw.replace("{ID}", escaped_id)) for raw in rules["pr_common_allow"]["regex"]]


def is_common_allowed(path: str, task_id: str) -> bool:
    return any(pattern.match(path) for pattern in load_patterns(task_id))


def self_test() -> int:
    task_id = "codex-local-only-flow"
    cases = [
        ("docs/plan/feedback/2026-11-21_codex-local-only-flow.md", True),
        ("docs/plan/feedback/2026-11-21_codex-local-only-flow_r4.md", True),
        ("docs/reviews/codex-local-only-flow/r1.response.md", True),
        ("docs/work/M0/tasks/codex-local-only-flow.md", True),
        # 다른 작업 ID가 접두사·접미사로 붙은 경우는 거부
        ("docs/plan/feedback/2026-11-21_other_codex-local-only-flow.md", False),
        ("docs/plan/feedback/2026-11-21_codex-local-only-flow-extra.md", False),
        ("docs/reviews/other-codex-local-only-flow/r1.codex.md", False),
        # 날짜 형식·회차 형식이 맞지 않으면 거부
        ("docs/plan/feedback/latest_codex-local-only-flow.md", False),
        ("docs/plan/feedback/2026-11-21_codex-local-only-flow_r0.md", False),
        ("docs/plan/feedback/2026-11-21_codex-local-only-flow_rX.md", False),
        # 하위 디렉터리나 다른 기획 문서는 거부
        ("docs/reviews/codex-local-only-flow/sub/r1.codex.md", False),
        ("docs/plan/05_collaboration_architecture.md", False),
    ]
    failures = [(path, expected) for path, expected in cases if is_common_allowed(path, task_id) != expected]
    for path, expected in failures:
        print(f"FAIL {path}: 기대 {expected}", file=sys.stderr)
    print(f"{len(cases) - len(failures)}/{len(cases)} 통과")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(self_test() if "--self-test" in sys.argv else 0)
