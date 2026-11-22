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

// hex 색 직접 사용 금지 (프론트엔드 §5.1). [설명, 코드]
const COMPONENT_PATH = 'frontend/src/components/ui/sample.tsx';

/** @type {Array<[title: string, code: string]>} */
const HEX_COLOR_VIOLATIONS = [
  ['Tailwind 임의 값', 'export const a = <p className="text-[#4B6BFB]">x</p>;'],
  ['style 객체', "export const style = { color: '#fff' };"],
  ['문자열 변수', "export const background = '#181A2A';"],
  ['8자리 알파', "export const overlay = '#181A2A80';"],
  ['소문자 4자리', "export const tint = '#abcd';"],
  ['템플릿 리터럴', 'export const border = `1px solid #E8E8EA`;'],
  ['JSX 속성 값', 'export const a = <svg fill="#4B6BFB" />;'],
  ['href가 아닌 단독 값', "export const color = '#ABC';"],
  ['숫자만인 색', "export const black = '#000000';"],
  ['border 숫자 hex', "export const style = { border: '1px solid #000' };"],
  ['boxShadow 숫자 hex', "export const style = { boxShadow: '0 2px 4px #000000' };"],
  ['outline', "export const style = { outline: '2px solid #4B6BFB' };"],
  [
    'Tailwind 임의 값 그림자(_ 구분)',
    'export const a = <p className="shadow-[0_2px_4px_#000000]">x</p>;',
  ],
  [
    'Tailwind 임의 값 border(_ 구분)',
    'export const a = <p className="border-[1px_solid_#000]">x</p>;',
  ],
  [
    'Tailwind 임의 값 그라디언트(쉼표·괄호 경계)',
    'export const a = <p className="bg-[linear-gradient(90deg,#fff,#000)]">x</p>;',
  ],
  ['border 키워드 두 개 뒤 숫자 hex', "export const style = { border: 'solid thin #000' };"],
  ['border medium 뒤 숫자 hex', "export const style = { border: 'solid medium #000000' };"],
  ['번호 예외 없음: 문자열 안의 Issue #123', "export const note = 'Issue #123';"],
  ['번호 예외 없음: 4자리 번호', "export const note = 'No. #1234';"],
  ['번호 예외 없음: 한국어 번호', "export const note = '#123번 글';"],
  ['inset 그림자', "export const style = { boxShadow: 'inset #123456' };"],
];

for (const [title, code] of HEX_COLOR_VIOLATIONS) {
  test(`hex 색 거부: ${title}`, async () => {
    const messages = await lintCode(code, COMPONENT_PATH);
    const matched = messages.filter((message) => message.ruleId === 'jblog/no-hex-color');
    assert.ok(matched.length > 0, `발견된 규칙: ${ruleIdsOf(messages).join(', ')}`);
    assert.ok(matched.every((message) => message.severity === ERROR_SEVERITY));
  });
}

/** @type {Array<[title: string, code: string]>} */
const HEX_COLOR_ALLOWED = [
  ['앵커 href', 'export const a = <a href="#main">m</a>;'],
  ['hex 글자뿐인 앵커 href', 'export const a = <a href="#add">m</a>;'],
  ['href 표현식', "export const a = <a href={'#face'}>m</a>;"],
  ['href 객체 키', "export const link = { href: '#bad' };"],
  ['경로 뒤 조각', "export const path = '/blog#section';"],
  ['경로 뒤 hex 글자 조각', "export const path = '/blog#add';"],
  ['템플릿 href', 'export const a = <a href={`#add`}>m</a>;'],
  ['템플릿 href 객체 키', 'export const link = { href: `#bad` };'],
  ['문자열 키 href', "export const link = { 'href': '#add' };"],
  ['문자열 키 href 템플릿', "export const link = { 'href': `#add` };"],
  ['계산 키 href', "export const link = { ['href']: '#add' };"],
  ['밑줄 단어 뒤 붙은 조각', "export const path = 'snake_case#add';"],
  ['한 자리 번호', "export const note = 'Step #1';"],
  ['# 들어간 일반 단어', "export const tag = '#Issue';"],
  ['길이가 맞지 않는 토큰', "export const id = '#12345';"],
  ['주석', '// color: #4B6BFB\n/* #fff */\nexport const a = 1;'],
  ['JSX 본문 텍스트', 'export const a = <p>#fff</p>;'],
  ['정규식', 'export const pattern = /#[0-9a-f]{6}/;'],
];

for (const [title, code] of HEX_COLOR_ALLOWED) {
  test(`hex 색 허용: ${title}`, async () => {
    const messages = await lintCode(code, COMPONENT_PATH);
    assert.deepEqual(
      messages.filter((message) => message.ruleId === 'jblog/no-hex-color'),
      [],
    );
  });
}

const HEX_COLOR_OUT_OF_SCOPE_PATHS = [
  'frontend/src/app/globals.tokens.spec.ts',
  'frontend/src/components/ui/button.test.tsx',
  'frontend/src/generated/api.ts',
  'backend/src/mail/template.ts',
];

for (const outOfScopePath of HEX_COLOR_OUT_OF_SCOPE_PATHS) {
  test(`${outOfScopePath}에서는 hex 색을 허용한다`, async () => {
    const messages = await lintCode("export const color = '#4B6BFB';", outOfScopePath);
    assert.deepEqual(
      messages.filter((message) => message.ruleId === 'jblog/no-hex-color'),
      [],
    );
  });
}
