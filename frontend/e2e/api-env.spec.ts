import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { DEFAULT_FIXTURE_INTERNAL_KEY, FEATURED_SLUG } from './fixtures/server';

// 데이터 실행 환경 검증 (M2-E): 운영 빌드에서 확인용 페이지·내부 경로가 닫혀 있고, 비밀값이 브라우저 번들로 새지 않는다.
// prod 프로젝트(운영 빌드, 픽스처 서버·프록시 구성) 전용이다.

const DEV_API_CHECK_PATH = '/dev/api-check';
const INTERNAL_PATH = '/internal/posts/x';
const INTERNAL_KEY_HEADER = 'X-Internal-Key';

// frontend/에서 실행된다(next.config.ts의 distDir과 같은 값). 두 빌드 모두 본다.
const PROD_DIST_DIR = '.next';
const COMPONENTS_DIST_DIR = '.next-components';
const CLIENT_OUTPUT_DIR = 'static'; // 브라우저로 나가는 청크
const SERVER_OUTPUT_DIR = 'server';
const TEXT_FILE = /\.(js|mjs|html|rsc|json|txt|map|css)$/;

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return (fs.readdirSync(dir, { recursive: true }) as string[])
    .map((relative) => path.join(dir, relative))
    .filter((file) => fs.statSync(file).isFile());
}

const textFilesIn = (distDir: string, sub: string) =>
  filesUnder(path.resolve(distDir, sub)).filter((file) => TEXT_FILE.test(file));

function filesContaining(files: string[], needle: string): string[] {
  const lower = needle.toLowerCase();
  return files.filter((file) => fs.readFileSync(file, 'utf8').toLowerCase().includes(lower));
}

test('운영 빌드에서 /dev/api-check는 404이다', async ({ request, page }) => {
  expect((await request.get(DEV_API_CHECK_PATH)).status()).toBe(404);
  expect((await page.goto(DEV_API_CHECK_PATH))?.status()).toBe(404);
});

test('브라우저 경로 /internal/posts/x는 404이다', async ({ request, page }) => {
  expect((await request.get(INTERNAL_PATH)).status()).toBe(404);
  expect((await page.goto(INTERNAL_PATH))?.status()).toBe(404);
});

test('올바른 내부 키를 붙여도 브라우저 경로의 /internal/*은 404이다(외부에 노출되지 않는다)', async ({
  request,
}) => {
  const response = await request.get(`/internal/posts/${FEATURED_SLUG}`, {
    headers: { [INTERNAL_KEY_HEADER]: DEFAULT_FIXTURE_INTERNAL_KEY },
  });

  expect(response.status()).toBe(404);
  expect(await response.text()).not.toContain('"contentMd"');
});

test('/api/*는 픽스처 서버로 이어진다(운영의 Nginx → Nest 구조를 흉내 낸다)', async ({
  request,
}) => {
  const response = await request.get('/api/categories');

  expect(response.status()).toBe(200);
  expect((await response.json()).length).toBeGreaterThanOrEqual(6);
});

for (const distDir of [PROD_DIST_DIR, COMPONENTS_DIST_DIR]) {
  test.describe(`${distDir} 브라우저 번들(static)`, () => {
    test('검사할 산출물이 있다(빈 폴더라서 통과하는 것을 막는다)', () => {
      expect(textFilesIn(distDir, CLIENT_OUTPUT_DIR).length).toBeGreaterThan(0);
    });

    test('INTERNAL_API_KEY 값(테스트 키)이 들어 있지 않다', () => {
      expect(
        filesContaining(textFilesIn(distDir, CLIENT_OUTPUT_DIR), DEFAULT_FIXTURE_INTERNAL_KEY),
      ).toEqual([]);
    });

    test('X-Internal-Key 헤더 사용 코드가 들어 있지 않다', () => {
      expect(filesContaining(textFilesIn(distDir, CLIENT_OUTPUT_DIR), INTERNAL_KEY_HEADER)).toEqual(
        [],
      );
    });
  });
}

test('components 빌드의 서버 번들에는 X-Internal-Key 헤더 코드가 있다(내부 API 클라이언트가 서버 쪽에만 있다는 대조군)', () => {
  const serverFiles = textFilesIn(COMPONENTS_DIST_DIR, SERVER_OUTPUT_DIR);

  expect(serverFiles.length).toBeGreaterThan(0);
  expect(filesContaining(serverFiles, INTERNAL_KEY_HEADER).length).toBeGreaterThan(0);
});

test('서버 번들에도 테스트 키 값이 박혀 있지 않다(키는 런타임 환경변수로만 읽는다)', () => {
  for (const distDir of [PROD_DIST_DIR, COMPONENTS_DIST_DIR]) {
    expect(
      filesContaining(textFilesIn(distDir, SERVER_OUTPUT_DIR), DEFAULT_FIXTURE_INTERNAL_KEY),
    ).toEqual([]);
  }
});
