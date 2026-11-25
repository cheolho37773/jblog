# M2-VR 시각 회귀가 CI 러너 CPU에 따라 흔들림: Chromium 렌더링 고정 (Issue #62)

- 마일스톤: M2 · 이슈: #62 · 브랜치: `fix/M2-VR-visual-determinism` (`dev` `923e3f1`에서 생성)
- 실행 방식: **서브에이전트 조합(버그 수정)**
  1. devops-engineer: 재현 근거를 수집하고 렌더링 고정 설정과 CI 기록을 넣는다
  2. test-engineer: 기준 이미지를 다시 만들고 검출력을 확인한다
  3. 오케스트레이터: CI를 반복 실행해 확인한다
- 참여 역할: devops-engineer, test-engineer
- 선택 이유: 개발자 승인(2026-11-25). PR #61(M2-03)의 시각 회귀 실패는 코드 변경이 아니라 실행 환경 차이다. 그대로 두면 이후 PR마다 같은 실패가 날 수 있다
- 난도·모델: 보통 → Sonnet
- 현상: 아래 "재현 근거" 표 참고
  - 실패한 것은 `/` 768~1920 × Light/Dark와 `/dev/components` 5폭 × Light/Dark다. 차이는 글자 가장자리(안티앨리어싱)뿐이다
  - 러너 이미지 버전과 컨테이너 digest는 같다. 그래서 CPU에 따른 Skia 래스터화 차이로 추정한다
- 참조: UI 기획서 §11-6(시각 회귀 운용·허용 오차), 협업 §4.3-a(기준 이미지 운용), M1-05 지시서 인계 노트(CI 수정 1·2), `scripts/visual/run.sh`, `frontend/playwright.config.ts`
- 쓰기 범위
  - devops-engineer: `frontend/playwright.config.ts`, `scripts/**`(`scripts/tests/**` 제외), `.github/**`
  - test-engineer: `frontend/e2e/**`(기준 이미지 포함)
  - 오케스트레이터: `docs/ui_design/ui_design_spec.md` §11-6(값이 바뀌면)
- 실행 명령: `pnpm test:visual` · `pnpm test:visual:update` · `pnpm test:e2e` · `pnpm verify`
- 하지 말 것
  - 허용 오차만 키워서 통과시키기. 시험용 변경(토큰 색 1개, 간격 4px) 검출이 깨지면 안 된다
  - 화면 코드(`src/**`) 변경
  - CI 필수 검사 이름·개수 변경
  - `git config` 변경

## 재현 근거

| 실행 | 커밋 | 결과 |
|---|---|---|
| push CI run 45436398371 (2026-11-24) | `85685c3` | 시각 회귀 24건 통과 |
| PR CI run 45612159997 (2026-11-25) | 같은 트리(PR 병합 커밋, `dev`가 조상) | 18건 실패. 재시도도 실패 |

## 동작 규약 (오케스트레이터 확정)

| # | 항목 | 규약 |
|---|---|---|
| 1 | 렌더링 고정 (devops) | 시각 회귀 프로젝트의 Chromium에 CPU별 최적화·힌팅 차이를 없애는 실행 플래그를 준다.<br>• 후보: `--disable-skia-runtime-opts`, `--font-render-hinting=none`, `--disable-gpu`, `--force-color-profile=srgb`<br>• 무엇을 넣었는지와 각 플래그의 근거(공식 문서·Chromium 소스 위치)를 config 주석과 인계 노트에 남긴다<br>• **visual 프로젝트에만** 적용한다. 일반 E2E에는 영향을 주지 않는다 |
| 2 | CI 기록 (devops) | `e2e` 잡의 시각 회귀 단계 전에 러너 CPU 모델을 로그에 남긴다(예: `lscpu` 요약 한 줄). 다음에 같은 문제가 생기면 원인을 확정하기 위해서다 |
| 3 | 기준 이미지 (test) | 플래그를 넣은 상태로 고정 컨테이너(`pnpm test:visual:update`)에서 24장을 다시 만든다.<br>• 로컬 연속 3회 통과를 확인한다<br>• 시험용 변경 2종이 여전히 검출되는지 확인한다(이미지별 최소 diff를 기록)<br>• `maxDiffPixels`는 15를 유지한다. 바꿔야 하면 근거와 함께 멈추고 보고한다 |
| 4 | CI 반복 확인 (오케스트레이터) | push 후 같은 커밋으로 CI `e2e` 잡을 **3회 이상** 다시 실행해 모두 통과하는지 본다. 러너 배정이 달라지는 것을 이용한 확인이다. CPU 모델 로그가 서로 다른 실행이 섞여 있으면 더 좋은 근거다 |

