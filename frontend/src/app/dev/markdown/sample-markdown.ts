// /dev/markdown 예시 본문. 지시서 "문법 확정"의 모든 요소와 XSS 시도 문자열을 담는다 (픽스처 본문 `contentMdOf`와 같은 문법).
// 이미지는 E2E 픽스처 API(/uploads/fixtures/*)가 제공하는 파일이다. 픽스처 없이 `pnpm dev`로 보면 이미지 자리에 alt가 보인다.
const FIXTURE_IMAGE = '/uploads/fixtures/cover-indigo.png';

export const SAMPLE_MARKDOWN = `## 글 본문 미리보기

이 페이지는 Markdown 파이프라인이 만드는 모든 요소를 한 번에 보여 주는 개발용 화면입니다. 본문은 Source Serif와 Noto Serif KR로 그려지고, 문단 사이 간격은 32px입니다.

두 번째 문단입니다. [외부 링크](https://example.com/docs)는 새 탭으로 열리고, [내부 링크](/blog/hello-nestjs)는 같은 탭에서 열립니다. 자동 링크 https://example.com/auto 도 링크가 되고, ~~취소선~~과 \`inline code\`도 지원합니다.

### 인용문과 콜아웃

> 좋은 코드는 읽는 사람을 위해 쓴다. 기계는 어떤 코드든 실행한다.

> [!NOTE]
> 알아 두면 좋은 **보충 설명**입니다.

> [!TIP]
> 더 편하게 쓰는 방법을 알려 줍니다.

> [!IMPORTANT]
> 놓치면 안 되는 내용입니다.

> [!WARNING]
> 주의해서 다뤄야 하는 내용입니다.

> [!CAUTION]
> 되돌릴 수 없는 작업입니다.

## 목록과 표

- 첫째 항목
- 둘째 항목
  - 중첩된 항목

1. 순서가 있는 첫째
2. 순서가 있는 둘째

- [x] 끝낸 일
- [ ] 할 일

| 이름 | 역할 | 비고 |
| --- | --- | --- |
| remark | Markdown 파싱 | 문법 확장은 플러그인 |
| shiki | 코드 하이라이트 | 테마 2종 |
| sanitize | 안전한 HTML만 허용 | 마지막 관문 |

## 코드와 이미지

\`\`\`ts title="example.ts"
export function greet(name: string): string {
  // 인사말을 만든다
  return \`Hello, \${name}\`;
}
\`\`\`

\`\`\`bash
pnpm install && pnpm build
\`\`\`

![그라디언트 예시 이미지](${FIXTURE_IMAGE} "그림 1. 캡션이 있는 이미지")

## 위험한 입력

아래는 렌더링되면 안 되는 입력입니다. 모두 걸러지고 글자도 남지 않아야 합니다.

<script>window.hacked = 1</script>

<img src="x" onerror="window.hacked = 1">

<iframe src="https://evil.example"></iframe>

[스크립트 링크](javascript:window.hacked=1)

마지막 문단입니다.
`;
