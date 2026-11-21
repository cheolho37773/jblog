"""PR 단위 소유권 판정(CI ownership-check) 테스트 (작업 M0-08, Issue #21).

기준: docs/work/M0/tasks/M0-08.md 의 "PR 단위 소유권 판정 규칙"(R1~R9)과
"판정 스크립트 인터페이스", 협업 §5.2. 구현(scripts/ownership/pr_ownership_check.py)을
보기 전에 작성했다.

규칙 원본은 실제 scripts/ownership/roles.json 을 읽는다. R8의 pr_orchestrator_allow가
아직 없으면 테스트가 지시서의 R8 경로로 채워 넣는다(이미 있으면 실제 값을 쓴다).
git 연동(main) 테스트는 임시 디렉터리에 별도 저장소를 만들고, 이 저장소의 git 상태는 건드리지 않는다.
"""
import contextlib
import copy
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
OWNERSHIP_DIR = REPO_ROOT / "scripts" / "ownership"
ROLES_FILE = OWNERSHIP_DIR / "roles.json"
REAL_BRIEF_FILE = REPO_ROOT / "docs" / "work" / "M0" / "tasks" / "M0-08.md"

sys.path.insert(0, str(OWNERSHIP_DIR))
import pr_ownership_check as checker  # noqa: E402  (구현 전에는 여기서 실패하는 것이 정상)

# 지시서 R8의 오케스트레이터 경로. ③이 roles.json에 pr_orchestrator_allow를 추가하면 그 값을 쓴다.
ORCHESTRATOR_PATTERNS = [
    "docs/**",
    "README.md",
    "CLAUDE.md",
    "AGENTS.md",
    ".claude/**",
    "scripts/ownership/roles.json",
]

TASK_ID = "M0-08"
TASK_BRANCH = "chore/M0-08-ci"
TASK_BRIEF = "docs/work/M0/tasks/M0-08.md"
OTHER_TASK_BRIEF = "docs/work/M0/tasks/M0-07.md"
CONTRACT_TASK_ID = "M0-07"
CONTRACT_BRANCH = "contract/M0-07-api-types"
GENERATED_FILE = "frontend/src/generated/api-types.ts"
OPENAPI_FILE = "backend/openapi.json"
LOCK_FILE = "pnpm-lock.yaml"
BACKEND_SOURCE = "backend/src/dummy.ts"
FRONTEND_PAGE = "frontend/src/app/page.tsx"
FRONTEND_SPEC = "frontend/src/app/page.spec.tsx"
CODEX_RESULT = "docs/reviews/M0-08/r1.codex.md"
REVIEW_RESPONSE = "docs/reviews/M0-08/r1.response.md"
OTHER_TASK_CODEX_RESULT = "docs/reviews/M0-07/r1.codex.md"
FEEDBACK_FILE = "docs/plan/feedback/2026-11-21_M0-08.md"
CODEX_RESULT_EXISTING = "docs/reviews/M0-08/r0.codex.md"
# 지시서가 없는 계약 브랜치: 작업 ID가 없어도 R6은 참여 역할과 무관하게 판정된다
BRIEFLESS_CONTRACT_BRANCH = "contract/M9-99-dummy"
# main 시험용 더미 지시서: `브랜치:` 줄 정확 일치(R1-①)로만 찾을 수 있는 브랜치
EXACT_BRANCH = "feat/dummy-exact-branch"
EXACT_BRANCH_BRIEF = "docs/work/M9/tasks/M9-01.md"
DUPLICATED_BRANCH = "feat/dummy-duplicated-branch"
DUPLICATED_BRANCH_BRIEFS = ["docs/work/M9/tasks/M9-02.md", "docs/work/M9/tasks/M9-03.md"]
TRIAL_BRANCH = "chore/M0-08-ci-trial"

KNOWN_TASK_IDS = ["M0-01", "M0-04", "M0-04-fix", "M0-07", "M0-08"]  # 접두사 규칙(R1-②) 시험용


def load_rules() -> dict:
    rules = json.loads(ROLES_FILE.read_text(encoding="utf-8"))
    rules.setdefault("pr_orchestrator_allow", {"patterns": list(ORCHESTRATOR_PATTERNS)})
    return rules


RULES = load_rules()


def run_check(
    changes,
    *,
    commits=None,
    branch=TASK_BRANCH,
    task_id=TASK_ID,
    roles=("test-engineer",),
    brief_found=True,
    contract_check_passed=False,
):
    """check_pr 호출 도우미. commits를 주지 않으면 PR 전체 변경을 커밋 1개로 본다."""
    return checker.check_pr(
        changes=list(changes),
        commits=[list(changes)] if commits is None else [list(commit) for commit in commits],
        branch=branch,
        task_id=task_id,
        roles=list(roles),
        brief_found=brief_found,
        rules=copy.deepcopy(RULES),
        contract_check_passed=contract_check_passed,
    )


def run_check_without_brief(changes, **kwargs):
    """지시서 없는 PR(기획 문서 PR 등): 작업 ID·참여 역할 없음."""
    return run_check(changes, branch="docs/M0-structure", task_id=None, roles=(), brief_found=False, **kwargs)


class ViolationAssertions(unittest.TestCase):
    def assertPasses(self, violations):
        self.assertEqual(violations, [], f"통과해야 하지만 위반이 보고됨: {violations}")

    def assertViolation(self, violations, path, rule):
        """경로와 규칙 번호를 함께 담은 위반 메시지가 하나 이상 있어야 한다."""
        matching = [message for message in violations if path in message and rule in message]
        self.assertTrue(matching, f"{rule} 위반({path})이 보고되어야 함. 실제: {violations}")


def dummy_brief(branch=None) -> str:
    """실제 지시서 머리말 형식(`- 마일스톤: ... · 브랜치: `<이름>` (...)`)의 더미 본문."""
    branch_part = f" · 브랜치: `{branch}` (`dev`에서 생성)" if branch else ""
    return f"# 더미 작업\n\n- 마일스톤: M9 · 이슈: #0{branch_part}\n- 참여 역할: test-engineer\n"


def briefs_without_branch_line(task_ids) -> dict:
    """R1-②(접두사 규칙)만 시험하려고 `브랜치:` 줄이 없는 지시서들."""
    return {task_id: dummy_brief() for task_id in task_ids}


