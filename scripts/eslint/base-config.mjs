import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { jblogPlugin } from './plugin.mjs';

// 가독성 규칙 수치 (협업 §10-a). 바꾸려면 G2(개발자 승인)가 필요하다.
const MAX_COMPLEXITY = 10;
const MAX_NESTING_DEPTH = 3;
const MAX_PARAMS = 3;

// 무엇을 하는지 드러나지 않는 이름 (협업 §10-a "이름"). 선언만 검사한다(jblog/denied-names).
const DENIED_IDENTIFIERS = ['data', 'tmp', 'temp', 'foo', 'bar', 'baz', 'obj', 'val', 'handle'];

// 설정 모듈에서만 process.env를 읽는다 (개요 §6-b). 아래 경로는 그 예외다.
// 경로는 저장소 루트 기준이다. 앱 안에서 lint를 따로 돌리면 기준 경로가 달라지므로 루트에서 실행한다.
export const PROCESS_ENV_ALLOWED_FILES = [
  'backend/src/config/**',
  'frontend/src/lib/env.ts',
  // 도구 설정 파일은 루트·frontend·backend 바로 아래만 허용한다. src/ 같은 하위 폴더는 제외한다.
  '*.config.{js,mjs,cjs,ts}',
  'frontend/*.config.{js,mjs,cjs,ts}',
  'backend/*.config.{js,mjs,cjs,ts}',
];

const PROCESS_ENV_MESSAGE =
  'process.env는 설정 모듈에서만 읽는다 (개요 §6-b). 설정 모듈이 검증한 값을 주입받아 쓴다.';

// `const { env } = process`, `({ env } = process)`, `import { env } from 'node:process'`은
// no-restricted-properties가 잡지 못하므로 구문으로 막는다.
// 한계: `globalThis.process`를 거치거나 `process`를 다른 변수에 담은 뒤 읽는 경우는 잡지 못한다.
const PROCESS_ENV_SYNTAX_RESTRICTIONS = [
  {
    selector: "VariableDeclarator[init.name='process'] > ObjectPattern > Property[key.name='env']",
    message: PROCESS_ENV_MESSAGE,
  },
  {
    selector:
      "AssignmentExpression[right.name='process'] > ObjectPattern > Property[key.name='env']",
    message: PROCESS_ENV_MESSAGE,
  },
  {
    selector:
      "ImportDeclaration[source.value=/^(node:)?process$/] > ImportSpecifier[imported.name='env']",
    message: PROCESS_ENV_MESSAGE,
  },
];

const SOURCE_FILES = ['**/*.{js,mjs,cjs,ts,tsx}'];

/** @type {import('eslint').Linter.RulesRecord} */
const readabilityRules = {
  complexity: ['error', MAX_COMPLEXITY],
  'max-depth': ['error', MAX_NESTING_DEPTH],
  'max-params': ['error', MAX_PARAMS],
  '@typescript-eslint/no-explicit-any': 'error',
  'jblog/denied-names': ['error', ...DENIED_IDENTIFIERS],
  'no-restricted-properties': [
    'error',
    { object: 'process', property: 'env', message: PROCESS_ENV_MESSAGE },
  ],
  'no-restricted-syntax': ['error', ...PROCESS_ENV_SYNTAX_RESTRICTIONS],
};

/**
 * 모든 코드가 따르는 기본 설정(가독성·process.env). import 경계와 앱별(Next·Nest) 설정은 따로 덧붙인다.
 * @type {import('eslint').Linter.Config[]}
 */
export const baseConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: SOURCE_FILES,
    languageOptions: { globals: globals.node },
    plugins: { jblog: jblogPlugin },
    rules: readabilityRules,
  },
  {
    files: PROCESS_ENV_ALLOWED_FILES,
    rules: {
      'no-restricted-properties': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  // 서식 규칙은 Prettier가 맡는다. 다른 규칙 뒤에 두어 충돌을 끈다.
  prettierConfig,
];
