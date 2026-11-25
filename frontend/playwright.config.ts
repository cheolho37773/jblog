import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// 서버 2종 (M1-03 동작 규약 2). 둘 다 운영 이미지(frontend/Dockerfile)와 같은 standalone 서버다.
// - prod: 운영 빌드. 스모크·토큰·"/dev/components는 404" 검증.
// - components: JBLOG_DEV_PAGES=1로 빌드해 개발 전용 페이지(*.dev.tsx)를 포함한 빌드. /dev/components 캡처·동작 검증.
// 두 빌드가 서로의 산출물을 덮지 않도록 distDir을 나눈다(next.config.ts가 JBLOG_DEV_PAGES로 고른다).
// 포트는 개발 서버(3000)·backend(4000)와 겹치지 않는 e2e 전용 값이다.
// proxyPort는 브라우저가 접속하는 주소다(아래 "E2E 프록시" 참고). port는 프록시 뒤의 Next 서버다.
const PROD_SERVER = { port: 3100, proxyPort: 3200, distDir: '.next', devPages: '' };
const COMPONENTS_SERVER = {
  port: 3101,
  proxyPort: 3201,
  distDir: '.next-components',
  devPages: '1',
};

// 픽스처 API 서버(M2-E). 백엔드 대신 고정 응답을 준다. 빌드 검증용 닫힌 포트 4999와 구분되는 값이다.
const FIXTURE_API_PORT = 4100;
// 테스트용 더미 키다. 비밀이 아니다(실제 키는 .env로만 주입한다). 픽스처 서버의 기본 키와 같은 값이어야 한다.
const E2E_INTERNAL_KEY = 'e2e-internal-key-not-secret';

const COMPONENTS_TEST_DIR = './e2e/components';
const VISUAL_TEST_DIR = './e2e/visual';
const DESIGN_REVIEW_TEST_DIR = './e2e/design-review';

// 시각 회귀·디자인 비교는 기본 실행(pnpm test:e2e)에서 돌지 않는다(M1-05 규약 3).
// 환경값이 있을 때만 해당 프로젝트 하나로 좁혀 켠다. 둘 다 /·/dev/components만 쓰므로 components 서버(3101, 프록시 3201) 하나면 된다.
// - JBLOG_VISUAL=1: 기준 이미지 비교. Linux 컨테이너(scripts/visual/run.sh)에서만 의미가 있다. macOS·GitHub 러너는 폰트 렌더링이 달라 기준이 될 수 없다.
// - JBLOG_DESIGN_REVIEW=1: 원본 참고 이미지(로컬 전용, 비공개)와 비교. 로컬 macOS에서 실행한다.
const VISUAL_MODE = process.env.JBLOG_VISUAL === '1';
const DESIGN_REVIEW_MODE = process.env.JBLOG_DESIGN_REVIEW === '1';

type E2eServer = typeof PROD_SERVER;

// 브라우저가 보는 주소 = 프록시 주소. 운영에서 사용자가 Nginx 주소로 접속하는 것과 같다.
const originOf = (server: E2eServer) => `http://localhost:${server.proxyPort}`;

// frontend/.env*는 읽지 않는다. 아래는 명백한 더미 URL이며 비밀값이 아니다.
// API_INTERNAL_URL은 서버 컴포넌트가 API를 부르는 주소로, 픽스처 서버를 가리킨다.
// PORT·HOSTNAME은 standalone server.js가 읽는 값이다.
// JBLOG_DEV_PAGES는 빌드 시점 스위치라 빈 문자열로 덮어, 셸에 남은 값이 prod 빌드에 새지 않게 한다.
const envOf = (server: E2eServer) => ({
  API_INTERNAL_URL: `http://localhost:${FIXTURE_API_PORT}`,
  INTERNAL_API_KEY: E2E_INTERNAL_KEY,
  NEXT_PUBLIC_SITE_URL: originOf(server),
  PORT: String(server.port),
  // IPv4 루프백에 고정한다. 프록시가 같은 주소로 접속한다(localhost는 컨테이너에서 IPv6로 풀려 엇갈릴 수 있다).
  HOSTNAME: '127.0.0.1',
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
  url: `http://localhost:${server.port}`,
  env: envOf(server),
  reuseExistingServer: false,
  timeout: 180_000,
});

// 픽스처 API 서버. 모든 프로젝트(prod·components·visual)가 같은 서버를 쓴다.
// frontend 서버보다 먼저 적어, 서버가 뜰 때 API가 이미 응답할 수 있게 한다.
const fixtureApiServer = {
  command: 'node --no-warnings e2e/fixtures/server.ts',
  url: `http://localhost:${FIXTURE_API_PORT}/__fixture/health`,
  env: { FIXTURE_API_PORT: String(FIXTURE_API_PORT), FIXTURE_INTERNAL_KEY: E2E_INTERNAL_KEY },
  reuseExistingServer: false,
  timeout: 30_000,
};

// E2E 프록시: 운영의 Nginx 구조를 흉내 낸다. /api/*·/uploads/*는 픽스처로, 나머지는 Next로 보낸다.
// standalone 서버에는 개발 전용 rewrite가 없고, 브라우저 요청이 같은 출처로 가야 하기 때문이다.
const proxyOf = (server: E2eServer) => ({
  command: 'node ../scripts/e2e/proxy.mjs',
  url: `http://localhost:${server.proxyPort}/__proxy/health`,
  env: {
    E2E_PROXY_PORT: String(server.proxyPort),
    E2E_PROXY_WEB_PORT: String(server.port),
    E2E_PROXY_API_PORT: String(FIXTURE_API_PORT),
  },
  reuseExistingServer: false,
  timeout: 30_000,
});

