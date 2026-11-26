import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

/**
 * M2-05 ① 단계: 지시서 "문법 확정"·"동작 규약 1~5"로 쓴 테스트다 (구현을 보기 전에 작성).
 * 구현(`./index`)이 아직 없는 단계에서도 typecheck·다른 테스트가 깨지지 않도록 동적 import로 불러온다.
 * 모듈이 없으면 이 파일의 테스트가 "모듈을 찾지 못함"으로 실패한다(의도한 실패).
 */

interface Heading {
  depth: 2 | 3;
  text: string;
  id: string;
}
interface MarkdownModule {
  renderMarkdown: (md: string, options?: { siteOrigin?: string }) => Promise<ReactNode>;
  extractHeadings: (md: string) => Heading[];
}

// 변수 경로로 불러 정적 분석(tsc·번들러)이 모듈 존재를 미리 요구하지 않게 한다.
const MODULE_PATH = './index';
const loadModule = () => import(/* @vite-ignore */ MODULE_PATH) as Promise<MarkdownModule>;

async function renderMd(md: string, options?: { siteOrigin?: string }) {
  const { renderMarkdown } = await loadModule();
  const node = await renderMarkdown(md, options);
  return render(<div data-testid="root">{node}</div>);
}

const CALLOUT_NAMES = [
  ['NOTE', '참고'],
  ['TIP', '팁'],
  ['IMPORTANT', '중요'],
  ['WARNING', '주의'],
  ['CAUTION', '경고'],
] as const;

describe('gfm', () => {
  it('표는 table 역할과 헤더·셀로 렌더된다', async () => {
    await renderMd('| 이름 | 값 |\n| --- | --- |\n| a | 1 |\n| b | 2 |\n');
    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['이름', '값']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
  });

  it('체크리스트는 체크박스로 렌더되고 체크 상태가 유지된다', async () => {
    await renderMd('- [x] 끝낸 일\n- [ ] 할 일\n');
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();
  });

  it('취소선은 del 요소다', async () => {
    const { container } = await renderMd('~~지운 글~~');
    expect(container.querySelector('del')).toHaveTextContent('지운 글');
  });

  it('자동 링크는 링크가 된다', async () => {
    await renderMd('https://example.com/docs 를 보세요');
    expect(screen.getByRole('link', { name: 'https://example.com/docs' })).toHaveAttribute(
      'href',
      'https://example.com/docs',
    );
  });
});

describe('콜아웃', () => {
  it.each(CALLOUT_NAMES)('%s 콜아웃은 role=note, 이름 "%s"인 aside다', async (kind, name) => {
    await renderMd(`> [!${kind}]\n> 콜아웃 내용입니다.\n`);
    const callout = screen.getByRole('note', { name });
    expect(callout.tagName).toBe('ASIDE');
    expect(callout).toHaveTextContent('콜아웃 내용입니다.');
  });

  it('종류 표기는 대소문자를 구분하지 않는다', async () => {
    await renderMd('> [!tip]\n> 소문자\n');
    expect(screen.getByRole('note', { name: '팁' })).toBeInTheDocument();
  });

  it('[!NOTE] 표시 문자열은 본문에 남지 않는다', async () => {
    await renderMd('> [!NOTE]\n> 내용\n');
    expect(screen.getByTestId('root')).not.toHaveTextContent('[!NOTE]');
  });

  it('콜아웃 안의 Markdown(굵게)도 렌더된다', async () => {
    await renderMd('> [!WARNING]\n> **조심**하세요\n');
    const callout = screen.getByRole('note', { name: '주의' });
    expect(callout.querySelector('strong')).toHaveTextContent('조심');
  });

  it('모르는 종류는 콜아웃이 아니라 일반 인용문이다', async () => {
    const { container } = await renderMd('> [!FOO]\n> 모르는 종류\n');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(container.querySelector('blockquote')).toHaveTextContent('모르는 종류');
  });

  it('표시 없는 인용문은 일반 인용문이다', async () => {
    const { container } = await renderMd('> 그냥 인용\n');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(container.querySelector('blockquote')).toHaveTextContent('그냥 인용');
  });
});

