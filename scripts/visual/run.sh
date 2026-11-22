#!/usr/bin/env bash
# 시각 회귀를 Linux 컨테이너에서 실행한다 (M1-05 규약 1·2).
#   scripts/visual/run.sh compare   기준 이미지와 비교 (pnpm test:visual, CI)
#   scripts/visual/run.sh update    기준 이미지를 다시 만든다 (pnpm test:visual:update)
#
# 왜 컨테이너인가: macOS·GitHub 러너는 폰트 렌더링이 달라 같은 기준 이미지를 공유할 수 없다.
# 왜 저장소를 복사하는가: 호스트 node_modules(macOS용 Next SWC·Prisma 엔진)와 .next* 산출물을
#   컨테이너가 덮어쓰지 않게 한다. 저장소는 읽기 전용으로 마운트하고 컨테이너 안 복사본에서 설치·빌드한다.
set -euo pipefail

IMAGE_TAG="jblog-visual:local"
PNPM_STORE_VOLUME="jblog-visual-pnpm-store"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCREENSHOT_DIR="$REPO_ROOT/frontend/e2e/visual/__screenshots__"
REPORT_DIR="$REPO_ROOT/frontend/playwright-report"
RESULT_DIR="$REPO_ROOT/frontend/test-results"

# 컨테이너 안에서 실행할 스크립트. 호스트 셸이 해석하지 않도록 따옴표로 감싼 heredoc을 쓴다.
read -r -d '' CONTAINER_SCRIPT <<'INNER' || true
set -euo pipefail
export HUSKY=0 CI=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0
mkdir -p /work
# 비밀값(.env*)과 호스트 산출물은 복사하지 않는다.
tar -C /src -cf - --exclude=node_modules --exclude='.next*' --exclude=.git \
  --exclude=playwright-report --exclude=test-results --exclude='.env' --exclude='.env.*' . \
  | tar -C /work -xf -
cd /work
pnpm config set store-dir /pnpm-store >/dev/null
pnpm install --frozen-lockfile
status=0
(cd frontend && JBLOG_VISUAL=1 pnpm exec playwright test --project=visual --pass-with-no-tests ${PLAYWRIGHT_ARGS:-}) || status=$?
# 실패해도 결과를 호스트로 돌려준다(보고서·diff 확인용). 기준 이미지는 update일 때만 덮는다.
mkdir -p /out/report /out/results /out/screenshots
cp -R frontend/playwright-report/. /out/report/ 2>/dev/null || true
cp -R frontend/test-results/. /out/results/ 2>/dev/null || true
if [ "${MODE}" = "update" ] && [ "$status" -eq 0 ] && [ -d frontend/e2e/visual/__screenshots__ ]; then
  rm -rf /out/screenshots/* /out/screenshots/.[!.]* 2>/dev/null || true
  cp -R frontend/e2e/visual/__screenshots__/. /out/screenshots/
fi
chown -R "${HOST_UID}:${HOST_GID}" /out
exit "$status"
INNER

fail() {
  echo "오류: $*" >&2
  exit 1
}

# Dockerfile의 Playwright 이미지 버전이 설치된 @playwright/test와 다르면 브라우저가 맞지 않는다.
check_playwright_version() {
  local from_package from_dockerfile
  from_package="$(sed -n 's/.*"@playwright\/test": "\([^"]*\)".*/\1/p' "$REPO_ROOT/frontend/package.json")"
  from_dockerfile="$(sed -n 's/^FROM mcr.microsoft.com\/playwright:v\([0-9.]*\)-noble.*/\1/p' "$REPO_ROOT/scripts/visual/Dockerfile")"
  [[ -n "$from_package" && "$from_package" == "$from_dockerfile" ]] \
    || fail "Playwright 버전 불일치: package.json=$from_package, scripts/visual/Dockerfile=$from_dockerfile"
}

build_image() {
  docker build --quiet -f "$REPO_ROOT/scripts/visual/Dockerfile" -t "$IMAGE_TAG" "$REPO_ROOT/scripts/visual" >/dev/null
}

run_in_container() {
  local mode="$1"
  mkdir -p "$SCREENSHOT_DIR" "$REPORT_DIR" "$RESULT_DIR"
  docker run --rm --ipc=host \
    -v "$REPO_ROOT:/src:ro" \
    -v "$SCREENSHOT_DIR:/out/screenshots" \
    -v "$REPORT_DIR:/out/report" \
    -v "$RESULT_DIR:/out/results" \
    -v "$PNPM_STORE_VOLUME:/pnpm-store" \
    -e MODE="$mode" \
    -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
    -e PLAYWRIGHT_ARGS="${PLAYWRIGHT_ARGS:-}" \
    "$IMAGE_TAG" bash -c "$CONTAINER_SCRIPT"
}

main() {
  local mode="${1:-}"
  [[ "$mode" == "compare" || "$mode" == "update" ]] || fail "사용법: $0 compare|update"
  command -v docker >/dev/null || fail "docker가 필요하다"
  check_playwright_version
  build_image
  if [[ "$mode" == "update" ]]; then
    PLAYWRIGHT_ARGS="--update-snapshots ${PLAYWRIGHT_ARGS:-}"
  fi
  run_in_container "$mode"
}

main "$@"
