import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import type { ReactNode } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { CodeBlock } from './CodeBlock';
import { MdCheckbox } from './MdCheckbox';
import { MdImage } from './MdImage';
import { MdLink } from './MdLink';
import { markdownToSafeHast } from './processor';

/**
 * Markdown을 React 노드로 바꾼다. 서버(RSC)에서 쓰고, 관리자 프리뷰(M3)도 같은 함수를 쓸 수 있다.
 * 결과는 sanitize를 통과한 hast뿐이라 dangerouslySetInnerHTML 없이 React 요소로만 만든다.
 * 래퍼 요소는 만들지 않는다. 호출하는 쪽이 `.prose-jblog` 같은 컨테이너에 넣는다.
 */
export async function renderMarkdown(markdown: string): Promise<ReactNode> {
  const tree = await markdownToSafeHast(markdown);
  return toJsxRuntime(tree, {
    Fragment,
    jsx,
    jsxs,
    components: { pre: CodeBlock, img: MdImage, a: MdLink, input: MdCheckbox },
  });
}
