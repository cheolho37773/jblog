import type { Options } from 'rehype-sanitize';
import { CODE_TITLE_ATTRIBUTE } from './code-title';

// sanitize 허용 목록 (지시서 규약 3). 기본 스키마를 넓히지 않고 처음부터 좁게 쓴다.
// 이 파이프라인은 원문의 raw HTML을 렌더링하지 않으므로(remark-rehype가 html 노드를 버린다) 아래 목록은
// "마크다운 문법이 만드는 요소 + shiki·헤딩 앵커·콜아웃·캡션이 만드는 요소"만 뜻한다.
// 목록 밖(script·style·iframe·on* 속성 등)은 모두 제거되고, 방어를 겹쳐 두는 마지막 관문이다.

// shiki는 hast 속성을 HTML 이름 그대로(`class`·`tabindex`, 문자열) 만든다. 다른 요소의 `className`(배열)과 이름이 다르다.
const SHIKI_PRE_CLASS = /^shiki shiki-themes jblog-github-[a-z-]+ jblog-github-[a-z-]+$/;

// shiki가 만드는 style은 테마 색 CSS 변수(--shiki-light·--shiki-dark와 -bg 접미사)뿐이다(defaultColor: false).
// position·url()·display 등은 값 모양이 달라 통과하지 못한다. 글꼴 스타일 변수는 테마가 굵게·기울임을 줄 때 붙는다.
const SHIKI_STYLE =
  /^(?:--shiki-(?:light|dark)(?:-bg|-font-style|-font-weight|-text-decoration)?:\s*[#\w\s.-]+;?\s*)+$/;

export const sanitizeSchema: Options = {
  tagNames: [
    ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'blockquote', 'aside'],
    ...['ul', 'ol', 'li', 'input', 'a', 'em', 'strong', 'del', 'code', 'pre', 'span'],
    ...['img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  ],
  attributes: {
    // 헤딩 앵커(rehype-autolink-headings)와 일반 링크. target·rel은 sanitize 뒤 MdLink가 정한다.
    a: ['href', ['className', 'heading-anchor'], 'ariaLabel'],
    span: [
      ['ariaHidden', 'true'],
      ['class', 'line'],
      ['style', SHIKI_STYLE],
    ],
    aside: [['role', 'note'], 'ariaLabel', 'dataCallout'],
    p: ['dataCalloutTitle'],
    // src는 아래 protocols로 http(s)·상대 경로만. title은 figure로 빠지지 못한 캡션 이미지(글자와 섞인 링크 안)의
    // 캡션을 잃지 않게 남긴다. 값이 평범한 문자열이라 스크립트 실행 경로가 없다. figure 이미지에는 title을 붙이지 않는다.
    img: ['src', 'alt', 'title'],
    pre: [
      ['class', SHIKI_PRE_CLASS],
      ['style', SHIKI_STYLE],
      // 가로 스크롤이 생기는 블록은 키보드로 스크롤할 수 있어야 한다(axe scrollable-region-focusable).
      ['tabindex', '0'],
      CODE_TITLE_ATTRIBUTE,
    ],
    // 헤딩 id는 rehype-slug가 만든 값만 온다.
    ...Object.fromEntries(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((tag) => [tag, ['id']])),
    // gfm 체크리스트. 체크박스는 보기 전용이다.
    input: [['type', 'checkbox'], 'checked', ['disabled', true], 'ariaLabel'],
    ul: [['className', 'contains-task-list']],
    ol: [['className', 'contains-task-list'], 'start'],
    li: [['className', 'task-list-item']],
    th: [['align', 'left', 'center', 'right']],
    td: [['align', 'left', 'center', 'right']],
  },
  protocols: {
    // javascript:·vbscript:는 목록에 없어 제거된다. data:는 링크와 이미지 모두 제외한다:
    // 본문 이미지는 /uploads/* 업로드를 쓰고, data: URL은 HTML·SVG 스크립트 주입 통로가 되며 글 용량만 키운다.
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
  // 기본 스키마는 id·name에 `user-content-`를 붙여 DOM 덮어쓰기(clobbering)를 막는다. 여기서는 id가 헤딩 슬러그
  // 하나뿐이고 TOC·앵커가 같은 id를 가리켜야 하므로(extractHeadings와 동일) 접두사를 쓰지 않는다.
  clobber: [],
  clobberPrefix: '',
  // 주석·doctype·script 같은 요소는 기본값대로 걷어낸다.
  allowComments: false,
  allowDoctypes: false,
  strip: ['script', 'style'],
};