describe('코드 블록', () => {
  const TS_BLOCK = '```ts title="example.ts"\nexport const a: number = 1;\n```';

  it('펜스 메타 title이 있으면 코드 블록 위에 파일명 제목이 나온다', async () => {
    await renderMd(TS_BLOCK);
    expect(screen.getByText('example.ts')).toBeInTheDocument();
  });

  it('메타가 없으면 제목 줄이 없다', async () => {
    const { container } = await renderMd('```ts\nexport const a: number = 1;\n```');
    expect(container.querySelector('pre')).toBeInTheDocument();
    expect(screen.queryByText('example.ts')).not.toBeInTheDocument();
    // 제목 자리에 title 문자열이 새어 나오지 않는다.
    expect(screen.getByTestId('root')).not.toHaveTextContent('title=');
  });

  it('언어 하이라이트: shiki 토큰이 Light·Dark 색 변수(--shiki-dark)를 가진다', async () => {
    const { container } = await renderMd(TS_BLOCK);
    const tokens = container.querySelectorAll('pre code span[style]');
    expect(tokens.length).toBeGreaterThan(1);
    const darkVariable = container.querySelector('pre code span[style*="--shiki-dark"]');
    expect(darkVariable, 'dark 테마 색은 CSS 변수로 들어가야 새로고침 없이 바뀐다').not.toBeNull();
  });

  it('코드 블록마다 접근 가능한 이름 "코드 복사" 버튼 자리가 있다', async () => {
    await renderMd('```ts\nconst a = 1;\n```\n\n```js\nconst b = 2;\n```');
    expect(screen.getAllByRole('button', { name: '코드 복사' })).toHaveLength(2);
  });

  it('코드 내용은 원문 그대로 텍스트로 남는다(HTML로 해석되지 않는다)', async () => {
    const { container } = await renderMd('```html\n<script>alert(1)</script>\n```');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('pre')?.textContent).toContain('<script>alert(1)</script>');
  });
});

describe('이미지', () => {
  it('제목 속성이 있으면 figure·figcaption으로 캡션을 보여 준다', async () => {
    await renderMd('![대체 텍스트](/uploads/a.png "그림 1. 캡션")');
    const figure = screen.getByRole('figure');
    expect(within(figure).getByRole('img', { name: '대체 텍스트' })).toBeInTheDocument();
    expect(figure.querySelector('figcaption')).toHaveTextContent('그림 1. 캡션');
  });

  it('제목 속성이 없으면 figure 없이 이미지만 나온다', async () => {
    await renderMd('![대체 텍스트](/uploads/a.png)');
    expect(screen.getByRole('img', { name: '대체 텍스트' })).toBeInTheDocument();
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });

  it('alt가 없으면 빈 alt 이미지가 된다', async () => {
    const { container } = await renderMd('![](/uploads/a.png)');
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('alt', '');
  });

  it('이미지는 지연 로딩·비동기 디코딩이다(next/image가 아닌 일반 img, G2)', async () => {
    const { container } = await renderMd('![x](/uploads/a.png)');
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveAttribute('src', '/uploads/a.png');
  });
});

describe('헤딩 id·앵커', () => {
  it('h2·h3에 rehype-slug 규칙의 id가 붙는다(영문은 소문자·하이픈, 한글은 그대로)', async () => {
    const { container } = await renderMd('## Hello World\n\n### 시작하기\n');
    expect(container.querySelector('h2')).toHaveAttribute('id', 'hello-world');
    expect(container.querySelector('h3')).toHaveAttribute('id', '시작하기');
  });

  it('같은 이름의 헤딩은 -1, -2가 붙는다', async () => {
    const { container } = await renderMd('## 개요\n\n## 개요\n\n## 개요\n');
    const ids = [...container.querySelectorAll('h2')].map((h) => h.id);
    expect(ids).toEqual(['개요', '개요-1', '개요-2']);
  });

  it('헤딩 안에 자기 id를 가리키는 앵커 링크가 있다', async () => {
    const { container } = await renderMd('## Hello World\n');
    const heading = container.querySelector('h2');
    expect(heading?.querySelector('a[href="#hello-world"]')).not.toBeNull();
  });
});