def real_briefs() -> dict:
    """저장소의 실제 지시서 전부 (작업 ID → 본문)."""
    return {
        path.stem: path.read_text(encoding="utf-8")
        for path in (REPO_ROOT / "docs" / "work").glob("*/tasks/*.md")
    }


BRANCH_LINE_BRIEFS = {
    "M0-04": dummy_brief("feat/M0-04-nest-foundation"),
    "M0-04-fix": dummy_brief("fix/M0-04-backend-env-file"),
    "M0-08": dummy_brief("chore/M0-08-ci"),
}


class FindTaskIdByBranchLineTest(unittest.TestCase):
    """R1-①: 지시서의 `브랜치:` 줄에 브랜치 이름이 정확히 적힌 지시서."""

    def test_브랜치_줄이_정확히_일치하면_접두사_규칙보다_우선(self):
        # 접두사 규칙만으로는 M0-04가 되는 브랜치
        self.assertEqual(checker.find_task_id("fix/M0-04-backend-env-file", BRANCH_LINE_BRIEFS), "M0-04-fix")

    def test_브랜치_줄_일치가_여러_개면_ValueError(self):
        briefs = {
            "M9-01": dummy_brief("feat/M9-shared-branch"),
            "M9-02": dummy_brief("feat/M9-shared-branch"),
        }
        with self.assertRaises(ValueError):
            checker.find_task_id("feat/M9-shared-branch", briefs)

    def test_브랜치_줄과_일치하지_않으면_접두사_규칙으로_판정(self):
        # 시험용 브랜치: 지시서의 chore/M0-08-ci 와 정확히 같지 않다
        self.assertEqual(checker.find_task_id("chore/M0-08-ci-trial", BRANCH_LINE_BRIEFS), "M0-08")

    def test_브랜치_줄의_일부와만_같으면_정확한_일치가_아님(self):
        # 'fix/M0-04-backend'는 'fix/M0-04-backend-env-file'의 앞부분일 뿐 -> 접두사 규칙으로 M0-04
        self.assertEqual(checker.find_task_id("fix/M0-04-backend", BRANCH_LINE_BRIEFS), "M0-04")

    def test_실제_지시서_형식에서_브랜치_이름을_읽음(self):
        # M0-04-fix.md 실제 본문만으로 판정 (접두사 규칙으로는 찾을 수 없는 ID)
        briefs = {"M0-04-fix": (REPO_ROOT / "docs/work/M0/tasks/M0-04-fix.md").read_text(encoding="utf-8")}
        self.assertEqual(checker.find_task_id("fix/M0-04-backend-env-file", briefs), "M0-04-fix")

    def test_실제_저장소_지시서_전체로_판정(self):
        # 본문 다른 곳(규칙 표, 인계 노트)에 브랜치 이름이 언급돼도 머리말의 `브랜치:` 줄만 기준
        briefs = real_briefs()
        expected = {
            "fix/M0-04-backend-env-file": "M0-04-fix",
            "feat/M0-04-nest-foundation": "M0-04",
            "chore/M0-08-ci": "M0-08",
            "chore/M0-08-ci-trial": "M0-08",
            "contract/M0-07-api-types": "M0-07",
        }
        for branch, task_id in expected.items():
            with self.subTest(branch=branch):
                self.assertEqual(checker.find_task_id(branch, briefs), task_id)


class FindTaskIdByPrefixTest(unittest.TestCase):
    """R1-②: 브랜치 <유형>/<나머지>에서 가장 긴 일치 ID."""

    def test_브랜치_나머지가_ID와_하이픈으로_시작하면_그_작업_ID(self):
        briefs = briefs_without_branch_line(KNOWN_TASK_IDS)
        self.assertEqual(checker.find_task_id("feat/M0-04-nest-foundation", briefs), "M0-04")

    def test_브랜치_나머지가_ID와_같으면_그_작업_ID(self):
        self.assertEqual(checker.find_task_id("chore/M0-08", briefs_without_branch_line(KNOWN_TASK_IDS)), "M0-08")

    def test_여러_ID가_맞으면_가장_긴_ID(self):
        # M0-04와 M0-04-fix가 모두 접두사로 맞는 브랜치
        briefs = briefs_without_branch_line(KNOWN_TASK_IDS)
        self.assertEqual(checker.find_task_id("fix/M0-04-fix-backend-env", briefs), "M0-04-fix")

    def test_지시서가_없는_브랜치는_작업_ID_없음(self):
        self.assertIsNone(checker.find_task_id("docs/M0-structure", briefs_without_branch_line(KNOWN_TASK_IDS)))

    def test_유형이_없는_브랜치는_작업_ID_없음(self):
        self.assertIsNone(checker.find_task_id("M0-04-nest-foundation", briefs_without_branch_line(KNOWN_TASK_IDS)))

    def test_비슷한_접두사의_ID를_혼동하지_않음(self):
        briefs = briefs_without_branch_line(["M0-1", "M0-10"])
        self.assertEqual(checker.find_task_id("feat/M0-10-search", briefs), "M0-10")
        self.assertEqual(checker.find_task_id("feat/M0-1-search", briefs), "M0-1")
        self.assertEqual(checker.find_task_id("feat/M0-10", briefs), "M0-10")
        self.assertIsNone(checker.find_task_id("feat/M0-100-search", briefs))
        self.assertIsNone(checker.find_task_id("feat/M0-1search", briefs))

    def test_지시서가_하나도_없으면_작업_ID_없음(self):
        self.assertIsNone(checker.find_task_id("feat/M0-04-nest-foundation", {}))


