import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./generate.mjs', import.meta.url));
const REPO_OPENAPI = fileURLToPath(new URL('../../backend/openapi.json', import.meta.url));
const EXIT_OK = 0;
const EXIT_DIFFERENT = 1;

// 저장소 파일을 건드리지 않도록 임시 폴더에 원본을 복사해 시험한다.
/** @type {string} */
let workDir = '';
/** @type {string} */
let source = '';
/** @type {string} */
let output = '';

before(() => {
  workDir = mkdtempSync(join(tmpdir(), 'api-types-'));
  source = join(workDir, 'openapi.json');
  output = join(workDir, 'api-types.ts');
  copyFileSync(REPO_OPENAPI, source);
});

after(() => rmSync(workDir, { recursive: true, force: true }));

/** @param {string[]} extraArgs */
function run(extraArgs) {
  return spawnSync(
    process.execPath,
    [SCRIPT, '--source', source, '--output', output, ...extraArgs],
    {
      encoding: 'utf8',
    },
  );
}

test('생성: 머리 주석과 /api/health 경로가 든 파일을 만들고 두 번 실행해도 같다', () => {
  assert.equal(run([]).status, EXIT_OK);
  const first = readFileSync(output, 'utf8');
  assert.match(first, /자동 생성 파일입니다\. 직접 수정하지 마세요\./);
  assert.match(first, /명령: pnpm gen:api-types/);
  assert.match(first, /export interface paths \{[\s\S]*"\/api\/health"/);

  assert.equal(run([]).status, EXIT_OK);
  assert.equal(readFileSync(output, 'utf8'), first);
});

test('--check: 일치하면 0이고 파일을 바꾸지 않는다', () => {
  run([]);
  const before = readFileSync(output, 'utf8');
  assert.equal(run(['--check']).status, EXIT_OK);
  assert.equal(readFileSync(output, 'utf8'), before);
});

test('--check: 한 줄이 다르면 1과 차이 요약을 내고 파일을 바꾸지 않는다', () => {
  run([]);
  const tampered = readFileSync(output, 'utf8').replace('"/api/health"', '"/api/healthz"');
  writeFileSync(output, tampered);

  const result = run(['--check']);
  assert.equal(result.status, EXIT_DIFFERENT);
  assert.match(result.stderr, /최신이 아닙니다/);
  assert.match(result.stderr, /healthz/);
  assert.equal(readFileSync(output, 'utf8'), tampered);
});

test('--check: 생성 파일이 없으면 1이고 파일을 만들지 않는다', () => {
  rmSync(output, { force: true });
  assert.equal(run(['--check']).status, EXIT_DIFFERENT);
  assert.throws(() => readFileSync(output), { code: 'ENOENT' });
});
