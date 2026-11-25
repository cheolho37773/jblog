import type { Element, Root } from 'hast';
import { toString } from 'hast-util-to-string';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

export interface Heading {
  depth: 2 | 3;
  text: string;
  id: string;
}

// 렌더링 파이프라인과 같은 단계(parse -> gfm -> rehype -> slug)를 거쳐 id가 렌더 결과와 항상 같다.
// shiki·sanitize는 헤딩을 바꾸지 않으므로 빼서 동기로 끝낸다 (TOC는 서버에서 바로 만든다).
const headingProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSlug);

const HEADING_DEPTH: Record<string, Heading['depth'] | undefined> = { h2: 2, h3: 3 };

/** 본문의 h2·h3을 문서 순서대로 뽑는다. TOC(M2-08)에 쓴다. 코드 블록 안의 `##`는 헤딩이 아니라 제외된다. */
export function extractHeadings(markdown: string): Heading[] {
  const tree = headingProcessor.runSync(headingProcessor.parse(markdown)) as Root;
  const headings: Heading[] = [];
  visit(tree, 'element', (element: Element) => {
    const depth = HEADING_DEPTH[element.tagName];
    const id = element.properties.id;
    if (!depth || typeof id !== 'string') return;
    headings.push({ depth, text: toString(element), id });
  });
  return headings;
}
