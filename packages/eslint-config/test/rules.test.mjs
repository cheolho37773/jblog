import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { baseConfig } from '../src/index.js';

const FIXTURE_DIR = new URL('./fixtures/', import.meta.url);
// 규칙의 files 패턴은 이 가상 저장소 루트 기준이다. 실제 루트 lint와 같은 경로 형태를 쓴다.
const VIRTUAL_ROOT = fileURLToPath(new URL('../', import.meta.url));
const REGULAR_PATH = 'apps/web/src/sample.ts';

const eslint = new ESLint({
  cwd: VIRTUAL_ROOT,
  overrideConfigFile: true,
  overrideConfig: baseConfig,
});

async function lintFixture(fixtureName, virtualPath = REGULAR_PATH) {
  const code = readFileSync(new URL(fixtureName, FIXTURE_DIR), 'utf8');
  const [result] = await eslint.lintText(code, { filePath: virtualPath });
  return result.messages;
}

function ruleIdsOf(messages) {
  return messages.map((message) => message.ruleId);
}

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
      matched.every((message) => message.severity === 2),
      'error 수준이어야 한다',
    );
  });
}

test('규칙을 지킨 샘플은 오류가 없다', async () => {
  assert.deepEqual(await lintFixture('clean.ts'), []);
});

const PROCESS_ENV_ALLOWED_PATHS = [
  'apps/api/src/config/env.ts',
  'apps/web/lib/env.ts',
  'jest.config.mjs',
  'packages/foo/vitest.config.ts',
  'apps/api/jest.config.ts',
];

// 이름만 *.config.ts인 일반 소스는 예외가 아니다.
const PROCESS_ENV_DENIED_PATHS = [
  'apps/api/src/posts/post.config.ts',
  'packages/eslint-config/src/internal.config.ts',
];

for (const allowedPath of PROCESS_ENV_ALLOWED_PATHS) {
  test(`${allowedPath}에서는 process.env를 허용한다`, async () => {
    for (const fixtureName of ['process-env.ts', 'process-env-destructure.ts']) {
      assert.deepEqual(await lintFixture(fixtureName, allowedPath), []);
    }
  });
}

for (const deniedPath of PROCESS_ENV_DENIED_PATHS) {
  test(`${deniedPath}에서는 process.env를 허용하지 않는다`, async () => {
    for (const fixtureName of ['process-env.ts', 'process-env-destructure.ts']) {
      const messages = await lintFixture(fixtureName, deniedPath);
      assert.ok(
        messages.some((message) => message.severity === 2),
        fixtureName,
      );
    }
  });
}