class ParseParticipatingRolesTest(unittest.TestCase):
    """R2 참여 역할 줄 파싱."""

    def test_쉼표로_구분된_역할을_공백_제거해_읽음(self):
        text = "# 제목\n\n- 마일스톤: M0\n- 참여 역할: backend-dev, test-engineer\n- 선택 이유: x\n"
        self.assertEqual(checker.parse_participating_roles(text), ["backend-dev", "test-engineer"])

    def test_불규칙한_공백도_제거함(self):
        text = "- 참여 역할:   backend-dev ,test-engineer  \n"
        self.assertEqual(checker.parse_participating_roles(text), ["backend-dev", "test-engineer"])

    def test_참여_역할_줄이_없으면_빈_목록(self):
        text = "# 제목\n\n- 마일스톤: M0\n- 실행 방식: 단일 실행\n"
        self.assertEqual(checker.parse_participating_roles(text), [])

    def test_실제_M0_08_지시서의_참여_역할(self):
        # 다른 줄 본문의 '"참여 역할" 줄' 같은 언급은 참여 역할 줄로 보지 않는다
        text = REAL_BRIEF_FILE.read_text(encoding="utf-8")
        self.assertEqual(
            checker.parse_participating_roles(text),
            ["test-engineer", "frontend-dev", "devops-engineer"],
        )


class ParticipatingRolesRuleTest(ViolationAssertions):
    """R2 판정: 지시서가 있는데 참여 역할 줄이 없거나 알 수 없는 역할이면 실패."""

    def test_지시서가_있는데_참여_역할이_없으면_위반(self):
        violations = run_check([("M", TASK_BRIEF)], roles=())
        self.assertTrue(any("R2" in message for message in violations), violations)

    def test_roles_json에_없는_역할이_있으면_위반(self):
        violations = run_check([("M", "backend/src/app.ts")], roles=("backend-dev", "designer"))
        self.assertTrue(any("R2" in message and "designer" in message for message in violations), violations)

    def test_지시서가_없으면_참여_역할_없음은_위반이_아님(self):
        self.assertPasses(run_check_without_brief([("M", "docs/plan/00_overview.md")]))


class CodexResultProtectionTest(ViolationAssertions):
    """R3 Codex 결과 보호: 모든 커밋에서 이 작업 ID 경로의 추가만 허용."""

    def test_이_작업의_검수_결과_추가는_통과(self):
        self.assertPasses(run_check([("A", CODEX_RESULT)]))

    def test_이_작업의_기획_검수_결과_추가는_통과(self):
        self.assertPasses(run_check([("A", FEEDBACK_FILE)]))

    def test_추가_후_이후_커밋에서_수정하면_위반(self):
        # PR 전체 diff로는 '추가'로 보이지만 커밋별 이력에 수정이 있다
        violations = run_check(
            [("A", CODEX_RESULT)],
            commits=[[("A", CODEX_RESULT)], [("M", CODEX_RESULT)]],
        )
        self.assertViolation(violations, CODEX_RESULT, "R3")

    def test_기존_검수_결과_수정은_위반(self):
        self.assertViolation(run_check([("M", CODEX_RESULT_EXISTING)]), CODEX_RESULT_EXISTING, "R3")

    def test_다른_작업_ID의_검수_결과_추가는_위반(self):
        self.assertViolation(run_check([("A", OTHER_TASK_CODEX_RESULT)]), OTHER_TASK_CODEX_RESULT, "R3")

    def test_다른_작업_ID의_기획_검수_결과_추가는_위반(self):
        other_feedback = "docs/plan/feedback/2026-11-21_M0-07.md"
        self.assertViolation(run_check([("A", other_feedback)]), other_feedback, "R3")

    def test_피드백_파일_수정은_위반(self):
        self.assertViolation(run_check([("M", FEEDBACK_FILE)]), FEEDBACK_FILE, "R3")

    def test_검수_결과_삭제는_위반(self):
        self.assertViolation(run_check([("D", CODEX_RESULT)]), CODEX_RESULT, "R3")

    def test_피드백_파일_삭제는_위반(self):
        self.assertViolation(run_check([("D", FEEDBACK_FILE)]), FEEDBACK_FILE, "R3")

    def test_추가_후_삭제해_PR_diff에_없어도_위반(self):
        violations = run_check([], commits=[[("A", CODEX_RESULT)], [("D", CODEX_RESULT)]])
        self.assertViolation(violations, CODEX_RESULT, "R3")

    def test_지시서_없는_PR의_검수_결과_추가는_위반(self):
        # 작업 ID가 없으면 맞는 공통 허용 경로가 없고, R8의 docs/**는 R3 대상을 제외한다
        self.assertViolation(run_check_without_brief([("A", CODEX_RESULT)]), CODEX_RESULT, "R3")


class CommonAllowTest(ViolationAssertions):
    """R4 공통 허용: 참여 역할과 무관하게 이 작업 ID의 기록과 shared 경로."""

    def test_이_작업_지시서_수정은_통과(self):
        self.assertPasses(run_check([("M", TASK_BRIEF)], roles=("frontend-dev",)))

    def test_이_작업_검수_대응_기록은_통과(self):
        self.assertPasses(run_check([("A", REVIEW_RESPONSE)], roles=("frontend-dev",)))

    def test_다른_작업의_지시서_인계_노트는_shared라_통과(self):
        self.assertPasses(run_check([("M", OTHER_TASK_BRIEF)], roles=("frontend-dev",)))


class LockFileRuleTest(ViolationAssertions):
    """R5 잠금 파일: package.json 변경과 짝을 이룰 때만."""

    def test_잠금_파일만_바뀌면_위반(self):
        violations = run_check([("M", LOCK_FILE)], roles=("backend-dev",))
        self.assertViolation(violations, LOCK_FILE, "R5")

    def test_backend_package_json과_함께면_통과(self):
        self.assertPasses(run_check([("M", "backend/package.json"), ("M", LOCK_FILE)], roles=("backend-dev",)))

    def test_루트_package_json과_함께면_통과(self):
        self.assertPasses(run_check([("M", "package.json"), ("M", LOCK_FILE)], roles=("devops-engineer",)))

    def test_package_json과_짝이면_잠금_파일은_R5에서_판정이_끝남(self):
        # test-engineer는 pnpm-lock.yaml도 backend/package.json도 허용하지 않는다.
        # package.json은 R9 위반이지만, 잠금 파일은 R9를 다시 적용하지 않으므로 위반 목록에 없어야 한다
        violations = run_check([("M", "backend/package.json"), ("M", LOCK_FILE)], roles=("test-engineer",))
        self.assertViolation(violations, "backend/package.json", "R9")
        self.assertFalse(any(LOCK_FILE in message for message in violations), violations)

    def test_지시서_없는_PR에서도_잠금_파일만_바뀌면_위반(self):
        self.assertViolation(run_check_without_brief([("M", LOCK_FILE)]), LOCK_FILE, "R5")


