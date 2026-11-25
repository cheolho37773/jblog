import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import type { ComponentProps, ReactNode } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { CodeBlock } from './CodeBlock';
import { MdCheckbox } from './MdCheckbox';
import { MdImage } from './MdImage';
import { MdLink } from './MdLink';
import { markdownToSafeHast } from './processor';

export interface RenderOptions {
  /** 외부 링크 판정의 기준 오리진. 없으면 NEXT_PUBLIC_SITE_URL의 오리진을 쓴다. */
  siteOrigin?: string;
}

// env는 server-only라 서버 밖(브라우저 프리뷰·단위 테스트)에서는 불러올 수 없다.
// 그때는 기준 없이 판정한다(명시적 호스트가 있는 주소만 외부). 브라우저 쪽은 siteOrigin을 직접 넘긴다.
async function defaultSiteOrigin(): Promise<string | undefined> {
  try {
    const { env } = await import('@/lib/env');
    return new URL(env.public.NEXT_PUBLIC_SITE_URL).origin;
  } catch {
    return undefined;
  }
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
  const siteOrigin = options.siteOrigin ?? (await defaultSiteOrigin());
  const tree = await markdownToSafeHast(markdown);
  const SiteLink = (props: ComponentProps<'a'>) => <MdLink {...props} siteOrigin={siteOrigin} />;
  return toJsxRuntime(tree, {
    Fragment,
    jsx,
    jsxs,
    components: { pre: CodeBlock, img: MdImage, a: SiteLink, input: MdCheckbox },
  });
}