## 필수 검증

- 성공
  - [x] visual 프로젝트 Chromium에 렌더링 고정 플래그가 있고, 근거가 기록되어 있다 — 플래그 이유는 기록함. Chromium 소스상 정의 위치는 확인하지 못함(인계 노트 ①)
  - [x] 기준 이미지 24장을 다시 만들었고, 로컬 컨테이너에서 연속 3회 통과한다
  - [ ] CI `e2e` 잡을 3회 이상 실행해 모두 통과한다(CPU 모델 로그 포함) — push 후 확인 항목(규약 4). 결과는 Codex 대응 기록에 남긴다
- 거부
  - [x] 시험용 변경 2종(토큰 색 1개, 간격 4px)이 여전히 검출된다
- 회귀
  - [x] 일반 E2E(prod·components) 결과가 그대로다(228건)
  - [x] `pnpm verify`가 통과하고 CI 필수 검사 8개가 그대로다

## 인계 노트

(단계별로 덧붙인다)

### ① 렌더링 고정 (devops-engineer)

- 넣은 곳: `frontend/playwright.config.ts`의 `VISUAL_CHROMIUM_ARGS`를 visual 프로젝트 `use.launchOptions.args`에만 적용했다. prod·components 프로젝트는 그대로다.
- 플래그와 이유 (근거 위치는 소스를 직접 열어 확인하지 못했다. config 주석에도 "확인 못 함"으로 적었다)
  - `--disable-skia-runtime-opts`: Skia의 실행 중 CPU 기능 감지(SSE·AVX 등) 최적화 경로를 끈다. CPU마다 반올림이 달라 안티앨리어싱이 어긋나는 추정 원인에 직접 대응한다
  - `--font-render-hinting=none`: 힌팅 설정 차이를 없앤다
  - `--disable-gpu`: 소프트웨어 래스터화로 고정한다
  - `--force-color-profile=srgb`: 색 프로필 감지를 sRGB로 고정한다
- CI: `e2e` 잡의 "시각 회귀 (고정 컨테이너)" 단계 앞에 "러너 CPU 모델 기록" 단계(`lscpu | grep 'Model name'`)를 추가했다. 잡 이름·개수는 그대로고 외부 액션도 추가하지 않았다. 별도 잡이 아니라 같은 잡 안의 단계다
- 확인 결과
  - 플래그 적용 후 옛 기준 이미지로 `pnpm test:visual`: 24건 모두 실패했다. 플래그가 렌더링을 바꾼 것이므로 예상한 결과다. 기준 이미지 재생성은 test-engineer가 한다
  - `pnpm test:e2e`: 228건 통과, 일반 E2E 영향 없음
  - `pnpm verify`: 통과
- test-engineer 참고: `pnpm test:visual:update`로 24장을 다시 만들 때 `frontend/playwright.config.ts`는 수정하지 않는다. 고정 컨테이너에서 연속 3회 통과와 시험용 변경 2종 검출을 확인한다.

### ② 기준 이미지 재생성 (test-engineer)