class ContractGeneratedRuleTest(ViolationAssertions):
    """R6 계약 생성물: contract/ 브랜치 + 생성 검사 통과일 때만, 역할 범위와 무관."""

    def test_일반_브랜치에서는_frontend_dev가_참여해도_위반(self):
        violations = run_check(
            [("M", GENERATED_FILE)],
            roles=("frontend-dev", "test-engineer"),
            contract_check_passed=True,
        )
        self.assertViolation(violations, GENERATED_FILE, "R6")

    def test_contract_브랜치이고_생성_검사_통과면_역할과_무관하게_통과(self):
        violations = run_check(
            [("M", GENERATED_FILE)],
            branch=CONTRACT_BRANCH,
            task_id=CONTRACT_TASK_ID,
            roles=("backend-dev",),
            contract_check_passed=True,
        )
        self.assertPasses(violations)

    def test_contract_브랜치라도_생성_검사_미통과면_위반(self):
        violations = run_check(
            [("M", GENERATED_FILE)],
            branch=CONTRACT_BRANCH,
            task_id=CONTRACT_TASK_ID,
            roles=("backend-dev", "frontend-dev"),
            contract_check_passed=False,
        )
        self.assertViolation(violations, GENERATED_FILE, "R6")


class OpenApiContractRuleTest(ViolationAssertions):
    """R7 OpenAPI 계약: contract/ 브랜치 + backend-dev 참여일 때만."""

    def test_일반_브랜치에서는_backend_dev가_참여해도_위반(self):
        self.assertViolation(run_check([("M", OPENAPI_FILE)], roles=("backend-dev",)), OPENAPI_FILE, "R7")

    def test_contract_브랜치이고_backend_dev_참여면_통과(self):
        violations = run_check(
            [("M", OPENAPI_FILE)],
            branch=CONTRACT_BRANCH,
            task_id=CONTRACT_TASK_ID,
            roles=("backend-dev", "test-engineer"),
        )
        self.assertPasses(violations)

    def test_contract_브랜치라도_backend_dev가_없으면_위반(self):
        violations = run_check(
            [("M", OPENAPI_FILE)],
            branch=CONTRACT_BRANCH,
            task_id=CONTRACT_TASK_ID,
            roles=("frontend-dev", "devops-engineer"),
            contract_check_passed=True,
        )
        self.assertViolation(violations, OPENAPI_FILE, "R7")


class OrchestratorPathsTest(ViolationAssertions):
    """R8 오케스트레이터 경로: 모든 PR에서 허용."""

    ORCHESTRATOR_FILES = [
        "docs/plan/00_overview.md",
        "README.md",
        "CLAUDE.md",
        "AGENTS.md",
        ".claude/skills/x/SKILL.md",
        "scripts/ownership/roles.json",
    ]

    def test_지시서_없는_PR에서도_통과(self):
        for path in self.ORCHESTRATOR_FILES:
            with self.subTest(path=path):
                self.assertPasses(run_check_without_brief([("M", path)]))

    def test_참여_역할_범위_밖이어도_통과(self):
        changes = [("M", path) for path in self.ORCHESTRATOR_FILES]
        self.assertPasses(run_check(changes, roles=("frontend-dev",)))

    def test_새_파일_추가와_삭제도_통과(self):
        self.assertPasses(run_check_without_brief([("A", "docs/work/M9/plan.md"), ("D", "docs/plan/old.md")]))


class RoleScopeRuleTest(ViolationAssertions):
    """R9 역할 범위: 참여 역할 범위의 합집합(훅과 같은 allow/deny/allow_after_deny 의미)."""

    def test_범위_밖_코드_변경은_위반(self):
        self.assertViolation(run_check([("M", BACKEND_SOURCE)], roles=("frontend-dev",)), BACKEND_SOURCE, "R9")

    def test_범위_밖_파일_삭제도_위반(self):
        self.assertViolation(run_check([("D", BACKEND_SOURCE)], roles=("frontend-dev",)), BACKEND_SOURCE, "R9")

    def test_범위_안_코드_변경은_통과(self):
        self.assertPasses(run_check([("M", FRONTEND_PAGE)], roles=("frontend-dev",)))

    def test_한_역할의_deny는_다른_참여_역할이_허용하면_통과(self):
        self.assertViolation(run_check([("A", FRONTEND_SPEC)], roles=("frontend-dev",)), FRONTEND_SPEC, "R9")
        self.assertPasses(run_check([("A", FRONTEND_SPEC)], roles=("frontend-dev", "test-engineer")))

    def test_allow_after_deny는_deny보다_우선(self):
        support_file = "backend/test/support/db.ts"
        # backend-dev: backend/test/** deny 이지만 backend/test/support/** 는 allow_after_deny
        self.assertPasses(run_check([("M", support_file)], roles=("backend-dev",)))
        # test-engineer: backend/test/** allow 이지만 backend/test/support/** deny
        self.assertViolation(run_check([("M", support_file)], roles=("test-engineer",)), support_file, "R9")

    def test_allow_after_deny_밖의_deny_경로는_위반(self):
        test_file = "backend/test/posts.e2e-spec.ts"
        self.assertViolation(run_check([("M", test_file)], roles=("backend-dev",)), test_file, "R9")

    def test_테스트_설정_파일은_devops_engineer가_참여할_때만(self):
        setup_file = "backend/test/setup-integration.ts"
        self.assertViolation(run_check([("M", setup_file)], roles=("test-engineer",)), setup_file, "R9")
        self.assertPasses(run_check([("M", setup_file)], roles=("test-engineer", "devops-engineer")))

    def test_orchestrator_역할의_전체_허용은_R9에_쓰지_않음(self):
        violations = run_check([("M", BACKEND_SOURCE)], roles=("orchestrator",))
        self.assertViolation(violations, BACKEND_SOURCE, "R9")

    def test_지시서_없는_PR에서_코드_변경은_위반(self):
        self.assertViolation(run_check_without_brief([("M", BACKEND_SOURCE)]), BACKEND_SOURCE, "R9")


