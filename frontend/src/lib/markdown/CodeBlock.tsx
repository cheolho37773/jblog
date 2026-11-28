import type { ComponentProps } from 'react';
import { CODE_TITLE_ATTRIBUTE } from './code-title';
import { CodeCopyButton } from './CodeCopyButton';

type CodeBlockProps = ComponentProps<'pre'> & { [CODE_TITLE_ATTRIBUTE]?: string };

/**
 * 코드 블록 (UI §7.3): 제목 줄(있을 때) + shiki가 만든 `pre` + 우측 상단 복사 버튼 자리.
 * 복사 버튼은 클라이언트 컴포넌트(CodeCopyButton)다. 코드 텍스트의 드래그 선택은 복사 방지 CSS가 막고 버튼으로만 복사한다.
 * 스타일은 prose-jblog.css의 `.code-block*`가 맡는다 (배경은 code-bg 토큰).
 */
export function CodeBlock({
  children,
  [CODE_TITLE_ATTRIBUTE]: title,
  ...preProps
}: CodeBlockProps) {
  return (
    <div className="code-block">
      {title ? <div className="code-block-title">{title}</div> : null}
      <div className="code-block-body">
        <pre {...preProps}>{children}</pre>
        <CodeCopyButton />
      </div>
    </div>
  );
}
