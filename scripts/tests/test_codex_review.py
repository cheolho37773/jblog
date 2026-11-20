"""scripts/codex-review.sh 재현 테스트 (작업 M0-01, Issue #2).

실제 Codex 대신 테스트가 만든 가짜 codex 실행 파일(stub)을 쓴다.
각 테스트는 임시 디렉터리에 bare 원격 + 클론을 만들고, 실제 저장소 파일은 수정하지 않는다.
"""
import datetime
import os
import shutil
import signal
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_SOURCE = REPO_ROOT / "scripts" / "codex-review.sh"

TASK_ID = "M0-01"
PAST_DATE = "2000-01-01"
TODAY = datetime.date.today().isoformat()
STUB_CONTENT = "STUB-REVIEW-RESULT"
SHIM_FAIL_CODE = 99
TIMEOUT_EXIT_CODE = 124
SCRIPT_TIMEOUT_SECONDS = 2
HARNESS_TIMEOUT_SECONDS = 20  # 구현이 시간 제한 없이 멈춰도 테스트가 끝나도록 하는 안전장치
STUB_SLEEP_SECONDS = 60
PROCESS_EXIT_WAIT_SECONDS = 3
SYSTEM_PATH = "/usr/bin:/bin"

# stub 인터페이스: STUB_MODE=write(기본) | hang. 인자의 --output-last-message/-o 파일에 기록한다.
# hang 모드는 결과 파일을 일부 쓴 뒤 자식 sleep을 만들고 대기한다. PID는 STUB_PID_DIR에 남긴다.
STUB_SOURCE = f"""#!/bin/bash
out=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-last-message|-o) out="$2"; shift 2 ;;
    *) shift ;;
  esac
done
echo "$0" > "$STUB_PID_DIR/used"
if [[ "${{STUB_MODE:-write}}" == "hang" ]]; then
  [[ -n "$out" ]] && echo partial > "$out"
  sleep {STUB_SLEEP_SECONDS} &
  echo $! > "$STUB_PID_DIR/child.pid"
  echo $$ > "$STUB_PID_DIR/stub.pid"
  wait
  exit 0
fi
[[ -n "$out" ]] && echo "{STUB_CONTENT}" > "$out"
exit 0
"""

FAILING_SHIM_SOURCE = f"""#!/bin/bash
echo shim-was-used >&2
exit {SHIM_FAIL_CODE}
"""


def run_git(cwd, *args):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True)


def write_executable(path: Path, source: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(source)
    path.chmod(0o755)
    return path


def is_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    return True


class CodexReviewTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="codex-review-test-"))
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.pid_dir = self.tmp / "pids"
        self.pid_dir.mkdir()
        self.addCleanup(self.kill_leftover_processes)
        self.stub_dir = self.tmp / "stubbin"
        write_executable(self.stub_dir / "codex", STUB_SOURCE)
        self.clone = self.make_clone()

    # --- 환경 구성 ---
    def make_clone(self) -> Path:
        origin = self.tmp / "origin.git"
        clone = self.tmp / "clone"
        run_git(self.tmp, "init", "--bare", "-b", "dev", str(origin))
        run_git(self.tmp, "clone", str(origin), str(clone))
        run_git(clone, "config", "user.email", "test@example.com")
        run_git(clone, "config", "user.name", "test")
        run_git(clone, "checkout", "-b", "dev")
        (clone / "README.md").write_text("init\n")
        (clone / "scripts").mkdir()
        shutil.copy(SCRIPT_SOURCE, clone / "scripts" / "codex-review.sh")
        run_git(clone, "add", "-A")
        run_git(clone, "commit", "-m", "init")
        run_git(clone, "push", "-u", "origin", "dev")
        (clone / "docs" / "plan" / "feedback").mkdir(parents=True)  # 실제 저장소에는 이미 있는 디렉터리
        return clone

    def touch(self, relative: str):
        path = self.clone / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("previous\n")

    def feedback_names(self):
        directory = self.clone / "docs" / "plan" / "feedback"
        return sorted(p.name for p in directory.iterdir()) if directory.exists() else []

    # --- 실행 ---
    def run_script(self, *args, path=None, extra_env=None):
        env = {
            "PATH": path or f"{self.stub_dir}:{SYSTEM_PATH}",
            "HOME": str(self.tmp),
            "STUB_PID_DIR": str(self.pid_dir),
        }
        env.update(extra_env or {})
        process = subprocess.Popen(
            ["bash", "scripts/codex-review.sh", *args], cwd=self.clone, env=env,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True,
        )
        try:
            stdout, stderr = process.communicate(timeout=HARNESS_TIMEOUT_SECONDS)
            return process.returncode, stdout + stderr, False
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            stdout, stderr = process.communicate()
            return None, stdout + stderr, True

    def kill_leftover_processes(self):
        for name in ("stub.pid", "child.pid"):
            pid_file = self.pid_dir / name
            if pid_file.exists():
                try:
                    os.kill(int(pid_file.read_text()), signal.SIGKILL)
                except (ProcessLookupError, ValueError):
                    pass

    def wait_until_dead(self, pid: int) -> bool:
        deadline = time.time() + PROCESS_EXIT_WAIT_SECONDS
        while time.time() < deadline:
            if not is_alive(pid):
                return True
            time.sleep(0.1)
        return not is_alive(pid)


