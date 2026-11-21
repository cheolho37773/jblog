import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import rootConfig from '../../eslint.config.mjs';

const FIXTURE_DIR = new URL('./fixtures/', import.meta.url);
// 규칙의 files 패턴은 저장소 루트 기준이다. 실제 루트 lint와 같은 설정·경로 형태로 시험한다.
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REGULAR_PATH = 'frontend/src/lib/sample.ts';
const ERROR_SEVERITY = 2;

const eslint = new ESLint({
  cwd: REPO_ROOT,
  overrideConfigFile: true,
  overrideConfig: rootConfig,
});

/**
 * @param {string} code
 * @param {string} virtualPath 가상 경로. 파일이 실제로 있을 필요는 없다
 */
async function lintCode(code, virtualPath) {
  const [result] = await eslint.lintText(code, { filePath: virtualPath });
  return result?.messages ?? [];
}

/**
 * @param {string} fixtureName
 * @param {string} [virtualPath]
 */
async function lintFixture(fixtureName, virtualPath = REGULAR_PATH) {
  return lintCode(readFileSync(new URL(fixtureName, FIXTURE_DIR), 'utf8'), virtualPath);
}

/** @param {import('eslint').Linter.LintMessage[]} messages */
function ruleIdsOf(messages) {
  return messages.map((message) => message.ruleId);
}

/** @param {import('eslint').Linter.LintMessage[]} messages */
function hasError(messages) {
  return messages.some((message) => message.severity === ERROR_SEVERITY);
}

/** @type {Array<[fixtureName: string, ruleId: string]>} */
const VIOLATIONS = [
  ['complexity.ts', 'complexity'],
  ['depth.ts', 'max-depth'],
  ['params.ts', 'max-params'],
  ['explicit-any.ts', '@typescript-eslint/no-explicit-any'],
  ['denied-id.ts', 'id-denylist'],
  ['process-env.ts', 'no-restricted-properties'],
  ['process-env-destructure.ts', 'no-restricted-syntax'],
  ['process-env-import.ts', 'no-restricted-syntax'],
];

for (const [fixtureName, expectedRuleId] of VIOLATIONS) {
  test(`${fixtureName}는 ${expectedRuleId} 오류를 낸다`, async () => {
    const messages = await lintFixture(fixtureName);
    const matched = messages.filter((message) => message.ruleId === expectedRuleId);
    assert.ok(matched.length > 0, `발견된 규칙: ${ruleIdsOf(messages).join(', ')}`);
    assert.ok(
      matched.every((message) => message.severity === ERROR_SEVERITY),
      'error 수준이어야 한다',
    );
  });
}

test('규칙을 지킨 샘플은 오류가 없다', async () => {
  assert.deepEqual(await lintFixture('clean.ts'), []);
});

const PROCESS_ENV_ALLOWED_PATHS = [
  'backend/src/config/env.ts',
  'frontend/src/lib/env.ts',
  'jest.config.mjs',
  'frontend/vitest.config.ts',
  'backend/jest.config.ts',
];

// 이름만 *.config.ts인 일반 소스나 하위 폴더 파일은 예외가 아니다.
const PROCESS_ENV_DENIED_PATHS = [
  'backend/src/posts/post.config.ts',
  'frontend/src/features/posts/post.config.ts',
  'backend/src/config.ts',
  'frontend/src/lib/env/schema.ts',
  'scripts/eslint/internal.config.ts',
];

const PROCESS_ENV_FIXTURES = ['process-env.ts', 'process-env-destructure.ts'];

for (const allowedPath of PROCESS_ENV_ALLOWED_PATHS) {
  test(`${allowedPath}에서는 process.env를 허용한다`, async () => {
    for (const fixtureName of PROCESS_ENV_FIXTURES) {
      assert.deepEqual(await lintFixture(fixtureName, allowedPath), []);
    }
  });
}

for (const deniedPath of PROCESS_ENV_DENIED_PATHS) {
  test(`${deniedPath}에서는 process.env를 허용하지 않는다`, async () => {
    for (const fixtureName of PROCESS_ENV_FIXTURES) {
      assert.ok(hasError(await lintFixture(fixtureName, deniedPath)), fixtureName);
    }
  });
}