class DevopsOnlyPathsTest(ViolationAssertions):
    """R9 회귀(④ 독립 검증 보강): CI·루트 도구 설정은 devops-engineer가 참여할 때만."""

    DEVOPS_ONLY_FILES = [
        ".github/workflows/ci.yml",
        ".github/actions/setup-workspace/action.yml",
        "package.json",
        "turbo.json",
        "pnpm-workspace.yaml",
        ".gitignore",
        ".dockerignore",
        "tsconfig.base.json",
        "backend/Dockerfile",
        "frontend/Dockerfile",
        "frontend/playwright.config.ts",
        "scripts/ownership/pr_ownership_check.py",
        "scripts/hooks/check-ownership.py",
    ]
    APP_ROLES = ("backend-dev", "frontend-dev", "test-engineer", "docs-writer")

    def test_앱_역할만_참여하면_위반(self):
        for path in self.DEVOPS_ONLY_FILES:
            with self.subTest(path=path):
                self.assertViolation(run_check([("M", path)], roles=self.APP_ROLES), path, "R9")

    def test_devops_engineer가_참여하면_통과(self):
        for path in self.DEVOPS_ONLY_FILES:
            with self.subTest(path=path):
                self.assertPasses(run_check([("M", path)], roles=("devops-engineer",)))

    def test_지시서_없는_PR에서_CI_설정_변경은_위반(self):
        self.assertViolation(run_check_without_brief([("M", ".github/workflows/ci.yml")]), ".github/workflows/ci.yml", "R9")

    def test_devops_engineer도_테스트_코드는_못_바꿈(self):
        path = "scripts/tests/test_dummy.py"
        self.assertViolation(run_check([("A", path)], roles=("devops-engineer",)), path, "R9")


class PlanPrReviewRecordsTest(ViolationAssertions):
    """R3 보완(④ 결정 2): 작업 ID가 없으면 브랜치 <나머지>를 기획 검수 기록의 공통 허용 ID로 쓴다.

    scripts/codex-review.sh --plan 이 docs/plan/feedback/<날짜>_<나머지>[_r<N>].md 를 만든다.
    """

    PLAN_BRANCH = "docs/M0-structure"
    PLAN_FEEDBACK = "docs/plan/feedback/2026-11-21_M0-structure.md"
    PLAN_FEEDBACK_ROUND = "docs/plan/feedback/2026-11-21_M0-structure_r2.md"
    PLAN_REVIEW_RESULT = "docs/reviews/M0-structure/r1.codex.md"

    def check_plan_pr(self, changes, commits=None, branch=PLAN_BRANCH):
        return run_check(changes, commits=commits, branch=branch, task_id=None, roles=(), brief_found=False)

    def test_브랜치_나머지_이름의_피드백_추가는_통과(self):
        self.assertPasses(self.check_plan_pr([("A", self.PLAN_FEEDBACK), ("A", self.PLAN_FEEDBACK_ROUND)]))

    def test_브랜치_나머지_이름의_검수_결과_추가는_통과(self):
        self.assertPasses(self.check_plan_pr([("A", self.PLAN_REVIEW_RESULT)]))

    def test_브랜치_나머지_이름의_피드백도_수정하면_위반(self):
        self.assertViolation(self.check_plan_pr([("M", self.PLAN_FEEDBACK)]), self.PLAN_FEEDBACK, "R3")

    def test_추가_후_다음_커밋에서_수정하면_위반(self):
        violations = self.check_plan_pr(
            [("A", self.PLAN_FEEDBACK)],
            commits=[[("A", self.PLAN_FEEDBACK)], [("M", self.PLAN_FEEDBACK)]],
        )
        self.assertViolation(violations, self.PLAN_FEEDBACK, "R3")

    def test_다른_이름의_피드백_추가는_위반(self):
        for path in [
            "docs/plan/feedback/2026-11-21_plan_review_05.md",
            "docs/plan/feedback/2026-11-21_M0.md",
            "docs/plan/feedback/2026-11-21_M0-structure-extra.md",
        ]:
            with self.subTest(path=path):
                self.assertViolation(self.check_plan_pr([("A", path)]), path, "R3")

    def test_다른_이름의_검수_결과_추가는_위반(self):
        path = "docs/reviews/M0-other/r1.codex.md"
        self.assertViolation(self.check_plan_pr([("A", path)]), path, "R3")

    def test_유형_없는_브랜치는_나머지가_없어_위반(self):
        self.assertViolation(
            self.check_plan_pr([("A", self.PLAN_FEEDBACK)], branch="M0-structure"), self.PLAN_FEEDBACK, "R3"
        )

    def test_작업_ID가_있으면_브랜치_나머지를_쓰지_않음(self):
        # chore/M0-08-ci 의 작업 ID는 M0-08: <나머지>(M0-08-ci) 이름의 기록은 공통 허용이 아니다
        for path in ["docs/plan/feedback/2026-11-21_M0-08-ci.md", "docs/reviews/M0-08-ci/r1.codex.md"]:
            with self.subTest(path=path):
                self.assertViolation(run_check([("A", path)]), path, "R3")
        self.assertPasses(run_check([("A", FEEDBACK_FILE)]))


ROLES_RULE_FILE = "scripts/ownership/roles.json"


def brief_with_roles(roles_line: str, extra: str = "") -> str:
    return f"# 더미\n\n- 마일스톤: M0 · 브랜치: `chore/M0-08-ci` (`dev`에서 생성)\n- 참여 역할: {roles_line}\n{extra}"


