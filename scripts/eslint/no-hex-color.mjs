// hex 색 직접 사용 금지 규칙 (프론트엔드 §5.1 "규칙": 컴포넌트에서 hex 하드코딩 금지).
// 색은 `globals.css`의 디자인 토큰(Tailwind 유틸·CSS 변수)으로만 쓴다.
//
// 판정은 일부러 단순하게 둔다. "번호처럼 보이는 예외"를 목록으로 좁히면 새 누락이 계속 생겼기 때문이다
// (Codex r1~r3). 예외 목록 없이 아래 두 줄로만 정한다.
//   거부: 문자열·템플릿 리터럴·JSX 속성 문자열에서 `#` + hex 3·4·6·8자, `#` 앞이 문자열 시작·공백·`_`(Tailwind
//         임의 값의 공백)·`[ ( , : ; = ' " \`` 같은 단어가 아닌 경계, 뒤가 단어 글자가 아닌 것
//   허용: `#` 바로 앞이 단어 글자·`/`·`.` 등인 URL 조각(`/blog#add`, `snake_case#add`), `href` 값(JSX 속성,
//         객체 키 `href`·`'href'`·`['href']`), 주석, JSX 본문 텍스트, 정규식, 길이·글자 조건이 안 맞는 토큰(`#12345`, `#Issue`)
// 대가: 문자열 안의 숫자뿐인 `'#123'`·`Issue #123`도 색으로 거부한다. 번호 표기는 JSX 본문 텍스트로 쓰거나
//       `'#' + number`처럼 조립한다.

const HEX_COLOR_LENGTHS = new Set([3, 4, 6, 8]);
const CANDIDATE = /(^|[\s_[(:,;='"`{])#([0-9a-fA-F]+)(?![\w-])/g;
const ANCHOR_KEYS = new Set(['href']);

/** @param {string} text */
export function findHexColors(text) {
  return [...text.matchAll(CANDIDATE)]
    .map((match) => match[2] ?? '')
    .filter((digits) => HEX_COLOR_LENGTHS.has(digits.length))
    .map((digits) => `#${digits}`);
}

/**
 * ESTree 타입에는 JSX 노드가 없어서 필요한 모양만 적어 둔다.
 * @typedef {{ type: string, parent?: LooseNode, name?: { name?: unknown }, key?: { type: string, name?: string, value?: unknown }, value?: unknown }} LooseNode
 */

/**
 * 속성 키 이름. 식별자(`href`)와 문자열 키(`'href'`, `['href']`)를 같게 본다.
 * @param {LooseNode} property
 */
function propertyKeyName(property) {
  const { key } = property;
  if (key?.type === 'Identifier') return String(key.name);
  return key?.type === 'Literal' ? String(key.value) : '';
}

/** @param {LooseNode | null | undefined} node */
function isAnchorValue(node) {
  const parent = node?.parent;
  if (!parent) return false;
  if (parent.type === 'JSXAttribute') return ANCHOR_KEYS.has(String(parent.name?.name));
  if (parent.type === 'JSXExpressionContainer') return isAnchorValue(parent);
  if (parent.type === 'Property' && parent.value === node) {
    return ANCHOR_KEYS.has(propertyKeyName(parent));
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
        "hex 색 '{{color}}'을 직접 쓰지 않는다. 디자인 토큰(globals.css)의 Tailwind 유틸·CSS 변수를 쓴다 (프론트엔드 §5.1). 이슈 번호 같은 '#123'이면 JSX 본문 텍스트나 '#' + 숫자 조립으로 쓴다.",
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
