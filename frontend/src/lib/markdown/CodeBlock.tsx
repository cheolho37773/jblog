import { Copy } from 'lucide-react';
import type { ComponentProps } from 'react';
import { CODE_TITLE_ATTRIBUTE } from './code-title';

type CodeBlockProps = ComponentProps<'pre'> & { [CODE_TITLE_ATTRIBUTE]?: string };

/**
 * 코드 블록 (UI §7.3): 제목 줄(있을 때) + shiki가 만든 `pre` + 우측 상단 복사 버튼 자리.
 * 복사 버튼의 동작은 M2-10에서 붙인다. 지금은 자리와 접근 가능한 이름("코드 복사")까지만이다.
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
        <button type="button" className="code-block-copy" aria-label="코드 복사">
          <Copy aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  );
}
