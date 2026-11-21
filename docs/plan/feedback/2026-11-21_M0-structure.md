<!-- base: 91b0924b973b80afbb68848db0d7a85f79302d44 · head: eb9783af56d3fb52a75fd400f30f74b402d164b2 · reviewed: 2026-11-21 -->
# M0-structure 검수 r1

## 종합 판정

수정 후 통과 — 저장소 구조 변경은 주요 문서에 일관되게 반영되었다. 다만 생성 타입의 수동 수정 금지와 계약 PR에서의 생성 결과 허용을 소유권 규칙에서 구분해야 한다.

## 지적 사항

### 1. [중간] 생성 타입이 계약 PR 참여 역할의 허용 범위에서 모두 제외됨

- 위치: `scripts/ownership/roles.json:59`, `docs/plan/05_collaboration_architecture.md:330`
- 근거: 협업 §5.2는 PR 변경을 참여 역할의 쓰기 범위 합집합으로 검사하며, 생성 타입은 계약 PR에서 변경을 허용한다. 그러나 `frontend/src/generated/**`는 Frontend의 deny에 포함되고 Backend·DevOps의 allow에도 없다. `pr_common_allow`에도 생성물 예외가 없다. `docs/work/M0/plan.md` §2의 M0-07 참여 역할 세 가지로 현행 판정 함수를 실행하면 생성 타입을 허용하는 역할이 없었다.
- 영향: M0-08에서 명세대로 역할 합집합 검사를 구현하면, 정상적인 계약 변경으로 재생성된 `frontend/src/generated/api-types.ts`도 범위 밖 변경으로 거부된다. 생성 스크립트가 Write/Edit 훅을 우회하는 것만으로는 PR 검사 문제가 해결되지 않는다.
- 권고: 역할 단위의 수동 수정 금지는 유지하면서, PR 단위에서는 `contract/` 브랜치의 검증된 생성 결과를 허용하는 별도 규칙을 정의한다. 정상 계약 생성물 허용과 일반 브랜치 변경 거부를 검증 항목에 추가한다.

## 확인한 범위

- 지정한 base~head의 `git diff`와 `git diff --name-only`로 변경 파일 17개 전체 확인.
- 개요 D25·§4·§6-b, 백엔드 계약 검증, 프론트엔드 구조·렌더링, 접근 통제 경로, 협업 §5.2·§5.3 및 M0 계획·체크리스트 대조.
- 에이전트·스킬 문서, 루트 `CLAUDE.md`, `.gitignore`, 소유권 규칙과 관련 판정 코드 확인.
- `git diff --check` 통과.
- `python3 -B scripts/ownership/pr_common_allow.py --self-test`: 12/12 통과.
- 기존 소유권 판정 함수로 생성 타입·E2E·테스트 설정·Markdown 경로의 역할별 허용 여부 확인.
- 파일 수정 없음. 애플리케이션 빌드·통합 테스트는 실행하지 않음.