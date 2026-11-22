// hex 색 직접 사용 금지 규칙 (프론트엔드 §5.1 "규칙": 컴포넌트에서 hex 하드코딩 금지).
// 색은 `globals.css`의 디자인 토큰(Tailwind 유틸·CSS 변수)으로만 쓴다.
//
// 검사: 문자열 리터럴, 템플릿 리터럴, JSX 속성의 문자열 값 (`text-[#4B6BFB]`, `'#fff'`, `#181A2A80`)
// 허용(오탐 방지. 놓치는 쪽보다 오탐이 적은 쪽을 택한다):
//   - 주석, JSX 본문 텍스트, 정규식 리터럴 (색을 쓰는 곳이 아니다)
//   - 앵커·URL 조각: 값이 `href`(JSX 속성·객체 키)인 경우, 그리고 `#` 바로 앞이 공백이 아닌 경우
//     (`/blog#add`, `page#face`). hex 색은 값 시작·공백·`[`·`(`·`:`·`,` 뒤에 오지만 URL 조각은 단어/경로 뒤에 붙는다
//   - 단어 뒤 공백 다음의 숫자뿐인 번호(`Issue #123`, `PR #1024`)
//   - hex 길이가 3·4·6·8이 아니거나 뒤에 단어 글자가 이어지는 토큰 (`#Issue`, `#12345`, `#fffff0x`)
// 한계: `title="Color #abc"`처럼 문장 속 공백 뒤 hex 글자 단어(`#add`, `#bad`)는 색으로 본다(거부 쪽).
//       href가 아닌 곳의 `"#main"` 같은 단독 앵커 문자열도 hex 글자 3자라면 색으로 본다.

const HEX_COLOR_LENGTHS = new Set([3, 4, 6, 8]);
// `#` 앞이 공백이 아닌 글자(단어·`/`·`&` 등)면 URL 조각이다. 문자열 시작·공백·기호 `[ ( : , ; = '` 뒤만 후보.
const CANDIDATE = /(^|[\s[(:,;='"`{])#([0-9a-fA-F]+)(?![\w-])/g;
const ISSUE_REFERENCE_PREFIX = /[A-Za-z]\s$/;
const DIGITS_ONLY = /^\d+$/;
const ANCHOR_KEYS = new Set(['href']);

/** @param {string} text */
export function findHexColors(text) {
  const found = [];
  for (const match of text.matchAll(CANDIDATE)) {
    const lead = match[1] ?? '';
    const digits = match[2] ?? '';
    if (!HEX_COLOR_LENGTHS.has(digits.length)) continue;
    const before = text.slice(0, match.index + lead.length);
    if (DIGITS_ONLY.test(digits) && ISSUE_REFERENCE_PREFIX.test(before)) continue;
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
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};