// (Playwright는 frontend/에서 실행되므로 상대 경로는 frontend/ 기준이다.)
// components 테스트가 하나도 없으면 서버를 띄우지 않는다(빌드 시간 낭비 방지, 0건이어도 실패하지 않게).
function hasComponentsTests(): boolean {
  const dir = path.resolve(COMPONENTS_TEST_DIR);
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir, { recursive: true }).some((file) => String(file).endsWith('.spec.ts'));
}

// 시각 회귀 허용 오차 초기값. 같은 컨테이너 이미지라 렌더 결과가 거의 같으므로 작게 잡는다.
// - threshold 0: 픽셀 색 차이 판정(YIQ). 같은 컨테이너에서는 3회 반복(24장)해도 흔들림이 없었고(M1-05 ②), 0.1에서는
//   토큰 색을 4단계(#E8E8EA→#E4E4E8)만 바꿔도 통과해 버려 0으로 내렸다. 0에서는 같은 변경이 12장에서 검출된다.
// - maxDiffPixels 15: 로컬 amd64 에뮬레이션(Apple Silicon)과 CI 네이티브 amd64의 안티앨리어싱 차이가 최대 12픽셀
//   관측되어(CI run 45028268322, home 1024 dark, 테마 토글 트랙 가장자리, 채널 차이 1~4) 여유를 둬 15로 잡았다.
//   시험용 변경(색 4단계, 간격 4px)은 이보다 훨씬 많은 픽셀을 바꾸므로 검출된다(M1-05 CI 수정 2). 비율(maxDiffPixelRatio)은 전체 페이지(수백만 픽셀)에서
//   수천 픽셀을 눈감아 4px 간격 변경을 놓칠 수 있어 쓰지 않는다. 같은 컨테이너·고정 폰트라 결과가 같다는 전제이며,
//   흔들림이 확인되면 test-engineer가 작은 절대값으로 올린다.
// 값은 test-engineer가 반복 실행·시험용 변경으로 검증해 조정한다(M1-05 규약 7).
const VISUAL_EXPECT = {
  // animations: 전환·애니메이션을 끝 상태로 고정해 캡처 시점에 따른 흔들림을 없앤다.
  // caret: 입력창 깜빡이는 캐럿이 찍히지 않게 한다. scale css: 장치 배율과 무관하게 CSS 픽셀 크기로 저장한다.
  animations: 'disabled',
  caret: 'hide',
  scale: 'css',
  threshold: 0,
  maxDiffPixels: 15,
} as const;

// 시각 회귀 전용 Chromium 실행 플래그(M2-VR, Issue #62). 같은 이미지·같은 digest인데 CI 러너 CPU가 달라지면
// 글자 가장자리(안티앨리어싱)가 어긋난 것이 원인으로 추정되어, CPU·GPU·시스템 설정에 따른 렌더링 분기를 없앤다.
// visual 프로젝트에만 적용하며 일반 E2E(prod·components)에는 주지 않는다.
// 근거 위치는 이 환경에서 소스를 직접 열어 확인하지 못했다. 아래 설명은 Chromium 스위치 이름과 일반적으로 알려진 동작이다.
// - --disable-skia-runtime-opts: Skia가 실행 중 CPU 기능(SSE4·AVX2 등)을 감지해 고르는 최적화 경로를 끈다. 경로마다
//   부동소수점 반올림이 달라 CPU 모델에 따라 픽셀이 1~2단계 달라질 수 있다. (스위치 정의 파일 위치: 확인 못 함)
// - --font-render-hinting=none: 글꼴 힌팅을 끄고 글리프 윤곽을 그대로 그린다. 시스템 fontconfig·FreeType 힌팅 설정 차이를 없앤다.
//   (Playwright·Puppeteer 이슈에서 헤드리스 스크린샷 안정화 용도로 흔히 쓰인다. 공식 문서 위치: 확인 못 함)
// - --disable-gpu: GPU 래스터화를 끄고 소프트웨어 래스터화로 고정한다. 러너의 GPU·드라이버 유무에 따른 차이를 막는다.
// - --force-color-profile=srgb: 디스플레이 색 프로필 감지를 건너뛰고 sRGB로 고정해 색 변환 차이를 막는다.
const VISUAL_CHROMIUM_ARGS = [
  '--disable-skia-runtime-opts',
  '--font-render-hinting=none',
  '--disable-gpu',
  '--force-color-profile=srgb',
];

const visualProjects = [
  {
    name: 'visual',
    testDir: VISUAL_TEST_DIR,
    // 기준 이미지는 Linux 하나뿐이라 파일 이름에 플랫폼·프로젝트 접미사를 붙이지 않는다.
    snapshotPathTemplate: `${VISUAL_TEST_DIR}/__screenshots__/{testFilePath}/{arg}{ext}`,
    expect: { toHaveScreenshot: VISUAL_EXPECT },
    use: {
      ...devices['Desktop Chrome'],
      baseURL: originOf(COMPONENTS_SERVER),
      launchOptions: { args: VISUAL_CHROMIUM_ARGS },
    },
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
  if (VISUAL_MODE || DESIGN_REVIEW_MODE) {
    return [fixtureApiServer, webServerOf(COMPONENTS_SERVER), proxyOf(COMPONENTS_SERVER)];
  }
  return [
    fixtureApiServer,
    webServerOf(PROD_SERVER),
    proxyOf(PROD_SERVER),
    ...(hasComponentsTests() ? [webServerOf(COMPONENTS_SERVER), proxyOf(COMPONENTS_SERVER)] : []),
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
