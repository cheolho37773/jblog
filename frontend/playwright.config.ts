import { defineConfig, devices } from '@playwright/test';

// 개발 서버(3000)·backend(4000)와 겹치지 않는 e2e 전용 포트.
const E2E_PORT = 3100;
const E2E_ORIGIN = `http://localhost:${E2E_PORT}`;

// frontend/.env*는 읽지 않는다. 아래는 명백한 더미 URL이며 비밀값이 아니다.
// API_INTERNAL_URL은 실제로 응답하는 서버가 없어도 되는 값이다(스모크는 API를 호출하지 않는다).
// PORT·HOSTNAME은 standalone server.js가 읽는 값이다.
const E2E_ENV = {
  API_INTERNAL_URL: 'http://localhost:4999',
  NEXT_PUBLIC_SITE_URL: E2E_ORIGIN,
  PORT: String(E2E_PORT),
  HOSTNAME: 'localhost',
};

// 운영 이미지(frontend/Dockerfile)와 같은 standalone 서버로 검사한다.
// outputFileTracingRoot가 저장소 루트라 server.js는 standalone/frontend/ 아래에 생긴다.
// server.js는 정적 파일(.next/static, public)을 복사하지 않으므로 Dockerfile처럼 직접 넣는다.
const STANDALONE_APP_DIR = '.next/standalone/frontend';
const START_STANDALONE_SERVER = [
  'pnpm build',
  `cp -R .next/static ${STANDALONE_APP_DIR}/.next/`,
  `{ [ ! -d public ] || cp -R public ${STANDALONE_APP_DIR}/; }`,
  `node ${STANDALONE_APP_DIR}/server.js`,
].join(' && ');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: E2E_ORIGIN,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // 운영 형태로 검증하려고 빌드한 standalone 서버를 띄운다. 개발 서버·next start는 쓰지 않는다.
    command: START_STANDALONE_SERVER,
    url: E2E_ORIGIN,
    env: E2E_ENV,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