class TaskModeTest(CodexReviewTestCase):
    def test_작업_모드는_r1_결과_파일을_만들고_종료_코드_0(self):
        code, output, _ = self.run_script(TASK_ID)
        self.assertEqual(code, 0, output)
        result = self.clone / "docs" / "reviews" / TASK_ID / "r1.codex.md"
        self.assertIn(STUB_CONTENT, result.read_text())

    def test_작업_모드는_기존_최대_회차_다음_회차를_쓴다(self):
        self.touch(f"docs/reviews/{TASK_ID}/r1.codex.md")
        self.touch(f"docs/reviews/{TASK_ID}/r3.codex.md")
        code, output, _ = self.run_script(TASK_ID)
        self.assertEqual(code, 0, output)
        self.assertTrue((self.clone / "docs" / "reviews" / TASK_ID / "r4.codex.md").exists())


class PlanModeRoundTest(CodexReviewTestCase):
    def assert_plan_result(self, expected_name):
        code, output, _ = self.run_script(TASK_ID, "--plan")
        self.assertEqual(code, 0, output)
        self.assertIn(expected_name, self.feedback_names())
        result = self.clone / "docs" / "plan" / "feedback" / expected_name
        self.assertIn(STUB_CONTENT, result.read_text())

    def test_이전_날짜의_r1_r2가_있으면_오늘_r3를_만든다(self):
        self.touch(f"docs/plan/feedback/{PAST_DATE}_{TASK_ID}.md")
        self.touch(f"docs/plan/feedback/{PAST_DATE}_{TASK_ID}_r2.md")
        self.assert_plan_result(f"{TODAY}_{TASK_ID}_r3.md")

    def test_이전_결과가_없으면_오늘_날짜_r1_이름을_쓴다(self):
        self.assert_plan_result(f"{TODAY}_{TASK_ID}.md")

    def test_오늘_r1이_이미_있으면_r2를_만든다(self):
        self.touch(f"docs/plan/feedback/{TODAY}_{TASK_ID}.md")
        self.assert_plan_result(f"{TODAY}_{TASK_ID}_r2.md")

    def test_다른_작업_ID_파일은_회차_계산에_넣지_않는다(self):
        self.touch(f"docs/plan/feedback/{PAST_DATE}_other_{TASK_ID}_r5.md")
        self.touch(f"docs/plan/feedback/{PAST_DATE}_{TASK_ID}-extra_r7.md")
        self.touch(f"docs/plan/feedback/{PAST_DATE}_x{TASK_ID}_r9.md")
        self.assert_plan_result(f"{TODAY}_{TASK_ID}.md")

    def test_다른_ID_파일이_섞여_있어도_같은_ID의_최대_회차만_센다(self):
        self.touch(f"docs/plan/feedback/{PAST_DATE}_{TASK_ID}.md")
        self.touch(f"docs/plan/feedback/{PAST_DATE}_other_{TASK_ID}_r5.md")
        self.touch(f"docs/plan/feedback/{PAST_DATE}_{TASK_ID}-extra_r7.md")
        self.assert_plan_result(f"{TODAY}_{TASK_ID}_r2.md")


