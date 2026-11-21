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
  ['denied-id.ts', 'jblog/denied-names'],
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

// 금지 이름은 선언만 검사한다 (협업 §10-a, 2026-11-21 개발자 승인). [설명, 코드]
/** @type {Array<[title: string, code: string]>} */
const DENIED_NAME_DECLARATIONS = [
  ['변수 선언', 'export const data = 1;'],
  ['구조 분해 변수', 'const { data } = { data: 1 };\nexport const size = data;'],
  ['함수 매개변수', 'export function load(data: number) {\n  return data;\n}'],
  ['구조 분해 매개변수', 'export const load = ({ data }: { data: number }) => data;'],
  [
    '기본값·나머지 매개변수',
    'export const load = (tmp = 1, ...temp: number[]) => tmp + temp.length;',
  ],
  ['함수 이름', 'export function data() {\n  return 1;\n}'],
  ['클래스 이름', 'export const Store = class handle {};'],
  ['catch 매개변수', 'try {\n  load();\n} catch (obj) {\n  report(obj);\n}'],
  [
    '생성자 매개변수 속성',
    'export class Store {\n  constructor(private readonly val: number) {}\n}',
  ],
];

for (const [title, code] of DENIED_NAME_DECLARATIONS) {
  test(`금지 이름 선언 거부: ${title}`, async () => {
    const messages = await lintCode(code, REGULAR_PATH);
    const matched = messages.filter((message) => message.ruleId === 'jblog/denied-names');
    assert.ok(matched.length > 0, `발견된 규칙: ${ruleIdsOf(messages).join(', ')}`);
    assert.ok(matched.every((message) => message.severity === ERROR_SEVERITY));
  });
}

// 외부 API가 정한 이름(객체 키·멤버 접근·메서드·import)은 허용한다. [설명, 코드]
/** @type {Array<[title: string, code: string]>} */
const DENIED_NAME_ALLOWED = [
  [
    'Prisma 인자 객체 키',
    'export const create = () => prisma.post.create({ data: { slug: "a" } });',
  ],
  ['멤버 접근', 'export const body = response.data;'],
  [
    '다른 이름으로 받는 구조 분해',
    'const { data: post } = response;\nexport const title = post.title;',
  ],
  ['클래스 메서드 이름', 'export class Interceptor {\n  handle() {\n    return 1;\n  }\n}'],
  ['import 이름', "import { data } from 'external';\nexport const size = data.length;"],
];

for (const [title, code] of DENIED_NAME_ALLOWED) {
  test(`금지 이름 허용: ${title}`, async () => {
    const messages = await lintCode(code, REGULAR_PATH);
    assert.deepEqual(
      messages.filter((message) => message.ruleId === 'jblog/denied-names'),
      [],
    );
  });
}

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

// import 경계 (개요 D25·D26). [설명, 파일 경로, import 문]
/** @type {Array<[title: string, filePath: string, code: string]>} */
const BOUNDARY_VIOLATIONS = [
  ['frontend → backend (상대 경로)', 'frontend/src/lib/a.ts', "import '../../../backend/src/a';"],
  ['frontend → backend (패키지 이름)', 'frontend/src/lib/a.ts', "import '@jblog/backend';"],
  ['backend → frontend (상대 경로)', 'backend/src/a/a.ts', "import '../../../frontend/src/lib/b';"],
  ['backend → frontend (패키지 이름)', 'backend/src/a/a.ts', "import '@jblog/frontend/x';"],
  ['기능 간 (상대 경로)', 'frontend/src/features/posts/api.ts', "import '../projects/api';"],
  [
    '기능 간 (@/ 별칭)',
    'frontend/src/features/posts/components/a.tsx',
    "import { x } from '@/features/projects/api';",
  ],
  ['components → features', 'frontend/src/components/ui/a.tsx', "import '@/features/posts/api';"],
  ['lib → features (상대 경로)', 'frontend/src/lib/a.ts', "import '../features/posts/api';"],
  ['components → app', 'frontend/src/components/ui/a.tsx', "import '@/app/layout';"],
  ['lib → app', 'frontend/src/lib/a.ts', "import '../app/layout';"],
  ['features → app (@/ 별칭)', 'frontend/src/features/posts/api.ts', "import '@/app/layout';"],
  [
    'features → app (상대 경로)',
    'frontend/src/features/posts/api.ts',
    "import '../../app/layout';",
  ],
  [
    '기능 간 (.. 섞인 @/ 별칭)',
    'frontend/src/features/posts/api.ts',
    "import '@/features/posts/../projects/api';",
  ],
  [
    'lib → features (.. 섞인 @/ 별칭)',
    'frontend/src/lib/a.ts',
    "import '@/components/../features/posts/api';",
  ],
  [
    'frontend → backend (src 밖으로 나가는 @/ 별칭)',
    'frontend/src/lib/a.ts',
    "import '@/../../backend/x';",
  ],
  ['export from 경유', 'frontend/src/lib/a.ts', "export { x } from '@/features/posts/api';"],
  ['동적 import', 'frontend/src/lib/a.ts', "const load = () => import('@/features/posts/api');"],
];

for (const [title, filePath, code] of BOUNDARY_VIOLATIONS) {
  test(`import 경계 위반: ${title}`, async () => {
    const messages = await lintCode(code, filePath);
    const matched = messages.filter((message) => message.ruleId === 'jblog/import-boundaries');
    assert.ok(matched.length > 0, `발견된 규칙: ${ruleIdsOf(messages).join(', ')}`);
    assert.ok(matched.every((message) => message.severity === ERROR_SEVERITY));
  });
}

/** @type {Array<[title: string, filePath: string, code: string]>} */
const BOUNDARY_ALLOWED = [
  ['같은 기능 내부 (상대 경로)', 'frontend/src/features/posts/api.ts', "import './schemas';"],
  [
    '같은 기능 내부 (@/ 별칭)',
    'frontend/src/features/posts/components/a.tsx',
    "import '@/features/posts/api';",
  ],
  ['app → features', 'frontend/src/app/blog/page.tsx', "import '@/features/posts/api';"],
  ['app → components·lib', 'frontend/src/app/blog/page.tsx', "import '@/components/ui/a';"],
  ['features → components', 'frontend/src/features/posts/api.ts', "import '@/components/ui/a';"],
  ['features → lib', 'frontend/src/features/posts/api.ts', "import '../../lib/format';"],
  ['features → generated', 'frontend/src/features/posts/api.ts', "import '@/generated/api-types';"],
  ['components → lib', 'frontend/src/components/ui/a.tsx', "import '@/lib/format';"],
  ['lib → generated', 'frontend/src/lib/api/client.ts', "import '../../generated/api-types';"],
  [
    '같은 기능 내부 (.. 섞인 @/ 별칭)',
    'frontend/src/features/posts/api.ts',
    "import '@/features/projects/../posts/api';",
  ],
  ['외부 패키지', 'frontend/src/lib/a.ts', "import 'zod';"],
  ['backend 내부', 'backend/src/posts/a.ts', "import '../common/b';"],
];

for (const [title, filePath, code] of BOUNDARY_ALLOWED) {
  test(`import 경계 정상: ${title}`, async () => {
    assert.deepEqual(await lintCode(code, filePath), []);
  });
}
