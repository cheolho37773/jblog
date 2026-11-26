import type { ShikiTransformer } from 'shiki';

// 코드 제목: 펜스 메타 `title="파일명"` (지시서 "문법 확정"). 메타가 없으면 제목 줄이 없다.
// shiki가 `pre`를 새로 만들어 원래 노드를 버리므로, 메타는 shiki의 메타 훅으로 읽고 새 `pre`에 data-title로 싣는다.
const TITLE_META = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)')/;

export const CODE_TITLE_ATTRIBUTE = 'data-title';

/** shiki `parseMetaString`용: 펜스 메타 문자열에서 title을 뽑는다. */
export function parseCodeMeta(meta: string): { title: string } | undefined {
  const match = TITLE_META.exec(meta);
  const title = match?.[1] ?? match?.[2];
  return title ? { title } : undefined;
}

/** `parseCodeMeta`가 뽑은 title을 `pre`의 data-title 속성으로 옮긴다. CodeBlock이 제목 줄로 그린다. */
export const codeTitleTransformer: ShikiTransformer = {
  name: 'jblog:code-title',
  pre(node) {
    const title = this.options.meta?.title;
    if (typeof title === 'string') node.properties[CODE_TITLE_ATTRIBUTE] = title;
  },
};
