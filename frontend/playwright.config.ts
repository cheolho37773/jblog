import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// 서버 2종 (M1-03 동작 규약 2). 둘 다 운영 이미지(frontend/Dockerfile)와 같은 standalone 서버다.
// - prod: 운영 빌드. 스모크·토큰·"/dev/components는 404" 검증.
// - components: JBLOG_DEV_PAGES=1로 빌드해 개발 전용 페이지(*.dev.tsx)를 포함한 빌드. /dev/components 캡처·동작 검증.
// 두 빌드가 서로의 산출물을 덮지 않도록 distDir을 나눈다(next.config.ts가 JBLOG_DEV_PAGES로 고른다).
// 포트는 개발 서버(3000)·backend(4000)와 겹치지 않는 e2e 전용 값이다.
const PROD_SERVER = { port: 3100, distDir: '.next', devPages: '' };
const COMPONENTS_SERVER = { port: 3101, distDir: '.next-components', devPages: '1' };

const COMPONENTS_TEST_DIR = './e2e/components';

type E2eServer = typeof PROD_SERVER;

const originOf = (server: E2eServer) => `http://localhost:${server.port}`;

// frontend/.env*는 읽지 않는다. 아래는 명백한 더미 URL이며 비밀값이 아니다.
// API_INTERNAL_URL은 실제로 응답하는 서버가 없어도 되는 값이다(스모크는 API를 호출하지 않는다).
// PORT·HOSTNAME은 standalone server.js가 읽는 값이다.
// JBLOG_DEV_PAGES는 빌드 시점 스위치라 빈 문자열로 덮어, 셸에 남은 값이 prod 빌드에 새지 않게 한다.
const envOf = (server: E2eServer) => ({
  API_INTERNAL_URL: 'http://localhost:4999',
  NEXT_PUBLIC_SITE_URL: originOf(server),
  PORT: String(server.port),
  HOSTNAME: 'localhost',
  JBLOG_DEV_PAGES: server.devPages,
});

// outputFileTracingRoot가 저장소 루트라 server.js는 <distDir>/standalone/frontend/ 아래에 생긴다.
// server.js는 정적 파일(<distDir>/static, public)을 복사하지 않으므로 Dockerfile처럼 직접 넣는다.
function standaloneServerCommand({ distDir }: E2eServer): string {
  const appDir = `${distDir}/standalone/frontend`;
  return [
    'pnpm build',
    `cp -R ${distDir}/static ${appDir}/${distDir}/`,
    `{ [ ! -d public ] || cp -R public ${appDir}/; }`,
    `node ${appDir}/server.js`,
  ].join(' && ');
}

// 운영 형태로 검증하려고 빌드한 standalone 서버를 띄운다. 개발 서버·next start는 쓰지 않는다.
const webServerOf = (server: E2eServer) => ({
  command: standaloneServerCommand(server),
  url: originOf(server),
  env: envOf(server),
  reuseExistingServer: false,
  timeout: 180_000,
});

// (Playwright는 frontend/에서 실행되므로 상대 경로는 frontend/ 기준이다.)
// components 테스트가 하나도 없으면 서버를 띄우지 않는다(빌드 시간 낭비 방지, 0건이어도 실패하지 않게).
function hasComponentsTests(): boolean {
  const dir = path.resolve(COMPONENTS_TEST_DIR);
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir, { recursive: true }).some((file) => String(file).endsWith('.spec.ts'));
}

export default defineConfig({
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'on-first-retry' },
  projects: [
    {
      name: 'prod',
      testDir: './e2e',
      testIgnore: 'components/**',
      use: { ...devices['Desktop Chrome'], baseURL: originOf(PROD_SERVER) },
    },
    {
      name: 'components',
      testDir: COMPONENTS_TEST_DIR,
      use: { ...devices['Desktop Chrome'], baseURL: originOf(COMPONENTS_SERVER) },
    },
  ],
  webServer: [
    webServerOf(PROD_SERVER),
    ...(hasComponentsTests() ? [webServerOf(COMPONENTS_SERVER)] : []),
  ],
});
