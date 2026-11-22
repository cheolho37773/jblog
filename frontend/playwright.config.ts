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
const VISUAL_TEST_DIR = './e2e/visual';
const DESIGN_REVIEW_TEST_DIR = './e2e/design-review';

// 시각 회귀·디자인 비교는 기본 실행(pnpm test:e2e)에서 돌지 않는다(M1-05 규약 3).
// 환경값이 있을 때만 해당 프로젝트 하나로 좁혀 켠다. 둘 다 /·/dev/components만 쓰므로 components 서버(3101) 하나면 된다.
// - JBLOG_VISUAL=1: 기준 이미지 비교. Linux 컨테이너(scripts/visual/run.sh)에서만 의미가 있다. macOS·GitHub 러너는 폰트 렌더링이 달라 기준이 될 수 없다.
// - JBLOG_DESIGN_REVIEW=1: 원본 참고 이미지(로컬 전용, 비공개)와 비교. 로컬 macOS에서 실행한다.
const VISUAL_MODE = process.env.JBLOG_VISUAL === '1';
const DESIGN_REVIEW_MODE = process.env.JBLOG_DESIGN_REVIEW === '1';

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

// 시각 회귀 허용 오차 초기값. 같은 컨테이너 이미지라 렌더 결과가 거의 같으므로 작게 잡는다.
// - threshold 0.1: 픽셀 색 차이 판정(YIQ, 기본 0.2). 안티앨리어싱 잡음은 넘기되 토큰 색 1개 변경은 잡도록 기본보다 엄격하게.
// - maxDiffPixels 0: 다른 픽셀을 하나도 허용하지 않는다. 비율(maxDiffPixelRatio)은 전체 페이지(수백만 픽셀)에서
//   수천 픽셀을 눈감아 4px 간격 변경을 놓칠 수 있어 쓰지 않는다. 같은 컨테이너·고정 폰트라 결과가 같다는 전제이며,
//   흔들림이 확인되면 test-engineer가 작은 절대값으로 올린다.
// 값은 test-engineer가 반복 실행·시험용 변경으로 검증해 조정한다(M1-05 규약 7).
const VISUAL_EXPECT = {
  // animations: 전환·애니메이션을 끝 상태로 고정해 캡처 시점에 따른 흔들림을 없앤다.
  // caret: 입력창 깜빡이는 캐럿이 찍히지 않게 한다. scale css: 장치 배율과 무관하게 CSS 픽셀 크기로 저장한다.
  animations: 'disabled',
  caret: 'hide',
  scale: 'css',
  threshold: 0.1,
  maxDiffPixels: 0,
} as const;

const visualProjects = [
  {
    name: 'visual',
    testDir: VISUAL_TEST_DIR,
    // 기준 이미지는 Linux 하나뿐이라 파일 이름에 플랫폼·프로젝트 접미사를 붙이지 않는다.
    snapshotPathTemplate: `${VISUAL_TEST_DIR}/__screenshots__/{testFilePath}/{arg}{ext}`,
    expect: { toHaveScreenshot: VISUAL_EXPECT },
    use: { ...devices['Desktop Chrome'], baseURL: originOf(COMPONENTS_SERVER) },
  },
];

const designReviewProjects = [
  {
    name: 'design-review',
    testDir: DESIGN_REVIEW_TEST_DIR,
    use: { ...devices['Desktop Chrome'], baseURL: originOf(COMPONENTS_SERVER) },
  },
];

const defaultProjects = [
  {
    name: 'prod',
    testDir: './e2e',
    testIgnore: ['components/**', 'visual/**', 'design-review/**'],
    use: { ...devices['Desktop Chrome'], baseURL: originOf(PROD_SERVER) },
  },
  {
    name: 'components',
    testDir: COMPONENTS_TEST_DIR,
    use: { ...devices['Desktop Chrome'], baseURL: originOf(COMPONENTS_SERVER) },
  },
];

function selectProjects() {
  if (VISUAL_MODE) return visualProjects;
  if (DESIGN_REVIEW_MODE) return designReviewProjects;
  return defaultProjects;
}

function selectWebServers() {
  if (VISUAL_MODE || DESIGN_REVIEW_MODE) return [webServerOf(COMPONENTS_SERVER)];
  return [
    webServerOf(PROD_SERVER),
    ...(hasComponentsTests() ? [webServerOf(COMPONENTS_SERVER)] : []),
  ];
}

export default defineConfig({
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'on-first-retry' },
  projects: selectProjects(),
  webServer: selectWebServers(),
});
