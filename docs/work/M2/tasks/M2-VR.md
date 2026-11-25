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
  - [ ] visual 프로젝트 Chromium에 렌더링 고정 플래그가 있고, 근거가 기록되어 있다
  - [ ] 기준 이미지 24장을 다시 만들었고, 로컬 컨테이너에서 연속 3회 통과한다
  - [ ] CI `e2e` 잡을 3회 이상 실행해 모두 통과한다(CPU 모델 로그 포함)
- 거부
  - [ ] 시험용 변경 2종(토큰 색 1개, 간격 4px)이 여전히 검출된다
- 회귀
  - [ ] 일반 E2E(prod·components) 결과가 그대로다(228건)
  - [ ] `pnpm verify`가 통과하고 CI 필수 검사 8개가 그대로다

## 인계 노트

(단계별로 덧붙인다)
