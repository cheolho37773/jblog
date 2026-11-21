// 금지 이름 규칙 (협업 §10-a "이름"). 우리가 짓는 이름, 즉 선언만 검사한다.
// 내장 id-denylist 대신 로컬 규칙으로 둔 이유: id-denylist는 객체 키·멤버 접근까지 잡아서
// Prisma의 `{ data: ... }`처럼 외부 API가 정한 이름을 쓸 수 없다 (2026-11-21 개발자 승인, G2).
//
// 검사: 변수 선언(구조 분해 포함), 함수·화살표 매개변수(구조 분해·기본값·나머지 포함),
//       함수·클래스 이름, catch 매개변수, 생성자 매개변수 속성(`constructor(private x)`)
// 허용: 객체 리터럴 키, 멤버 접근(`x.data`), 클래스 메서드·속성 이름(인터페이스 구현이 정한 이름),
//       import 이름(외부 모듈이 정한 이름)

// 노드 타입은 eslint 타입 선언에서 끌어온다(@types/estree를 루트 의존성으로 따로 두지 않기 위해서).
/** @typedef {import('eslint').Rule.RuleListener} RuleListener */
/** @typedef {Parameters<NonNullable<RuleListener['VariableDeclarator']>>[0]['id']} Pattern */
/** @typedef {Extract<Pattern, { type: 'Identifier' }>} BindingIdentifier */
/**
 * @typedef {Parameters<NonNullable<RuleListener['FunctionDeclaration']>>[0]
 *   | Parameters<NonNullable<RuleListener['FunctionExpression']>>[0]
 *   | Parameters<NonNullable<RuleListener['ArrowFunctionExpression']>>[0]} FunctionNode
 */

/**
 * 선언 패턴에서 실제로 묶이는 식별자를 모은다. `{ data: post }`는 post만, `{ data }`는 data를 묶는다.
 * @param {Pattern | null | undefined} pattern
 * @returns {BindingIdentifier[]}
 */
export function bindingIdentifiersOf(pattern) {
  if (!pattern) return [];
  switch (pattern.type) {
    case 'Identifier':
      return [pattern];
    case 'ObjectPattern':
      return pattern.properties.flatMap((property) =>
        bindingIdentifiersOf(property.type === 'RestElement' ? property.argument : property.value),
      );
    case 'ArrayPattern':
      return pattern.elements.flatMap((element) => bindingIdentifiersOf(element));
    case 'RestElement':
      return bindingIdentifiersOf(pattern.argument);
    case 'AssignmentPattern':
      return bindingIdentifiersOf(pattern.left);
    default:
      return bindingIdentifiersOfTypeScript(pattern);
  }
}

/**
 * TypeScript 전용 노드: `constructor(private readonly data: X)`의 매개변수 속성.
 * ESTree 타입에는 없는 노드라 필요한 모양만 적어 둔다.
 * @param {{ type: string }} pattern
 * @returns {BindingIdentifier[]}
 */
function bindingIdentifiersOfTypeScript(pattern) {
  if (pattern.type !== 'TSParameterProperty') return [];
  const { parameter } = /** @type {{ parameter: Pattern }} */ (/** @type {unknown} */ (pattern));
  return bindingIdentifiersOf(parameter);
}

/** @type {import('eslint').Rule.RuleModule} */
export const deniedNamesRule = {
  meta: {
    type: 'suggestion',
    schema: { type: 'array', items: { type: 'string' }, uniqueItems: true },
    messages: {
      denied:
        "'{{name}}'은 무엇을 담는지 드러나지 않는 이름이다 (협업 §10-a). 역할이 보이는 이름을 쓴다.",
    },
  },
  create(context) {
    const deniedNames = new Set(context.options);

    /** @param {Pattern | null | undefined} pattern */
    function checkPattern(pattern) {
      for (const identifier of bindingIdentifiersOf(pattern)) {
        if (!deniedNames.has(identifier.name)) continue;
        context.report({ node: identifier, messageId: 'denied', data: { name: identifier.name } });
      }
    }

    /** @param {FunctionNode} node */
    function checkFunction(node) {
      // 화살표 함수에는 이름(id)이 없다.
      if ('id' in node) checkPattern(node.id);
      node.params.forEach(checkPattern);
    }

    return {
      VariableDeclarator: (node) => checkPattern(node.id),
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      ClassDeclaration: (node) => checkPattern(node.id),
      ClassExpression: (node) => checkPattern(node.id),
      CatchClause: (node) => checkPattern(node.param),
    };
  },
};
