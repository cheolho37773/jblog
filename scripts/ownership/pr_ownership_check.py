#!/usr/bin/env python3
"""PR 단위 소유권 판정 (CI 필수 검사 ownership-check, 작업 M0-08).

규칙: docs/work/M0/tasks/M0-08.md 의 "PR 단위 소유권 판정 규칙" R1~R9, 협업 §5.2.
규칙 원본: scripts/ownership/roles.json (protected, shared, pr_common_allow, pr_contract_generated,
pr_contract_openapi, pr_orchestrator_allow, roles).

목적은 에이전트의 실수 방지다(협업 §5.2 "강제 방법과 한계"). 표준 라이브러리만 쓰고 Python 3.9에서 동작한다.

사용:
  python3 scripts/ownership/pr_ownership_check.py --base <sha> --head <sha> --branch <이름> [--contract-check-passed]

git·지시서(docs/work/*/tasks/*.md)·roles.json은 현재 작업 디렉터리(저장소 루트) 기준으로 읽는다.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Iterable, Mapping

from pr_common_allow import TASK_ID_PATTERN, compile_patterns

SCRIPT_DIR = Path(__file__).resolve().parent
HOOK_FILE = SCRIPT_DIR.parent / "hooks" / "check-ownership.py"
ROLES_RELATIVE_PATH = Path("scripts/ownership/roles.json")
ROLES_RULE_FILE = ROLES_RELATIVE_PATH.as_posix()
BRIEF_GLOB = "docs/work/*/tasks/*.md"

LOCK_FILE = "pnpm-lock.yaml"
# R5: 루트 package.json 또는 앱 폴더(frontend/·backend/) 한 단계 아래의 package.json
PACKAGE_JSON_PATTERN = re.compile(r"^(?:[^/]+/)?package\.json$")
# R9에서 제외하는 역할: 전체 허용(**)이라 넣으면 모든 경로가 통과한다. 오케스트레이터 경로는 R8이 맡는다.
ORCHESTRATOR_ROLE = "orchestrator"
ADDED = "A"

# 지시서 머리말(첫 '## ' 제목 전)의 '- ...' 줄에서 `브랜치: `<이름>`` 을 읽는다.
# 본문의 규칙 표·인계 노트에 나오는 브랜치 이름은 R1에 쓰지 않는다.
BRANCH_LINE_PATTERN = re.compile(r"브랜치:\s*`([^`\s]+)`")
ROLES_LINE_PATTERN = re.compile(r"^-\s*참여 역할:(.*)$", re.MULTILINE)
GIT_TIMEOUT_SECONDS = 60


def _load_hook_module():
    """R9를 훅(check-ownership.py)과 같은 의미로 판정하려고 훅의 함수를 그대로 쓴다.

    파일 이름에 하이픈이 있어 일반 import가 안 되므로 경로로 불러온다.
    """
    spec = importlib.util.spec_from_file_location("check_ownership_hook", HOOK_FILE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_HOOK = _load_hook_module()
matches_any = _HOOK.matches_any


# ---------------------------------------------------------------------------
# R1 작업 ID · R2 참여 역할 줄
# ---------------------------------------------------------------------------


def _brief_header_lines(brief_text: str) -> list[str]:
    """지시서 머리말: 첫 '## ' 제목 전까지의 '- ' 줄."""
    header: list[str] = []
    for line in brief_text.splitlines():
        if line.startswith("## "):
            break
        if line.startswith("- "):
            header.append(line)
    return header


def _branch_in_brief(brief_text: str) -> str | None:
    for line in _brief_header_lines(brief_text):
        match = BRANCH_LINE_PATTERN.search(line)
        if match:
            return match.group(1)
    return None


def _find_task_id_by_branch_line(branch: str, briefs: Mapping[str, str]) -> str | None:
    """R1-①: 머리말 `브랜치:` 줄이 브랜치 이름과 정확히 같은 지시서. 둘 이상이면 어느 쪽인지 정할 수 없다."""
    matched = sorted(task_id for task_id, text in briefs.items() if _branch_in_brief(text) == branch)
    if len(matched) > 1:
        raise ValueError(f"R1 브랜치 '{branch}'가 여러 지시서의 `브랜치:` 줄과 일치합니다: {', '.join(matched)}")
    return matched[0] if matched else None


def _branch_rest(branch: str) -> str | None:
    """브랜치 <유형>/<나머지>의 <나머지>. 유형이 없으면 None."""
    if "/" not in branch:
        return None
    return branch.split("/", 1)[1]


def _find_task_id_by_prefix(branch: str, task_ids: Iterable[str]) -> str | None:
    """R1-②: <유형>/<나머지>에서 <나머지>와 같거나 '<ID>-'로 시작하는 가장 긴 ID (시험용 브랜치 등)."""
    rest = _branch_rest(branch)
    if rest is None:
        return None
    candidates = [task_id for task_id in task_ids if rest == task_id or rest.startswith(f"{task_id}-")]
    return max(candidates, key=len) if candidates else None


def find_task_id(branch: str, briefs: Mapping[str, str]) -> str | None:
    """R1. briefs는 작업 ID → 지시서 본문. `브랜치:` 줄 정확 일치가 여러 개면 ValueError."""
    exact = _find_task_id_by_branch_line(branch, briefs)
    if exact is not None:
        return exact
    return _find_task_id_by_prefix(branch, briefs.keys())


def parse_participating_roles(brief_text: str) -> list[str]:
    """R2: '- 참여 역할: a, b' 줄(쉼표 구분). 줄이 없으면 빈 목록."""
    match = ROLES_LINE_PATTERN.search(brief_text)
    if not match:
        return []
    return [role.strip() for role in match.group(1).split(",") if role.strip()]


# ---------------------------------------------------------------------------
# R2~R9 판정 (경로별)
# ---------------------------------------------------------------------------


class _PrContext:
    """한 PR의 판정에 필요한 값을 묶는다 (규칙 함수의 인자 수를 줄이려고)."""

    def __init__(self, *, branch, task_id, roles, rules, contract_check_passed, changed_paths):
        self.branch = branch
        self.task_id = task_id
        self.roles = roles
        self.rules = rules
        self.contract_check_passed = contract_check_passed
        self.package_json_changed = any(PACKAGE_JSON_PATTERN.match(path) for path in changed_paths)
        common_regex = rules["pr_common_allow"]["regex"]
        self.common_patterns = compile_patterns(common_regex, task_id) if task_id else []
        self.review_record_id = task_id or _plan_review_id(branch)
        self.review_record_patterns = (
            compile_patterns(common_regex, self.review_record_id) if self.review_record_id else []
        )

    def is_common_allowed(self, path: str) -> bool:
        return any(pattern.match(path) for pattern in self.common_patterns)

    def is_review_record_allowed(self, path: str) -> bool:
        """R3: 이 PR의 검수 기록 경로인가. 작업 ID가 없으면 브랜치 <나머지>를 ID로 쓴다(④ 결정 2)."""
        return any(pattern.match(path) for pattern in self.review_record_patterns)


def _plan_review_id(branch: str) -> str | None:
    """④ 결정 2: 지시서 없는 기획 PR(docs/M0-structure 등)의 검수 기록 ID = 브랜치 <나머지>.

    scripts/codex-review.sh --plan이 docs/plan/feedback/<날짜>_<나머지>[_r<N>].md를 만들기 때문이다.
    R3(보호 경로)에서만 쓰므로 공통 허용 정규식 중 지시서 경로는 대상이 되지 않는다(보호 경로와 겹치지 않음).
    작업 ID 형식에 맞지 않는 <나머지>(슬래시 포함 등)는 쓰지 않는다.
    """
    rest = _branch_rest(branch)
    if rest is None or not TASK_ID_PATTERN.match(rest):
        return None
    return rest


def _check_participating_roles(task_id, roles, brief_found, rules) -> list[str]:
    """R2: 지시서가 있으면 참여 역할 줄이 있어야 하고, 모든 역할이 roles.json에 있어야 한다."""
    if not brief_found:
        return []
    if not roles:
        return [f"{task_id} 지시서: R2 '- 참여 역할:' 줄이 없거나 비어 있습니다"]
    known_roles = rules["roles"]
    return [f"{task_id} 지시서: R2 roles.json에 없는 역할 '{role}'" for role in roles if role not in known_roles]


def _protected_history(changes, commits, rules) -> dict[str, set[str]]:
    """R3 대상 경로별로 모든 커밋(과 PR 전체 diff)에서 관찰된 상태 집합."""
    protected_patterns = rules["protected"]["patterns"]
    history: dict[str, set[str]] = {}
    for status, path in [*changes, *(entry for commit in commits for entry in commit)]:
        if matches_any(path, protected_patterns):
            history.setdefault(path, set()).add(status)
    return history


def _check_codex_results(changes, commits, context: _PrContext) -> list[str]:
    """R3 Codex 결과 보호: 모든 커밋에서 추가만, 그리고 이 작업 ID의 공통 허용 경로만."""
    violations = []
    for path, statuses in sorted(_protected_history(changes, commits, context.rules).items()):
        if statuses != {ADDED}:
            changed = ", ".join(sorted(statuses - {ADDED}))
            violations.append(f"{path}: R3 Codex 검수 결과는 추가만 허용합니다 (커밋 이력에 {changed})")
        elif not context.is_review_record_allowed(path):
            owner = context.review_record_id or "작업 ID 없음"
            violations.append(f"{path}: R3 이 PR({owner})의 검수 결과 경로가 아닙니다")
    return violations


def _is_common_or_shared(path: str, context: _PrContext) -> bool:
    """R4 공통 허용: 이 작업 ID의 기록 경로 + shared(지시서 인계 노트)."""
    return context.is_common_allowed(path) or matches_any(path, context.rules["shared"]["patterns"])


def _check_lock_file(path: str, context: _PrContext) -> str | None:
    """R5: 잠금 파일은 package.json과 짝일 때만. 여기서 판정을 끝낸다(R9 재적용 없음)."""
    if context.package_json_changed:
        return None
    return f"{path}: R5 package.json 변경 없이 잠금 파일만 바뀌었습니다"


def _is_contract_branch(branch: str, rule: dict) -> bool:
    return branch.startswith(rule["branch_prefix"])


def _check_contract_generated(path: str, context: _PrContext) -> str | None:
    """R6: 계약 생성물은 contract/ 브랜치 + 생성 결과 일치 검사 통과일 때만 (역할 범위와 무관)."""
    rule = context.rules["pr_contract_generated"]
    if _is_contract_branch(context.branch, rule) and context.contract_check_passed:
        return None
    return f"{path}: R6 생성물은 contract/ 브랜치에서 생성 결과 일치 검사가 통과할 때만 바꿀 수 있습니다"


def _check_openapi_contract(path: str, context: _PrContext) -> str | None:
    """R7: OpenAPI 계약 원본은 contract/ 브랜치 + 참여 역할에 backend-dev가 있을 때만."""
    rule = context.rules["pr_contract_openapi"]
    if _is_contract_branch(context.branch, rule) and rule["required_role"] in context.roles:
        return None
    return f"{path}: R7 OpenAPI 계약은 contract/ 브랜치에서 {rule['required_role']}가 참여할 때만 바꿀 수 있습니다"


def _check_role_scope(path: str, context: _PrContext) -> str | None:
    """R9: 참여 역할 중 하나라도 허용하면 통과. allow/deny/allow_after_deny 의미는 훅과 같다."""
    known_roles = context.rules["roles"]
    scope_roles = [role for role in context.roles if role != ORCHESTRATOR_ROLE and role in known_roles]
    if any(_HOOK.is_allowed(path, role, context.rules)[0] for role in scope_roles):
        return None
    roles_text = ", ".join(context.roles) if context.roles else "없음"
    return f"{path}: R9 참여 역할({roles_text})의 쓰기 범위 밖입니다"


def _check_changed_path(path: str, context: _PrContext) -> str | None:
    """보호 경로(R3)를 뺀 PR 변경 경로 하나를 R4~R9 순서로 판정한다. 먼저 맞는 규칙에서 끝난다."""
    rules = context.rules
    if _is_common_or_shared(path, context):
        return None  # R4
    if path == LOCK_FILE:
        return _check_lock_file(path, context)  # R5
    if matches_any(path, rules["pr_contract_generated"]["patterns"]):
        return _check_contract_generated(path, context)  # R6
    if matches_any(path, rules["pr_contract_openapi"]["patterns"]):
        return _check_openapi_contract(path, context)  # R7
    if matches_any(path, rules["pr_orchestrator_allow"]["patterns"]):
        return None  # R8
    return _check_role_scope(path, context)  # R9


def check_pr(
    *,
    changes: list[tuple[str, str]],
    commits: list[list[tuple[str, str]]],
    branch: str,
    task_id: str | None,
    roles: list[str],
    brief_found: bool,
    rules: dict,
    contract_check_passed: bool,
) -> list[str]:
    """R2~R9. 위반 메시지 목록(빈 목록 = 통과). 각 메시지는 경로(또는 지시서)와 규칙 번호를 담는다."""
    context = _PrContext(
        branch=branch,
        task_id=task_id,
        roles=roles,
        rules=rules,
        contract_check_passed=contract_check_passed,
        changed_paths=[path for _, path in changes],
    )
    violations = _check_participating_roles(task_id, roles, brief_found, rules)
    violations += _check_codex_results(changes, commits, context)

    protected_patterns = rules["protected"]["patterns"]
    for path in sorted({path for _, path in changes}):
        if matches_any(path, protected_patterns):
            continue  # R3에서 판정을 마쳤다
        violation = _check_changed_path(path, context)
        if violation:
            violations.append(violation)
    return violations


# ---------------------------------------------------------------------------
# 규칙 확대 경고 (④ 결정 3, 실패가 아님)
# ---------------------------------------------------------------------------


def collect_warnings(
    *,
    changes: list[tuple[str, str]],
    task_id: str | None,
    briefs_before: Mapping[str, str],
    briefs_after: Mapping[str, str],
) -> list[str]:
    """PR이 자기 판정 규칙을 넓힐 수 있는 변경을 경고로 알린다(종료 코드에 영향 없음).

    판정은 head의 roles.json·지시서를 쓰므로(새 지시서를 같은 PR에 넣는 흐름 유지) 같은 PR에서
    규칙이나 이 작업의 참여 역할을 바꾸면 범위가 넓어질 수 있다. Codex 검수·개발자 Merge 확인에서 보게 한다.
    """
    warnings = []
    if any(path == ROLES_RULE_FILE for _, path in changes):
        warnings.append(f"경고: 이 PR이 판정 규칙 {ROLES_RULE_FILE}을 바꿉니다 (바뀐 규칙으로 판정함)")
    if task_id in briefs_before and task_id in briefs_after:
        roles_before = parse_participating_roles(briefs_before[task_id])
        roles_after = parse_participating_roles(briefs_after[task_id])
        if roles_before != roles_after:
            warnings.append(
                f"경고: 이 PR이 기존 지시서 {task_id}의 참여 역할을 바꿉니다 "
                f"({', '.join(roles_before) or '없음'} → {', '.join(roles_after) or '없음'}, 바뀐 역할로 판정함)"
            )
    return warnings


# ---------------------------------------------------------------------------
# git·파일 입력 수집 (main)
# ---------------------------------------------------------------------------


def _git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        capture_output=True,
        text=True,
        timeout=GIT_TIMEOUT_SECONDS,
        check=True,
    )
    return result.stdout


def _parse_name_status(output: str) -> list[tuple[str, str]]:
    """`--name-status -z --no-renames` 출력(상태\\0경로\\0...)을 (상태, 경로) 목록으로."""
    fields = [field for field in output.split("\0") if field]
    return [(fields[index][0], fields[index + 1]) for index in range(0, len(fields) - 1, 2)]


def _collect_changes(merge_base: str, head: str) -> list[tuple[str, str]]:
    """PR 전체 변경. 이름 변경은 삭제 + 추가로 본다(--no-renames)."""
    return _parse_name_status(_git("diff", "--name-status", "-z", "--no-renames", merge_base, head))


def _collect_commits(merge_base: str, head: str) -> list[list[tuple[str, str]]]:
    """커밋별 변경 (R3 커밋별 이력).

    --first-parent: 브랜치에 dev를 merge한 경우 dev 쪽 커밋(다른 작업의 검수 결과 추가 등)을 이 PR의
    이력으로 오인하지 않는다.
    --cc: merge 커밋은 기본 diff-tree가 아무것도 출력하지 않는다. --cc는 모든 부모와 다른 경로, 즉 merge
    결과에서 직접 고친 경로(evil merge)만 보여 준다(④ 결정 1). 상태는 부모별 글자('MA' 등)이고 첫 글자가
    첫 번째 부모(이 브랜치) 대비 상태라 그대로 쓴다. 일반 커밋에서는 --cc가 보통 diff와 같다.
    """
    revisions = _git("rev-list", "--reverse", "--first-parent", f"{merge_base}..{head}").split()
    return [
        _parse_name_status(
            _git("diff-tree", "--cc", "--no-commit-id", "-r", "-z", "--name-status", "--no-renames", revision)
        )
        for revision in revisions
    ]


def _load_briefs(root: Path) -> dict[str, str]:
    return {path.stem: path.read_text(encoding="utf-8") for path in sorted(root.glob(BRIEF_GLOB))}


def _load_brief_at(revision: str, root: Path, task_id: str | None) -> dict[str, str]:
    """④ 결정 3: merge-base 쪽 이 작업의 지시서(경고 비교용). 그때 없던 지시서(새 작업)면 빈 dict."""
    if task_id is None:
        return {}
    for path in root.glob(BRIEF_GLOB):
        if path.stem != task_id:
            continue
        relative = path.relative_to(root).as_posix()
        try:
            return {task_id: _git("show", f"{revision}:{relative}")}
        except subprocess.CalledProcessError:
            return {}
    return {}


def _load_rules(root: Path) -> dict:
    """작업 디렉터리의 roles.json(이 PR의 규칙). 없으면 스크립트 옆의 파일."""
    roles_file = root / ROLES_RELATIVE_PATH
    if not roles_file.is_file():
        roles_file = SCRIPT_DIR / "roles.json"
    return json.loads(roles_file.read_text(encoding="utf-8"))


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PR 단위 소유권 판정 (R1~R9)")
    parser.add_argument("--base", required=True, help="대상 브랜치 쪽 커밋 (merge-base를 계산한다)")
    parser.add_argument("--head", required=True, help="PR head 커밋")
    parser.add_argument("--branch", required=True, help="PR 브랜치 이름 (작업 ID 판정, contract/ 판정)")
    parser.add_argument(
        "--contract-check-passed",
        action="store_true",
        help="같은 CI에서 계약 생성 결과 일치 검사가 통과했음 (R6)",
    )
    return parser.parse_args(argv)


def _print_report(task_id, roles, violations, warnings) -> None:
    print(f"작업 ID: {task_id or '없음'} · 참여 역할: {', '.join(roles) if roles else '없음'}")
    for warning in warnings:
        print(f"- {warning}")
    if not violations:
        print("ownership-check 통과: 모든 변경이 R1~R9 안에 있습니다")
        return
    print(f"ownership-check 실패: 위반 {len(violations)}건")
    for violation in violations:
        print(f"- {violation}")


def main(argv: list[str]) -> int:
    args = _parse_args(argv)
    root = Path.cwd()
    briefs = _load_briefs(root)
    try:
        task_id = find_task_id(args.branch, briefs)
    except ValueError as error:
        print(f"ownership-check 실패: {error}")
        return 1

    roles = parse_participating_roles(briefs[task_id]) if task_id else []
    merge_base = _git("merge-base", args.base, args.head).strip()
    changes = _collect_changes(merge_base, args.head)
    violations = check_pr(
        changes=changes,
        commits=_collect_commits(merge_base, args.head),
        branch=args.branch,
        task_id=task_id,
        roles=roles,
        brief_found=task_id is not None,
        rules=_load_rules(root),
        contract_check_passed=args.contract_check_passed,
    )
    warnings = collect_warnings(
        changes=changes,
        task_id=task_id,
        briefs_before=_load_brief_at(merge_base, root, task_id),
        briefs_after=briefs,
    )
    _print_report(task_id, roles, violations, warnings)
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