class CollectWarningsTest(unittest.TestCase):
    """④ 결정 3: PR이 자기 판정 규칙을 넓힐 수 있는 변경은 경고(실패 아님)."""

    BEFORE = {TASK_ID: brief_with_roles("test-engineer, frontend-dev")}

    def warnings(self, changes, briefs_after, briefs_before=None, task_id=TASK_ID):
        return checker.collect_warnings(
            changes=list(changes),
            task_id=task_id,
            briefs_before=self.BEFORE if briefs_before is None else briefs_before,
            briefs_after=briefs_after,
        )

    def test_roles_json을_바꾸면_경고_1건(self):
        result = self.warnings([("M", ROLES_RULE_FILE)], briefs_after=self.BEFORE)
        self.assertEqual(len(result), 1, result)
        self.assertIn(ROLES_RULE_FILE, result[0])

    def test_기존_지시서의_참여_역할_줄을_바꾸면_경고_1건(self):
        after = {TASK_ID: brief_with_roles("test-engineer, frontend-dev, backend-dev")}
        result = self.warnings([("M", TASK_BRIEF)], briefs_after=after)
        self.assertEqual(len(result), 1, result)
        self.assertIn(TASK_ID, result[0])

    def test_두_가지가_함께면_경고_2건(self):
        after = {TASK_ID: brief_with_roles("backend-dev")}
        result = self.warnings([("M", ROLES_RULE_FILE), ("M", TASK_BRIEF)], briefs_after=after)
        self.assertEqual(len(result), 2, result)

    def test_참여_역할_줄이_같으면_다른_내용이_바뀌어도_경고_없음(self):
        after = {TASK_ID: brief_with_roles("test-engineer, frontend-dev", extra="\n## 인계 노트\n\n- 추가 기록\n")}
        self.assertEqual(self.warnings([("M", TASK_BRIEF)], briefs_after=after), [])

    def test_새_지시서_추가는_경고_없음(self):
        after = {**self.BEFORE, "M9-01": brief_with_roles("backend-dev")}
        result = self.warnings([("A", "docs/work/M9/tasks/M9-01.md")], briefs_after=after, task_id="M9-01")
        self.assertEqual(result, [])

    def test_관련_변경이_없으면_경고_없음(self):
        self.assertEqual(self.warnings([("M", FRONTEND_PAGE)], briefs_after=self.BEFORE), [])
        self.assertEqual(self.warnings([], briefs_after=self.BEFORE), [])


class ReportShapeTest(ViolationAssertions):
    """판정 결과 형식: 경로 + 규칙 번호, 여러 위반 동시 보고, 빈 PR 통과."""

    def test_여러_위반을_한_번에_모두_보고(self):
        violations = run_check(
            [("M", LOCK_FILE), ("M", BACKEND_SOURCE), ("M", GENERATED_FILE)],
            roles=("frontend-dev",),
        )
        self.assertViolation(violations, LOCK_FILE, "R5")
        self.assertViolation(violations, BACKEND_SOURCE, "R9")
        self.assertViolation(violations, GENERATED_FILE, "R6")

    def test_허용_경로와_위반_경로가_섞이면_위반_경로만_보고(self):
        violations = run_check([("M", FRONTEND_PAGE), ("M", BACKEND_SOURCE)], roles=("frontend-dev",))
        self.assertViolation(violations, BACKEND_SOURCE, "R9")
        self.assertFalse(any(FRONTEND_PAGE in message for message in violations), violations)

    def test_빈_PR은_통과(self):
        self.assertPasses(run_check([], commits=[]))