class CodexSelectionTest(CodexReviewTestCase):
    def test_cmux_cli_shims_경로의_codex는_건너뛰고_뒤의_stub을_쓴다(self):
        shim_dir = self.tmp / "app" / "cmux-cli-shims" / "bin"
        write_executable(shim_dir / "codex", FAILING_SHIM_SOURCE)
        path = f"{shim_dir}:{self.stub_dir}:{SYSTEM_PATH}"
        code, output, _ = self.run_script(TASK_ID, path=path)
        self.assertEqual(code, 0, output)
        self.assertNotIn("shim-was-used", output)
        self.assertTrue((self.clone / "docs" / "reviews" / TASK_ID / "r1.codex.md").exists())

    def test_CODEX_BIN을_지정하면_PATH와_무관하게_그_실행_파일을_쓴다(self):
        decoy_dir = self.tmp / "decoy"
        write_executable(decoy_dir / "codex", FAILING_SHIM_SOURCE)
        chosen = write_executable(self.tmp / "chosen" / "my-codex", STUB_SOURCE)
        code, output, _ = self.run_script(
            TASK_ID, path=f"{decoy_dir}:{SYSTEM_PATH}", extra_env={"CODEX_BIN": str(chosen)})
        self.assertEqual(code, 0, output)
        self.assertEqual((self.pid_dir / "used").read_text().strip(), str(chosen))

    def test_codex를_찾지_못하면_종료_코드_1(self):
        if shutil.which("codex", path=SYSTEM_PATH):
            self.skipTest("시스템 경로에 codex가 있어 '찾지 못함'을 만들 수 없음")
        code, output, timed_out = self.run_script(TASK_ID, path=SYSTEM_PATH)
        self.assertFalse(timed_out)
        self.assertEqual(code, 1, output)


class TimeoutTest(CodexReviewTestCase):
    def test_codex가_멈추면_종료_코드_124이고_결과_파일과_프로세스가_남지_않는다(self):
        code, output, timed_out = self.run_script(
            TASK_ID,
            extra_env={"CODEX_REVIEW_TIMEOUT": str(SCRIPT_TIMEOUT_SECONDS), "STUB_MODE": "hang"})
        self.assertFalse(timed_out, "시간 제한이 없어 스크립트가 끝나지 않음")
        self.assertEqual(code, TIMEOUT_EXIT_CODE, output)
        reviews = self.clone / "docs" / "reviews" / TASK_ID
        self.assertEqual(list(reviews.glob("r*.codex.md")) if reviews.exists() else [], [])
        for name in ("stub.pid", "child.pid"):
            pid = int((self.pid_dir / name).read_text())
            self.assertTrue(self.wait_until_dead(pid), f"{name}({pid}) 프로세스가 남아 있음")

    def test_plan_모드에서_시간을_넘기면_결과_파일을_남기지_않는다(self):
        code, output, timed_out = self.run_script(
            TASK_ID, "--plan",
            extra_env={"CODEX_REVIEW_TIMEOUT": str(SCRIPT_TIMEOUT_SECONDS), "STUB_MODE": "hang"})
        self.assertFalse(timed_out, "시간 제한이 없어 스크립트가 끝나지 않음")
        self.assertEqual(code, TIMEOUT_EXIT_CODE, output)
        self.assertEqual(self.feedback_names(), [])


class RegressionTest(CodexReviewTestCase):
    def test_커밋되지_않은_변경이_있으면_실패하고_codex를_호출하지_않는다(self):
        (self.clone / "README.md").write_text("modified\n")
        code, output, _ = self.run_script(TASK_ID)
        self.assertEqual(code, 1, output)
        self.assertFalse((self.pid_dir / "used").exists())

    def test_잘못된_작업_ID는_실패한다(self):
        code, output, _ = self.run_script("bad id!")
        self.assertEqual(code, 1, output)
        self.assertFalse((self.pid_dir / "used").exists())


if __name__ == "__main__":
    unittest.main()
