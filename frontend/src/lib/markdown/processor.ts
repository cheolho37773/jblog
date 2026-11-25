import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import type { Root as HastRoot } from 'hast';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSanitize from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { createHighlighter } from 'shiki';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { unified } from 'unified';
import { codeTitleTransformer, parseCodeMeta } from './code-title';
import { rehypeTaskLabels } from './rehype-task-labels';
import { remarkCallout } from './remark-callout';
import { remarkImageCaption } from './remark-image-caption';
import { sanitizeSchema } from './sanitize-schema';
import { loadCodeThemes } from './shiki-themes';

// 파이프라인 순서 (프론트엔드 §5.3, 지시서 규약 2). sanitize는 shiki 뒤, React 변환 앞이다.
//   parse -> gfm -> 콜아웃·이미지 캡션 -> rehype -> slug -> 헤딩 앵커 -> shiki -> 체크박스 라벨 -> sanitize
// raw HTML은 remark-rehype가 html 노드를 버리므로(allowDangerousHtml 미사용) 애초에 트리에 들어오지 않는다.

const HEADING_ANCHOR_LABEL = '섹션 링크';

async function createProcessor() {
  const themes = await loadCodeThemes();
  // 정규식 엔진은 WASM(oniguruma)이 아닌 JavaScript 엔진이다. 서버·브라우저(관리자 프리뷰)·jsdom 테스트에서
  // 같은 코드로 돌고 WASM 파일을 따로 내려받지 않는다. 언어는 쓰일 때 불러온다(langs 비움 + lazy).
  const highlighter = await createHighlighter({
    themes: [themes.light, themes.dark],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkCallout)
    .use(remarkImageCaption)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: 'append',
      properties: { className: ['heading-anchor'], ariaLabel: HEADING_ANCHOR_LABEL },
      content: {
        type: 'element',
        tagName: 'span',
        properties: { ariaHidden: 'true' },
        children: [{ type: 'text', value: '#' }],
      },
    })
    .use(() =>
      rehypeShikiFromHighlighter(highlighter, {
        themes,
        // 색은 CSS 변수(--shiki-light·--shiki-dark)로만 싣고, 어느 쪽을 쓸지는 data-theme 기준 CSS가 정한다.
        // 그래서 테마를 바꿔도 새로고침이 필요 없고, 기본 테마의 인라인 color도 남지 않는다.
        defaultColor: false,
        // 언어가 없거나 모르는 언어도 같은 모양의 블록(배경·복사 버튼)이 되게 한다. 언어는 필요할 때 불러온다.
        defaultLanguage: 'text',
        fallbackLanguage: 'text',
        lazy: true,
        parseMetaString: parseCodeMeta,
        transformers: [codeTitleTransformer],
      }),
    )
    .use(rehypeTaskLabels)
    .use(rehypeSanitize, sanitizeSchema);
}

// 하이라이터 초기화가 무거워 한 번만 만든다. 서버에서는 프로세스당 한 번, 브라우저(프리뷰)에서는 탭당 한 번이다.
let processorPromise: ReturnType<typeof createProcessor> | undefined;

/** Markdown을 sanitize까지 끝낸 hast로 바꾼다. React 변환은 호출하는 쪽이 한다. */
export async function markdownToSafeHast(markdown: string): Promise<HastRoot> {
  processorPromise ??= createProcessor();
  const processor = await processorPromise;
  return processor.run(processor.parse(markdown)) as Promise<HastRoot>;
}