class MainGitIntegrationTest(unittest.TestCase):
    """main: 임시 git 저장소의 커밋으로 실제 입력 수집과 종료 코드를 확인한다.

    git과 지시서(docs/work/*/tasks/*.md)는 현재 작업 디렉터리(저장소 루트) 기준으로 읽는다.
    임시 저장소에는 실제 M0-08 지시서·roles.json 복사본과 `브랜치:` 줄 시험용 더미 지시서(M9-*)를 둔다.
    """

    GIT_TIMEOUT_SECONDS = 30

    def setUp(self):
        self.workdir = Path(tempfile.mkdtemp(prefix="jblog-ownership-"))
        self.addCleanup(shutil.rmtree, self.workdir, ignore_errors=True)
        self.git_env = {
            **os.environ,
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_AUTHOR_NAME": "Test Dummy",
            "GIT_AUTHOR_EMAIL": "dummy@example.invalid",
            "GIT_COMMITTER_NAME": "Test Dummy",
            "GIT_COMMITTER_EMAIL": "dummy@example.invalid",
        }
        self.git("init", "-q", "-b", "main")
        brief_text = REAL_BRIEF_FILE.read_text(encoding="utf-8")
        self.write(TASK_BRIEF, brief_text)
        self.write("scripts/ownership/roles.json", json.dumps(RULES, ensure_ascii=False, indent=2))
        self.write("README.md", "dummy\n")
        # R1-①: 접두사 규칙으로는 찾을 수 없는 브랜치 이름을 `브랜치:` 줄로만 연결한다
        self.write(EXACT_BRANCH_BRIEF, dummy_brief(EXACT_BRANCH).replace("test-engineer", "backend-dev"))
        for duplicated_brief in DUPLICATED_BRANCH_BRIEFS:
            self.write(duplicated_brief, dummy_brief(DUPLICATED_BRANCH))
        self.write(CODEX_RESULT_EXISTING, "dummy review\n")
        self.base = self.commit("base")

    def git(self, *args) -> str:
        result = subprocess.run(
            ["git", *args],
            cwd=self.workdir,
            env=self.git_env,
            capture_output=True,
            text=True,
            timeout=self.GIT_TIMEOUT_SECONDS,
            check=True,
        )
        return result.stdout.strip()

    def write(self, relative_path: str, content: str):
        target = self.workdir / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    def move(self, source: str, target: str):
        """이름 변경 (대상 폴더가 없어도 되도록 파일 시스템에서 옮긴 뒤 git add -A)."""
        destination = self.workdir / target
        destination.parent.mkdir(parents=True, exist_ok=True)
        (self.workdir / source).rename(destination)

    def commit(self, message: str) -> str:
        self.git("add", "-A")
        self.git("commit", "-q", "--no-verify", "--allow-empty", "-m", message)
        return self.git("rev-parse", "HEAD")

    def run_main(self, head: str, branch: str = TASK_BRANCH, contract_check_passed: bool = False):
        argv = ["--base", self.base, "--head", head, "--branch", branch]
        if contract_check_passed:
            argv.append("--contract-check-passed")
        output = io.StringIO()
        previous_cwd = os.getcwd()
        previous_env = dict(os.environ)
        os.chdir(self.workdir)
        os.environ.update(self.git_env)
        try:
            with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
                exit_code = checker.main(argv)
        finally:
            os.chdir(previous_cwd)
            os.environ.clear()
            os.environ.update(previous_env)
        return exit_code, output.getvalue()

    def test_참여_역할_범위_안의_커밋들은_종료_코드_0(self):
        self.write("scripts/tests/test_dummy.py", "# dummy\n")
        self.commit("test: 더미 테스트")
        self.write("frontend/src/app/page.tsx", "export default function Page() { return null; }\n")
        self.write(REVIEW_RESPONSE, "dummy response\n")
        head = self.commit("feat: 더미 페이지")
        exit_code, output = self.run_main(head)
        self.assertEqual(exit_code, 0, output)

    def test_범위_밖_변경이_있으면_종료_코드_1과_경로_규칙_출력(self):
        self.write("scripts/tests/test_dummy.py", "# dummy\n")
        self.commit("test: 더미 테스트")
        self.write(BACKEND_SOURCE, "export const dummy = 1;\n")
        head = self.commit("feat: 범위 밖 변경")
        exit_code, output = self.run_main(head)
        self.assertEqual(exit_code, 1, output)
        self.assertIn(BACKEND_SOURCE, output)
        self.assertIn("R9", output)

    def test_추가한_검수_결과를_다음_커밋에서_수정하면_종료_코드_1(self):
        self.write(CODEX_RESULT, "dummy review\n")
        self.commit("docs: 검수 결과 추가")
        self.write(CODEX_RESULT, "edited\n")
        head = self.commit("docs: 검수 결과 수정")
        exit_code, output = self.run_main(head)
        self.assertEqual(exit_code, 1, output)
        self.assertIn(CODEX_RESULT, output)
        self.assertIn("R3", output)

    def test_기존_검수_결과_이름_변경은_삭제로_보아_종료_코드_1(self):
        renamed = "docs/reviews/M0-08/r9.codex.md"
        self.git("mv", CODEX_RESULT_EXISTING, renamed)
        head = self.commit("docs: 검수 결과 이름 변경")
        exit_code, output = self.run_main(head)
        self.assertEqual(exit_code, 1, output)
        self.assertIn(CODEX_RESULT_EXISTING, output)
        self.assertIn("R3", output)

    def test_package_json_없는_잠금_파일_변경은_종료_코드_1(self):
        self.write(LOCK_FILE, "lockfileVersion: '9.0'\n")
        head = self.commit("chore: 잠금 파일만 변경")
        exit_code, output = self.run_main(head)
        self.assertEqual(exit_code, 1, output)
        self.assertIn("R5", output)

    def test_브랜치_줄로_찾은_지시서의_참여_역할로_판정(self):
        # M9-01 지시서(참여 역할 backend-dev)를 `브랜치:` 줄로만 찾을 수 있다
        self.write(BACKEND_SOURCE, "export const dummy = 1;\n")
        head = self.commit("feat: 백엔드 더미")
        exit_code, output = self.run_main(head, branch=EXACT_BRANCH)
        self.assertEqual(exit_code, 0, output)

    def test_시험용_브랜치는_접두사_규칙으로_작업_지시서를_찾음(self):
        # chore/M0-08-ci-trial -> M0-08 (참여 역할에 backend-dev 없음)
        self.write("scripts/tests/test_dummy.py", "# dummy\n")
        allowed_head = self.commit("test: 더미 테스트")
        allowed_code, allowed_output = self.run_main(allowed_head, branch=TRIAL_BRANCH)
        self.assertEqual(allowed_code, 0, allowed_output)
        self.write(BACKEND_SOURCE, "export const dummy = 1;\n")
        rejected_head = self.commit("feat: 범위 밖 변경")
        rejected_code, rejected_output = self.run_main(rejected_head, branch=TRIAL_BRANCH)
        self.assertEqual(rejected_code, 1, rejected_output)
        self.assertIn("R9", rejected_output)

    def test_브랜치_줄_일치가_여러_지시서면_종료_코드_1(self):
        self.write("README.md", "changed\n")
        head = self.commit("docs: README")
        exit_code, output = self.run_main(head, branch=DUPLICATED_BRANCH)
        self.assertEqual(exit_code, 1, output)
        self.assertIn("R1", output)

    def test_범위_밖_경로로_이름_변경하면_새_경로가_위반(self):
        self.write(FRONTEND_PAGE, "export default function Page() { return null; }\n")
        self.commit("feat: 페이지")
        base_for_rename = self.git("rev-parse", "HEAD")
        self.move(FRONTEND_PAGE, BACKEND_SOURCE)
        head = self.commit("refactor: 이름 변경")
        self.base = base_for_rename
        exit_code, output = self.run_main(head, branch=TRIAL_BRANCH)
        self.assertEqual(exit_code, 1, output)
        self.assertIn(BACKEND_SOURCE, output)
        self.assertIn("R9", output)

    def test_범위_밖_경로에서_이름_변경하면_삭제된_원래_경로가_위반(self):
        self.write(BACKEND_SOURCE, "export const dummy = 1;\n")
        self.commit("feat: 백엔드 더미")
        base_for_rename = self.git("rev-parse", "HEAD")
        self.move(BACKEND_SOURCE, "frontend/src/dummy.ts")
        head = self.commit("refactor: 이름 변경")
        self.base = base_for_rename
        exit_code, output = self.run_main(head)
        self.assertEqual(exit_code, 1, output)
        self.assertIn(BACKEND_SOURCE, output)
        self.assertIn("R9", output)

    def make_dev_with_other_review(self) -> str:
        """base에서 갈라진 dev 쪽 커밋: 다른 작업의 검수 결과 추가 (브랜치에 merge해 들여올 대상)."""
        self.git("checkout", "-q", "-b", "dummy-dev", self.base)
        self.write(OTHER_TASK_CODEX_RESULT, "other review\n")
        dev_head = self.commit("docs: 다른 작업 검수 결과")
        self.git("checkout", "-q", "main")
        return dev_head

    def test_dev를_merge해_들어온_다른_작업_검수_결과는_위반이_아님(self):
        dev_head = self.make_dev_with_other_review()
        self.write("scripts/tests/test_dummy.py", "# dummy\n")
        self.commit("test: 더미 테스트")
        self.git("merge", "-q", "--no-edit", "--no-verify", dev_head)
        head = self.git("rev-parse", "HEAD")
        self.base = dev_head  # CI: --base origin/dev
        # 전제: dev를 merge한 뒤의 merge-base는 dev 끝이다. 그래서 base..head의 모든 커밋을 보더라도
        # dev 쪽 커밋(다른 작업 ID의 검수 결과 추가 — 이 PR 커밋이었다면 R3 위반)은 범위에서 빠진다.
        self.assertEqual(self.git("merge-base", self.base, head), dev_head)
        self.assertNotIn(dev_head, self.git("rev-list", f"{self.base}..{head}").split())
        exit_code, output = self.run_main(head)
        self.assertEqual(exit_code, 0, output)
        self.assertNotIn(OTHER_TASK_CODEX_RESULT, output)

    # ④ 독립 검증에서 발견한 누락의 회귀 테스트: diff-tree 기본 출력은 merge 커밋을 비워 두므로
    # 커밋별 이력에 merge 결과에서 직접 고친 경로가 들어가는지 확인한다(④ 결정 1).
    def test_merge_커밋_안에서_이_작업_검수_결과를_고치면_위반(self):
        # 커밋별 이력에는 merge 커밋도 포함된다: merge 결과에서 직접 고친 내용(evil merge)도 '수정'이다
        dev_head = self.make_dev_with_other_review()
        self.write(CODEX_RESULT, "dummy review\n")
        self.commit("docs: 검수 결과 추가")
        self.git("merge", "-q", "--no-commit", "--no-ff", dev_head)
        self.write(CODEX_RESULT, "edited in merge\n")
        self.git("add", CODEX_RESULT)
        self.git("commit", "-q", "--no-verify", "--no-edit")
        head = self.git("rev-parse", "HEAD")
        self.base = dev_head
        exit_code, output = self.run_main(head)
        self.assertEqual(exit_code, 1, output)
        self.assertIn(CODEX_RESULT, output)
        self.assertIn("R3", output)

    def merge_side_branch_changing_review(self, change_on_side) -> str:
        """Codex r1 지적 재현: 이 작업의 검수 결과를 추가한 뒤, 거기서 갈라진 보조 브랜치에서 고치고 --no-ff merge.

        merge 결과가 두 번째 부모(보조 브랜치)와 같아 --cc에 나오지 않고, 보조 브랜치 커밋은
        --first-parent 이력에서 빠진다. PR 전체 diff에는 '추가'만 남거나(수정) 아무것도 남지 않는다(삭제).
        """
        self.write(CODEX_RESULT, "dummy review\n")
        self.commit("docs: 검수 결과 추가")
        self.git("checkout", "-q", "-b", "dummy-side")
        change_on_side()
        self.commit("docs: 보조 브랜치에서 검수 결과 변경")
        self.git("checkout", "-q", "main")
        self.write("scripts/tests/test_dummy.py", "# dummy\n")
        self.commit("test: 더미 테스트")
        self.git("merge", "-q", "--no-ff", "--no-edit", "dummy-side")
        return self.git("rev-parse", "HEAD")

    def test_보조_브랜치에서_검수_결과를_고쳐_merge하면_위반(self):
        head = self.merge_side_branch_changing_review(lambda: self.write(CODEX_RESULT, "edited on side\n"))
        exit_code, output = self.run_main(head)
        self.assertEqual(exit_code, 1, output)
        self.assertIn(CODEX_RESULT, output)
        self.assertIn("R3", output)

    def test_보조_브랜치에서_검수_결과를_지워_merge하면_위반(self):
        head = self.merge_side_branch_changing_review(lambda: (self.workdir / CODEX_RESULT).unlink())
        exit_code, output = self.run_main(head)
        self.assertEqual(exit_code, 1, output)
        self.assertIn(CODEX_RESULT, output)
        self.assertIn("R3", output)

    def test_규칙을_넓히는_변경은_경고를_출력하지만_종료_코드에_영향_없음(self):
        # ④ 결정 3: 판정은 head 기준(넓힌 참여 역할로 통과), 대신 경고를 출력한다
        briefs_before = {TASK_ID: (self.workdir / TASK_BRIEF).read_text(encoding="utf-8")}
        widened_rules = json.loads((self.workdir / ROLES_RULE_FILE).read_text(encoding="utf-8"))
        widened_rules["$comment"] = widened_rules.get("$comment", "") + " (더미 변경)"
        self.write(ROLES_RULE_FILE, json.dumps(widened_rules, ensure_ascii=False, indent=2))
        widened_brief = briefs_before[TASK_ID].replace(
            "- 참여 역할: test-engineer, frontend-dev, devops-engineer",
            "- 참여 역할: test-engineer, frontend-dev, devops-engineer, backend-dev",
        )
        self.assertNotEqual(widened_brief, briefs_before[TASK_ID], "M0-08 지시서의 참여 역할 줄 형식이 바뀌었다")
        self.write(TASK_BRIEF, widened_brief)
        self.write(BACKEND_SOURCE, "export const dummy = 1;\n")
        head = self.commit("chore: 규칙과 참여 역할 넓힘")
        exit_code, output = self.run_main(head)
        self.assertEqual(exit_code, 0, output)
        expected_warnings = checker.collect_warnings(
            changes=[("M", ROLES_RULE_FILE), ("M", TASK_BRIEF), ("A", BACKEND_SOURCE)],
            task_id=TASK_ID,
            briefs_before=briefs_before,
            briefs_after={TASK_ID: widened_brief},
        )
        self.assertEqual(len(expected_warnings), 2, expected_warnings)
        for warning in expected_warnings:
            self.assertIn(warning, output)

    def test_contract_브랜치_생성물은_생성_검사_통과_옵션이_있을_때만_종료_코드_0(self):
        self.write(GENERATED_FILE, "export type Dummy = never;\n")
        head = self.commit("chore: 생성 타입 갱신")
        passed_code, passed_output = self.run_main(head, branch=BRIEFLESS_CONTRACT_BRANCH, contract_check_passed=True)
        self.assertEqual(passed_code, 0, passed_output)
        failed_code, failed_output = self.run_main(head, branch=BRIEFLESS_CONTRACT_BRANCH)
        self.assertEqual(failed_code, 1, failed_output)
        self.assertIn("R6", failed_output)


if __name__ == "__main__":
    unittest.main()