describe('링크', () => {
  it('외부 링크는 새 탭으로 열고 noopener noreferrer를 가진다', async () => {
    await renderMd('[외부](https://example.com/page)');
    const link = screen.getByRole('link', { name: '외부' });
    expect(link).toHaveAttribute('target', '_blank');
    const rel = link.getAttribute('rel') ?? '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('프로토콜 상대 주소(//host)도 다른 오리진이라 외부 링크로 취급한다', async () => {
    await renderMd('[외부](//example.org/x)');
    const link = screen.getByRole('link', { name: '외부' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel') ?? '').toContain('noopener');
  });

  it('내부 링크에는 target=_blank가 없다', async () => {
    await renderMd('[내부](/blog/some-post) [앵커](#top)');
    for (const name of ['내부', '앵커']) {
      const link = screen.getByRole('link', { name });
      expect(link).not.toHaveAttribute('target');
    }
    expect(screen.getByRole('link', { name: '내부' })).toHaveAttribute('href', '/blog/some-post');
  });
});

describe('XSS 거부 (sanitize)', () => {
  const hasEventHandlerAttribute = (root: HTMLElement) =>
    [...root.querySelectorAll('*')].some((el) =>
      el.getAttributeNames().some((name) => name.toLowerCase().startsWith('on')),
    );

  it('raw <script>는 요소로 남지 않는다', async () => {
    const { container } = await renderMd('앞\n\n<script>window.hacked = 1</script>\n\n뒤');
    expect(container.querySelector('script')).toBeNull();
  });

  it('raw <img onerror>는 이미지도 이벤트 속성도 남기지 않는다', async () => {
    const { container } = await renderMd('<img src="x" onerror="window.hacked = 1">');
    expect(container.querySelector('img')).toBeNull();
    expect(hasEventHandlerAttribute(container)).toBe(false);
  });

  it('raw <iframe>은 렌더링되지 않는다', async () => {
    const { container } = await renderMd('<iframe src="https://evil.example"></iframe>');
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('raw <style>은 렌더링되지 않는다', async () => {
    const { container } = await renderMd('<style>body { display: none }</style>\n\n본문');
    expect(container.querySelector('style')).toBeNull();
  });

  it('원문의 raw HTML 태그(div·span·on* 속성·style 속성)는 요소로 렌더링되지 않는다', async () => {
    const { container } = await renderMd(
      '<div class="raw-box" onclick="x()">상자</div>\n\n<span style="position:fixed;top:0;color:red">떠 있음</span>',
    );
    expect(container.querySelector('.raw-box')).toBeNull();
    expect(hasEventHandlerAttribute(container)).toBe(false);
    expect(container.querySelector('[style*="position"]')).toBeNull();
    expect(container.querySelector('[style*="red"]')).toBeNull();
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<b>x</b>',
  ])('링크 주소 %s는 href로 남지 않는다', async (url) => {
    const { container } = await renderMd(`[클릭](${url})`);
    const hrefs = [...container.querySelectorAll('a')].map((a) =>
      (a.getAttribute('href') ?? '').trim().toLowerCase(),
    );
    for (const href of hrefs) {
      expect(href).not.toMatch(/^(javascript|vbscript|data):/);
    }
  });

  it('이미지 주소 javascript:는 src로 남지 않는다', async () => {
    const { container } = await renderMd('![x](javascript:alert(1))');
    for (const img of container.querySelectorAll('img')) {
      expect((img.getAttribute('src') ?? '').toLowerCase()).not.toMatch(/^javascript:/);
    }
  });

  it('style 속성은 shiki 테마 색(--shiki-*·color·background)만 남고 위치·URL 주입은 없다', async () => {
    const { container } = await renderMd(
      '```ts\nconst a = 1;\n```\n\n<p style="position:fixed;background:url(https://evil.example/x)">주입</p>',
    );
    const styles = [...container.querySelectorAll('[style]')].map(
      (el) => el.getAttribute('style') ?? '',
    );
    expect(styles.length, 'shiki 인라인 스타일은 남아야 한다').toBeGreaterThan(0);
    for (const value of styles) {
      expect(value).not.toMatch(/position|url\(|expression|z-index|display|top\s*:|left\s*:/i);
    }
  });

  it('공격 문자열이 섞인 문서에서도 정상 본문은 그대로 렌더된다', async () => {
    await renderMd('## 제목\n\n<script>x()</script>\n\n정상 문단입니다.\n');
    expect(screen.getByRole('heading', { level: 2, name: /제목/ })).toBeInTheDocument();
    expect(screen.getByText('정상 문단입니다.')).toBeInTheDocument();
  });
});

describe('extractHeadings', () => {
  const DOC = [
    '# 문서 제목',
    '## 첫째 Section',
    '본문',
    '### 첫째 하위',
    '#### 깊은 헤딩',
    '## 둘째',
    '```md',
    '## 코드 안의 헤딩',
    '```',
    '## 둘째',
    '### 첫째 하위',
  ].join('\n');

  it('h2·h3만 문서 순서대로 뽑는다(h1·h4와 코드 블록 안 헤딩은 제외)', async () => {
    const { extractHeadings } = await loadModule();
    expect(extractHeadings(DOC).map((h) => [h.depth, h.text])).toEqual([
      [2, '첫째 Section'],
      [3, '첫째 하위'],
      [2, '둘째'],
      [2, '둘째'],
      [3, '첫째 하위'],
    ]);
  });

  it('중복 이름은 -1, -2를 붙인다', async () => {
    const { extractHeadings } = await loadModule();
    expect(extractHeadings(DOC).map((h) => h.id)).toEqual([
      '첫째-section',
      '첫째-하위',
      '둘째',
      '둘째-1',
      '첫째-하위-1',
    ]);
  });

  it('렌더 결과의 h2·h3 id와 같다', async () => {
    const { extractHeadings } = await loadModule();
    const { container } = await renderMd(DOC);
    const rendered = [...container.querySelectorAll('h2, h3')].map((h) => h.id);
    expect(extractHeadings(DOC).map((h) => h.id)).toEqual(rendered);
  });

  it('헤딩 안의 인라인 서식은 걷어낸 글자만 text로 준다', async () => {
    const { extractHeadings } = await loadModule();
    expect(extractHeadings('## **굵게** 와 `코드` 제목')).toEqual([
      { depth: 2, text: '굵게 와 코드 제목', id: '굵게-와-코드-제목' },
    ]);
  });

  it('헤딩이 없으면 빈 배열이다', async () => {
    const { extractHeadings } = await loadModule();
    expect(extractHeadings('그냥 문단')).toEqual([]);
  });
});

describe('Codex r1 회귀', () => {
  it.each(['constructor', '__proto__', 'toString'])(
    '상속 이름 콜아웃 [!%s]는 예외 없이 일반 인용문이다',
    async (name) => {
      const { container } = await renderMd(`> [!${name}]\n> 본문입니다\n`);
      expect(container.querySelector('blockquote')).not.toBeNull();
      expect(container.querySelector('aside')).toBeNull();
    },
  );

  it('문장 속 캡션 이미지는 앞뒤 글자를 보존하고 figure로 분리된다', async () => {
    const { container } = await renderMd('앞 ![alt](/uploads/a.png "캡션") 뒤');
    const figure = container.querySelector('figure');
    expect(figure?.querySelector('img')).not.toBeNull();
    expect(figure?.querySelector('figcaption')).toHaveTextContent('캡션');
    expect(container.textContent).toContain('앞');
    expect(container.textContent).toContain('뒤');
  });

  it('한 문단의 캡션 이미지 2개는 figure 2개이고 글자가 보존된다', async () => {
    const { container } = await renderMd(
      '가 ![a](/uploads/a.png "첫째") 나 ![b](/uploads/b.png "둘째") 다',
    );
    expect(container.querySelectorAll('figure')).toHaveLength(2);
    for (const word of ['가', '나', '다']) expect(container.textContent).toContain(word);
  });

  it('캡션 없는 문장 속 이미지는 figure 없이 그대로 남는다', async () => {
    const { container } = await renderMd('앞 ![alt](/uploads/a.png) 뒤');
    expect(container.querySelector('figure')).toBeNull();
    expect(container.querySelector('p img')).not.toBeNull();
    expect(container.textContent).toContain('앞');
    expect(container.textContent).toContain('뒤');
  });

  describe('Codex r2: 링크·강조 안의 캡션 이미지', () => {
    it('이미지만 감싼 링크는 figure 안에서 링크 목적지를 유지하고 캡션을 보여 준다', async () => {
      const { container } = await renderMd('[![alt](/uploads/a.png "캡션")](https://example.com)');
      const figure = container.querySelector('figure');
      const link = figure?.querySelector('a[href="https://example.com"]');
      expect(link).not.toBeNull();
      expect(link?.querySelector('img[alt="alt"]')).not.toBeNull();
      expect(figure?.querySelector('figcaption')).toHaveTextContent('캡션');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link?.getAttribute('rel')).toContain('noopener');
    });

    it('굵게 안의 캡션 이미지는 figure로 빠진다', async () => {
      const { container } = await renderMd('**![alt](/uploads/a.png "캡션")**');
      const figure = container.querySelector('figure');
      expect(figure?.querySelector('img')).not.toBeNull();
      expect(figure?.querySelector('figcaption')).toHaveTextContent('캡션');
    });

    it('기울임 안의 캡션 이미지는 figure로 빠지고 남은 글자는 강조 서식을 유지한다', async () => {
      const { container } = await renderMd('*앞 ![alt](/uploads/a.png "캡션") 뒤*');
      const figure = container.querySelector('figure');
      expect(figure?.querySelector('img')).not.toBeNull();
      expect(figure?.querySelector('figcaption')).toHaveTextContent('캡션');
      const emphasized = Array.from(container.querySelectorAll('em')).map((e) => e.textContent);
      expect(emphasized.some((t) => t?.includes('앞'))).toBe(true);
      expect(emphasized.some((t) => t?.includes('뒤'))).toBe(true);
    });
  });

  describe('Codex r3: 링크 안 글자와 캡션 이미지', () => {
    const hrefsOf = (container: HTMLElement) =>
      Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));

    it('링크 안 글자+캡션 이미지는 글자 링크 조각과 figure(링크 감싼 이미지+캡션)로 나뉜다', async () => {
      const { container } = await renderMd('[글자 ![alt](/uploads/a.png "캡션")](/blog/x)');
      const textLink = Array.from(container.querySelectorAll('a[href="/blog/x"]')).find((a) =>
        a.textContent?.includes('글자'),
      );
      expect(textLink).toBeDefined();
      expect(container.querySelector('figure > a[href="/blog/x"] > img[alt="alt"]')).not.toBeNull();
      expect(container.querySelector('figure figcaption')).toHaveTextContent('캡션');
      expect(new Set(hrefsOf(container))).toEqual(new Set(['/blog/x']));
    });

    it('강조로 감싼 링크 안 캡션 이미지도 figure와 같은 목적지 링크로 나온다', async () => {
      const { container } = await renderMd('[**![alt](/uploads/a.png "캡션")**](/blog/x)');
      expect(container.querySelector('figure img[alt="alt"]')).not.toBeNull();
      expect(container.querySelector('figure figcaption')).toHaveTextContent('캡션');
      expect(container.querySelector('figure a[href="/blog/x"] img')).not.toBeNull();
      expect(new Set(hrefsOf(container))).toEqual(new Set(['/blog/x']));
    });

    it('외부 링크 안에서 갈라진 글자 조각과 figure 안 링크 모두 target·rel을 유지한다', async () => {
      const { container } = await renderMd(
        '[앞 ![alt](/uploads/a.png "캡션") 뒤](https://example.com)',
      );
      const links = Array.from(container.querySelectorAll('a'));
      const texts = links.map((a) => a.textContent ?? '');
      expect(texts.some((t) => t.includes('앞'))).toBe(true);
      expect(texts.some((t) => t.includes('뒤'))).toBe(true);
      expect(container.querySelector('figure a img')).not.toBeNull();
      expect(links.length).toBeGreaterThanOrEqual(3);
      for (const link of links) {
        expect(link).toHaveAttribute('href', 'https://example.com');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
      }
    });

    it.each([
      '[글자 ![alt](/uploads/a.png "캡션")](/blog/x)',
      '[**![alt](/uploads/a.png "캡션")**](/blog/x)',
      '앞 ![alt](/uploads/a.png "캡션") 뒤',
    ])('figure는 p 안에 들어가지 않는다: %s', async (md) => {
      const { container } = await renderMd(md);
      expect(container.querySelector('figure')).not.toBeNull();
      expect(container.querySelectorAll('p figure')).toHaveLength(0);
    });
  });

  describe('Codex r3 ③: 캡션 이미지 경계', () => {
    const IMG = '![a](/u.png "캡션")';
    const noFigureInParagraph = (container: HTMLElement) =>
      expect(container.querySelectorAll('p figure')).toHaveLength(0);

    it('한 링크 안 캡션 이미지 2개는 figure 2개이고 목적지가 같으며 사이 글자 링크 조각이 남는다', async () => {
      const { container } = await renderMd(`[앞 ${IMG} 가운데 ${IMG} 뒤](/blog/x)`);
      expect(container.querySelectorAll('figure')).toHaveLength(2);
      expect(container.querySelectorAll('figure a[href="/blog/x"] img')).toHaveLength(2);
      const links = Array.from(container.querySelectorAll('a'));
      expect(links.every((a) => a.getAttribute('href') === '/blog/x')).toBe(true);
      const texts = links.map((a) => a.textContent ?? '');
      for (const word of ['앞', '가운데', '뒤']) {
        expect(texts.some((t) => t.includes(word))).toBe(true);
      }
      noFigureInParagraph(container);
    });

    it('목록 항목 안 문단의 캡션 이미지 figure는 li 안에 있고 p 밖이다', async () => {
      const { container } = await renderMd(`- 항목 ${IMG} 끝\n`);
      expect(container.querySelector('li figure')).not.toBeNull();
      expect(container.querySelector('li figure figcaption')).toHaveTextContent('캡션');
      noFigureInParagraph(container);
    });

    it('콜아웃 안 캡션 이미지 figure는 aside 안에 있다', async () => {
      const { container } = await renderMd(`> [!NOTE]\n> 설명 ${IMG} 끝\n`);
      expect(screen.getByRole('note', { name: '참고' }).querySelector('figure')).not.toBeNull();
      expect(container.querySelector('aside figure figcaption')).toHaveTextContent('캡션');
      noFigureInParagraph(container);
    });

    it('표 셀 안 캡션 이미지는 figure가 되지 않고 title이 남으며 표 구조가 유지된다', async () => {
      const { container } = await renderMd(`| 이름 | 값 |\n| --- | --- |\n| ${IMG} | 1 |\n`);
      expect(container.querySelector('figure')).toBeNull();
      expect(container.querySelector('td img')).toHaveAttribute('title', '캡션');
      const table = screen.getByRole('table');
      expect(within(table).getAllByRole('columnheader')).toHaveLength(2);
      expect(within(table).getAllByRole('row')).toHaveLength(2);
    });

    it('링크 참조 안 캡션 이미지도 글자 링크 조각과 figure(같은 링크)로 나뉜다', async () => {
      const { container } = await renderMd(`[글자 ${IMG}][id]\n\n[id]: /blog/x\n`);
      expect(container.querySelector('figure a[href="/blog/x"] img')).not.toBeNull();
      expect(container.querySelector('figure figcaption')).toHaveTextContent('캡션');
      const links = Array.from(container.querySelectorAll('a'));
      expect(links.some((a) => a.textContent?.includes('글자'))).toBe(true);
      expect(links.every((a) => a.getAttribute('href') === '/blog/x')).toBe(true);
      noFigureInParagraph(container);
    });

    it('취소선 안 링크 안 캡션 이미지는 figure로 빠지고 남은 글자는 취소선을 유지한다', async () => {
      const { container } = await renderMd(`~~앞 [글자 ${IMG}](/blog/x) 뒤~~`);
      expect(container.querySelector('figure a[href="/blog/x"] img')).not.toBeNull();
      expect(container.querySelector('figure figcaption')).toHaveTextContent('캡션');
      const deleted = Array.from(container.querySelectorAll('del')).map((d) => d.textContent ?? '');
      expect(deleted.some((t) => t.includes('글자'))).toBe(true);
      expect(deleted.some((t) => t.includes('앞'))).toBe(true);
      expect(deleted.some((t) => t.includes('뒤'))).toBe(true);
      noFigureInParagraph(container);
    });
  });

  // 계약: renderMarkdown(md, { siteOrigin }) — 외부 링크 판정의 기준 오리진.
  describe('사이트 오리진 기준 링크', () => {
    const siteOrigin = 'https://blog.example.com';
    const linkOf = async (url: string) => {
      const { container } = await renderMd(`[링크](${url})`, { siteOrigin });
      return container.querySelector('a') as HTMLAnchorElement;
    };

    it.each([
      'https://blog.example.com/posts/a',
      '//blog.example.com/posts/a',
      '/posts/a',
      'posts/a',
    ])('내부 링크 %s는 target이 없다', async (url) => {
      expect(await linkOf(url)).not.toHaveAttribute('target');
    });

    it.each(['https://other.example.org/x', '//other.example.org/x'])(
      '외부 링크 %s는 새 탭과 noopener다',
      async (url) => {
        const a = await linkOf(url);
        expect(a).toHaveAttribute('target', '_blank');
        expect(a.getAttribute('rel') ?? '').toContain('noopener');
      },
    );
  });
});
