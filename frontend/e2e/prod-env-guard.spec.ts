import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// 운영 서버의 필수 키 검증 (M2-E 지시서 동작 규약 4, Codex r1 #1).
// prod 프로젝트가 빌드한 standalone 산출물(.next)을 키 유무만 달리해 별도 프로세스로 띄운다.
// 빌드는 키 없이 통과해야 하므로(build:verify가 증명) 산출물이 존재한다는 사실로 갈음한다.
// 기동 실패(종료 코드 != 0) 또는 첫 요청 실패 중 하나면 통과이고, 키가 있으면 정상이어야 한다.

const SERVER_JS = path.resolve('.next/standalone/frontend/server.js');
const GUARD_PORT_NO_KEY = 3102;
const GUARD_PORT_WITH_KEY = 3103;
const KEY_NAME = 'INTERNAL_API_KEY';
// 더미 값이다. 비밀이 아니다. 출력에 새면 안 되는 값임을 확인하려는 표지(canary)다.
const KEY_VALUE = 'guard-test-key-value-not-secret';
const OTHER_VAR_NAME = 'GUARD_TEST_OTHER_VAR';
const OTHER_VAR_CANARY = 'guard-other-secret-value-not-secret';
const READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 250;

interface Outcome {
  exitCode: number | null;
  status: number | undefined;
  output: string;
}

// 부모 환경(셸의 키 등)이 새어 들어오지 않게 필요한 값만 명시해 만든다.
function baseEnv(port: number): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    API_INTERNAL_URL: 'http://localhost:4100',
    NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    [OTHER_VAR_NAME]: OTHER_VAR_CANARY,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function firstStatus(port: number): Promise<number | undefined> {
  try {
    return (await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' })).status;
  } catch {
    return undefined;
  }
}

async function runServer(env: NodeJS.ProcessEnv, port: number): Promise<Outcome> {
  const child: ChildProcess = spawn(process.execPath, [SERVER_JS], { env, stdio: 'pipe' });
  let output = '';
  let exitCode: number | null = null;
  child.stdout?.on('data', (chunk) => (output += chunk));
  child.stderr?.on('data', (chunk) => (output += chunk));
  child.on('exit', (code) => (exitCode = code ?? 1));

  try {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline && exitCode === null) {
      const status = await firstStatus(port);
      if (status !== undefined) return { exitCode, status, output };
      await sleep(POLL_INTERVAL_MS);
    }
    return { exitCode, status: undefined, output };
  } finally {
    child.kill('SIGKILL');
  }
}

test.describe('운영 standalone 서버의 INTERNAL_API_KEY', () => {
  test.beforeAll(() => {
    expect(fs.existsSync(SERVER_JS), `빌드 산출물이 있어야 한다: ${SERVER_JS}`).toBe(true);
  });

  test('키 없이 띄우면 기동 실패(종료 코드 != 0) 또는 첫 요청 실패이고, 출력에는 변수 이름만 있다', async () => {
    const outcome = await runServer(baseEnv(GUARD_PORT_NO_KEY), GUARD_PORT_NO_KEY);

    const startupFailed = outcome.exitCode !== null && outcome.exitCode !== 0;
    const firstRequestFailed = outcome.status !== undefined && outcome.status >= 500;
    expect(
      startupFailed || firstRequestFailed,
      `키 없이도 정상 응답함: exit=${outcome.exitCode} status=${outcome.status}`,
    ).toBe(true);

    expect(outcome.output).toContain(KEY_NAME);
    expect(outcome.output).not.toContain(KEY_VALUE);
    expect(outcome.output).not.toContain(OTHER_VAR_CANARY);
  });

  test('키가 있으면 정상 기동하고 첫 요청이 성공한다', async () => {
    const env = { ...baseEnv(GUARD_PORT_WITH_KEY), [KEY_NAME]: KEY_VALUE };
    const outcome = await runServer(env, GUARD_PORT_WITH_KEY);

    expect(outcome.status).toBe(200);
    expect(outcome.output).not.toContain(KEY_VALUE);
    expect(outcome.output).not.toContain(OTHER_VAR_CANARY);
  });
});