- 재생성: 렌더링 고정 플래그(89cc65e) 상태로 `pnpm test:visual:update`(linux/amd64 고정 컨테이너)를 실행해 24장을 다시 만들었다. 설정·`src/**`는 수정하지 않았다.
- 반복 결과: `pnpm test:visual` 연속 3회 모두 24 passed. 재시도·flaky 0건
- 시험용 변경 검출 (`maxDiffPixels` 15 유지, 실행 뒤 되돌림, `git status`로 `src` 변경 없음 확인)
  - Light `--border` `#e8e8ea` → `#e4e4e6`(4단계): Light 12장 전부 실패(검출), Dark 12장은 영향 없어 통과. 이미지별 diff 픽셀 최소 245(menu-open-375-light), 그다음 718(search-open-375-light), 1093(home-375-light). components Light는 18100~45680
  - Footer `pt-16` → `pt-20`: 24장 전부 실패(검출). 최소 1477(menu-open-375-dark), 그다음 1479(menu-open-375-light), 6375(home-375·search-open-375). home 13056~32640, components 35만~61만
  - 두 종류 모두 최소 diff가 허용치 15보다 충분히 크다(가장 작은 245가 15의 약 16배)
- 눈 확인: home-1920-light, components-1920-dark을 열어 레이아웃·색이 정상이다(헤더·Footer·컴포넌트 배치와 다크 토큰 그대로). 마젠타 막대는 기존 마스킹 영역이다. 글자 렌더링만 달라졌다
- 정리: playwright-report, test-results 삭제

### Codex r1 대응 ① (devops-engineer)

- `--font-render-hinting=none`을 제거해 `VISUAL_CHROMIUM_ARGS`는 3개(`--disable-skia-runtime-opts`, `--disable-gpu`, `--force-color-profile=srgb`)다. config 주석에 Chromium 소스 위치(`kDisableSkiaRuntimeOpts`·`kDisableGpu`·`kForceDisplayColorProfile`)와 소스 주석 요지(확인된 동작)를 적고 이번 문제에 대한 추정과 나눴다
- 확인: `pnpm verify` 통과, `pnpm test:e2e` 228건 통과. `pnpm test:visual`은 기준 이미지가 옛 렌더링이라 24건 실패(예상). 기준 이미지 재생성은 test-engineer 몫이다

### Codex r1 대응 ② (test-engineer)

- 재생성: `--font-render-hinting` 제거 상태(dec1e32)로 `pnpm test:visual:update`(고정 컨테이너) 24장 재생성. 설정·`src/**` 수정 없음
- 반복 결과: `pnpm test:visual` 연속 3회 모두 24 passed. 재시도·flaky 0건
- 시험용 변경 검출 (`maxDiffPixels` 15 유지, 실행 뒤 `git checkout`으로 되돌림, `src` 변경 없음 확인)
  - Light `--border` `#e8e8ea` -> `#e4e4e6`: Light 12장 실패, Dark 12장 통과. 최소 diff 245(menu-open-375-light), 718(search-open-375-light), 1093(home-375-light)
  - Footer `pt-16` -> `pt-20`: 24장 전부 실패. 최소 diff 1477(menu-open-375-dark), 1479(menu-open-375-light), 6375(home-375-dark)
  - 가장 작은 245는 허용치 15의 약 16배
- 눈 확인: home-1920-light, components-1920-dark 정상(마젠타 막대는 기존 마스킹 영역)
- 정리: playwright-report, test-results 삭제

### 오케스트레이터 독립 확인 (깨끗한 클론)

- 대상: `0c9daff` (`git clone --branch fix/M2-VR-visual-determinism` → `pnpm install --frozen-lockfile`, Node 24)

| 명령 | 결과 |
|---|---|
| `pnpm verify` | 종료 코드 0 |
| `pnpm test:e2e` | 228건 통과 |
| `pnpm test:visual` (고정 컨테이너) | 24건 통과 |

- CI 반복 확인(규약 4)은 push 후에 하고, 결과는 검수 대응 기록에 남긴다
- 에러 수정 횟수: 자체 검사 0, Codex 0, CI 0
