// hex 색 직접 사용 금지 규칙 (프론트엔드 §5.1 "규칙": 컴포넌트에서 hex 하드코딩 금지).
// 색은 `globals.css`의 디자인 토큰(Tailwind 유틸·CSS 변수)으로만 쓴다.
//
// 검사: 문자열 리터럴, 템플릿 리터럴, JSX 속성의 문자열 값 (`text-[#4B6BFB]`, `'#fff'`, `#181A2A80`)
// 허용(오탐 방지. 놓치는 쪽보다 오탐이 적은 쪽을 택한다):
//   - 주석, JSX 본문 텍스트, 정규식 리터럴 (색을 쓰는 곳이 아니다)
//   - 앵커·URL 조각: 값이 `href`(JSX 속성·객체 키)인 경우, 그리고 `#` 바로 앞이 공백이 아닌 경우
//     (`/blog#add`, `page#face`). hex 색은 값 시작·공백·`[`·`(`·`:`·`,` 뒤에 오지만 URL 조각은 단어/경로 뒤에 붙는다
//   - 명확한 번호 문맥: 숫자뿐인 토큰이면서 (a) 바로 앞이 글자로만 된 일반 단어+공백(`Issue #123`, `No. #1`)이거나
//     (b) 뒤에 `번`·`호`가 붙은 경우(`#123번`). CSS 값 문맥은 예외가 없다: 앞 단어가 숫자 섞인 단위(`4px #000`),
//     border 스타일·`inset`·`none` 같은 CSS 키워드(`1px solid #000`), 색 이름이면 색으로 본다
//   - hex 길이가 3·4·6·8이 아니거나 뒤에 단어 글자가 이어지는 토큰 (`#Issue`, `#12345`, `#fffff0x`)
// 한계: `title="Color #abc"`처럼 문장 속 공백 뒤 hex 글자 단어(`#add`, `#bad`)는 색으로 본다(거부 쪽).
//       href가 아닌 곳의 `"#main"` 같은 단독 앵커 문자열도 hex 글자 3자라면 색으로 본다.

const HEX_COLOR_LENGTHS = new Set([3, 4, 6, 8]);
// `_`는 Tailwind 임의 값의 공백 표기(`shadow-[0_2px_4px_#000]`)라 공백과 같은 경계로 본다.
//   `#` 바로 앞이 `_`일 때만이다: `snake_case#add`처럼 단어 뒤에 붙은 `#`는 여전히 URL 조각이다.
// `#` 앞이 공백이 아닌 글자(단어·`/`·`&` 등)면 URL 조각이다. 문자열 시작·공백·기호 `[ ( : , ; = '` 뒤만 후보.
const CANDIDATE = /(^|[\s_[(:,;='"`{])#([0-9a-fA-F]+)(?![\w-])/g;
// 앞 단어: 글자로만 되고(숫자·단위 섞이면 `4px`처럼 CSS 값이다) 끝에 마침표 하나까지 허용(`No.`)
const ISSUE_REFERENCE_PREFIX = /(?:^|\s)([A-Za-z]+)\.?\s$/;
const KOREAN_NUMBER_SUFFIX = /^[번호]/;
// 번호 문맥으로 오해하기 쉬운 CSS 값 단어. 이 뒤의 숫자 hex는 색이다 (`1px solid #000`)
const CSS_VALUE_WORDS = new Set([
  'solid',
  'dashed',
  'dotted',
  'double',
  'groove',
  'ridge',
  'inset',
  'outset',
  'none',
  'transparent',
  'black',
  'white',
  'red',
  'green',
  'blue',
  'gray',
  'grey',
  'yellow',
  'orange',
  'purple',
  'to',
  'from',
]);
const DIGITS_ONLY = /^\d+$/;
const ANCHOR_KEYS = new Set(['href']);

/**
 * @param {string} before `#` 앞 텍스트
 * @param {string} after 토큰 뒤 텍스트
 */
function isIssueNumber(before, after) {
  if (KOREAN_NUMBER_SUFFIX.test(after)) return true;
  const word = ISSUE_REFERENCE_PREFIX.exec(before)?.[1];
  return word !== undefined && !CSS_VALUE_WORDS.has(word.toLowerCase());
}

/** @param {string} text */
export function findHexColors(text) {
  const found = [];
  for (const match of text.matchAll(CANDIDATE)) {
    const lead = match[1] ?? '';
    const digits = match[2] ?? '';
    if (!HEX_COLOR_LENGTHS.has(digits.length)) continue;
    const before = text.slice(0, match.index + lead.length);
    if (
      DIGITS_ONLY.test(digits) &&
      isIssueNumber(before, text.slice(match.index + match[0].length))
    ) {
      continue;
    }
    found.push(`#${digits}`);
  }
  return found;
}

/**
 * ESTree 타입에는 JSX 노드가 없어서 필요한 모양만 적어 둔다.
 * @typedef {{ type: string, parent?: LooseNode, name?: { name?: unknown }, key?: { type: string, name?: string }, value?: unknown }} LooseNode
 */

/** @param {LooseNode | null | undefined} node */
function isAnchorValue(node) {
  const parent = node?.parent;
  if (!parent) return false;
  if (parent.type === 'JSXAttribute') return ANCHOR_KEYS.has(String(parent.name?.name));
  if (parent.type === 'JSXExpressionContainer') return isAnchorValue(parent);
  if (parent.type === 'Property' && parent.value === node) {
    return parent.key?.type === 'Identifier' && ANCHOR_KEYS.has(String(parent.key.name));
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
export const noHexColorRule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      hexColor:
        "hex 색 '{{color}}'을 직접 쓰지 않는다. 디자인 토큰(globals.css)의 Tailwind 유틸·CSS 변수를 쓴다 (프론트엔드 §5.1).",
    },
  },
  create(context) {
    /**
     * @param {import('eslint').Rule.Node} node
     * @param {string} text
     */
    function check(node, text) {
      for (const color of findHexColors(text)) {
        context.report({ node, messageId: 'hexColor', data: { color } });
      }
    }

    return {
      Literal(node) {
        if (
          typeof node.value !== 'string' ||
          isAnchorValue(/** @type {LooseNode} */ (/** @type {unknown} */ (node)))
        )
          return;
        check(node, node.value);
      },
      TemplateElement(node) {
        // 템플릿 href(`href={`#add`}`)도 앵커다. 문자열 노드는 TemplateLiteral의 자식이다.
        if (isAnchorValue(/** @type {LooseNode} */ (/** @type {unknown} */ (node.parent)))) return;
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};
