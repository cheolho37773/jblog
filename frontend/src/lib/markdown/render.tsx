import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import type { ComponentProps, ReactNode } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { CodeBlock } from './CodeBlock';
import { MdCheckbox } from './MdCheckbox';
import { MdImage } from './MdImage';
import { MdLink } from './MdLink';
import { markdownToSafeHast } from './processor';

export interface RenderOptions {
  /**
   * 외부 링크 판정의 기준 오리진(예: env.public.NEXT_PUBLIC_SITE_URL). 호출하는 쪽이 넘긴다.
   * 이 모듈은 서버(RSC)와 관리자 프리뷰(M3, 브라우저)가 함께 쓰므로 server-only인 env를 직접 읽지 않는다.
   * 없으면 명시적 호스트가 있는 주소(`http(s)://`, `//`)만 외부로 본다.
   */
  siteOrigin?: string;
}

/**
 * Markdown을 React 노드로 바꾼다. 서버(RSC)에서 쓰고, 관리자 프리뷰(M3)도 같은 함수를 쓸 수 있다.
 * 결과는 sanitize를 통과한 hast뿐이라 dangerouslySetInnerHTML 없이 React 요소로만 만든다.
 * 래퍼 요소는 만들지 않는다. 호출하는 쪽이 `.prose-jblog` 같은 컨테이너에 넣는다.
 */
export async function renderMarkdown(
  markdown: string,
  options: RenderOptions = {},
): Promise<ReactNode> {
  const { siteOrigin } = options;
  const tree = await markdownToSafeHast(markdown);
  const SiteLink = (props: ComponentProps<'a'>) => <MdLink {...props} siteOrigin={siteOrigin} />;
  return toJsxRuntime(tree, {
    Fragment,
    jsx,
    jsxs,
    components: { pre: CodeBlock, img: MdImage, a: SiteLink, input: MdCheckbox },
  });
}
