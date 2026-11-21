import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 계약(백엔드 OpenAPI)에서 프론트엔드 타입을 만든다 (개요 D25, 협업 §5.2).
// 사용법: pnpm gen:api-types [--check] [--source <openapi.json>] [--output <api-types.ts>]
// --source·--output은 시험용이다. 생략하면 저장소의 계약 경로를 쓴다.

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DEFAULT_SOURCE = resolve(REPO_ROOT, 'backend/openapi.json');
const DEFAULT_OUTPUT = resolve(REPO_ROOT, 'frontend/src/generated/api-types.ts');
const COMMAND = 'pnpm gen:api-types';
const MAX_DIFF_LINES_SHOWN = 10;
const EXIT_DIFFERENT = 1;
const EXIT_USAGE = 2;

/**
 * openapi-typescript는 frontend의 devDependency라 루트에서 바로 import할 수 없다.
 * frontend 기준으로 찾아 CJS 빌드로 불러온다 (ESM 진입점은 package exports 조건상 require.resolve로 찾을 수 없다).
 */
function loadGenerator() {
  const frontendRequire = createRequire(resolve(REPO_ROOT, 'frontend/package.json'));
  return frontendRequire('openapi-typescript');
}

/** @param {string} filePath */
function toRepoPath(filePath) {
  return relative(REPO_ROOT, filePath).split('\\').join('/');
}

/**
 * @param {string} source openapi.json 경로
 * @returns {Promise<string>} api-types.ts 내용
 */
export async function renderApiTypes(source) {
  const { default: openapiTS, astToString } = loadGenerator();
  const ast = await openapiTS(pathToFileURL(source));
  const header = [
    '/**',
    ' * 자동 생성 파일입니다. 직접 수정하지 마세요.',
    ` * 원본: ${toRepoPath(source)}`,
    ` * 명령: ${COMMAND}`,
    ' * 원본이 바뀌면 명령을 다시 실행해 이 파일을 갱신합니다.',
    ' */',
    '',
    '',
  ].join('\n');
  return header + astToString(ast);
}

/**
 * @param {string} expected 새로 만든 내용
 * @param {string} actual 커밋된 내용
 * @returns {string[]} 사람이 읽을 차이 요약
 */
export function summarizeDifference(expected, actual) {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const total = Math.max(expectedLines.length, actualLines.length);
  const differing = [];
  for (let index = 0; index < total; index += 1) {
    if (expectedLines[index] !== actualLines[index]) {
      differing.push(
        `  ${index + 1}행: 생성 결과 ${JSON.stringify(expectedLines[index] ?? null)} / 커밋된 파일 ${JSON.stringify(actualLines[index] ?? null)}`,
      );
    }
  }
  const shown = differing.slice(0, MAX_DIFF_LINES_SHOWN);
  const hidden = differing.length - shown.length;
  return hidden > 0 ? [...shown, `  ... 외 ${hidden}행`] : shown;
}

/** @param {string[]} argv */
function parseArgs(argv) {
  const options = { check: false, source: DEFAULT_SOURCE, output: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') options.check = true;
    else if (arg === '--source') options.source = resolve(argv[++index] ?? '');
    else if (arg === '--output') options.output = resolve(argv[++index] ?? '');
    else throw new Error(`알 수 없는 인자: ${arg}`);
  }
  return options;
}

/**
 * @param {{ source: string, output: string }} paths
 * @returns {Promise<number>} 종료 코드
 */
async function check({ source, output }) {
  const expected = await renderApiTypes(source);
  if (!existsSync(output)) {
    console.error(`${toRepoPath(output)}이(가) 없습니다. ${COMMAND}로 생성하세요.`);
    return EXIT_DIFFERENT;
  }
  const differences = summarizeDifference(expected, readFileSync(output, 'utf8'));
  if (differences.length === 0) {
    console.log(`${toRepoPath(output)}은(는) ${toRepoPath(source)}와 일치합니다.`);
    return 0;
  }
  console.error(`${toRepoPath(output)}이(가) 최신이 아닙니다. ${COMMAND}로 다시 생성하세요.`);
  console.error(differences.join('\n'));
  return EXIT_DIFFERENT;
}

/** @param {{ source: string, output: string }} paths */
async function generate({ source, output }) {
  const content = await renderApiTypes(source);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, content);
  console.log(`${toRepoPath(source)} -> ${toRepoPath(output)}`);
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return EXIT_USAGE;
  }
  if (options.check) return check(options);
  await generate(options);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
