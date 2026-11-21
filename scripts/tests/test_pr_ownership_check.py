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

KNOWN_TASK_IDS = ["M0-01", "M0-04", "M0-04-fix", "M0-07", "M0-08"]


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


class FindTaskIdTest(unittest.TestCase):
    """R1 작업 ID: 브랜치 <유형>/<나머지>에서 가장 긴 일치 ID."""

    def test_브랜치_나머지가_ID와_하이픈으로_시작하면_그_작업_ID(self):
        self.assertEqual(checker.find_task_id("feat/M0-04-nest-foundation", KNOWN_TASK_IDS), "M0-04")

    def test_브랜치_나머지가_ID와_같으면_그_작업_ID(self):
        self.assertEqual(checker.find_task_id("chore/M0-08", KNOWN_TASK_IDS), "M0-08")

    def test_여러_ID가_맞으면_가장_긴_ID(self):
        # M0-04와 M0-04-fix가 모두 접두사로 맞는 브랜치
        self.assertEqual(checker.find_task_id("fix/M0-04-fix-backend-env", KNOWN_TASK_IDS), "M0-04-fix")

    @unittest.skip(
        "오케스트레이터 판정 대기: R1 문언으로는 'M0-04-backend-env-file'이 'M0-04-fix-'로 시작하지 않아 "
        "M0-04가 된다. 작업 지시 기대값(M0-04-fix)과 충돌"
    )
    def test_실제_M0_04_fix_브랜치는_M0_04_fix(self):
        self.assertEqual(checker.find_task_id("fix/M0-04-backend-env-file", KNOWN_TASK_IDS), "M0-04-fix")

    def test_지시서가_없는_브랜치는_작업_ID_없음(self):
        self.assertIsNone(checker.find_task_id("docs/M0-structure", KNOWN_TASK_IDS))

    def test_유형이_없는_브랜치는_작업_ID_없음(self):
        self.assertIsNone(checker.find_task_id("M0-04-nest-foundation", KNOWN_TASK_IDS))

    def test_비슷한_접두사의_ID를_혼동하지_않음(self):
        ids = ["M0-1", "M0-10"]
        self.assertEqual(checker.find_task_id("feat/M0-10-search", ids), "M0-10")
        self.assertEqual(checker.find_task_id("feat/M0-1-search", ids), "M0-1")
        self.assertEqual(checker.find_task_id("feat/M0-10", ids), "M0-10")
        self.assertIsNone(checker.find_task_id("feat/M0-100-search", ids))
        self.assertIsNone(checker.find_task_id("feat/M0-1search", ids))

    def test_작업_ID_목록이_비어_있으면_작업_ID_없음(self):
        self.assertIsNone(checker.find_task_id("feat/M0-04-nest-foundation", []))


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

    git·지시서·roles.json은 현재 작업 디렉터리(저장소 루트) 기준으로 읽는다고 가정한다.
    임시 저장소에는 실제 M0-08 지시서와 roles.json을 복사하므로, 구현이 지시서·규칙을
    스크립트 위치 기준으로 읽어도 같은 결과가 나온다.
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
