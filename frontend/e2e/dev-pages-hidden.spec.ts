import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// 운영(prod) 빌드에서는 개발 전용 페이지가 없어야 한다 (M1-03 동작 규약 1, M1 계획 §7).

const DEV_PAGE_PATH = '/dev/components';
const DEV_MARKER = 'dev-badge';
const MARKDOWN_DEV_MARKER = 'markdown-preview'; // /dev/markdown 본문 래퍼의 data-testid // /dev/components 섹션의 data-testid. 운영 산출물에 있으면 페이지 코드가 새어 든 것이다.
const PROD_DIST_DIR = '.next'; // frontend/에서 실행된다. components 빌드(.next-components)는 보지 않는다.
const BUILD_OUTPUT_DIRS = ['static', 'server'];

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return (fs.readdirSync(dir, { recursive: true }) as string[])
    .map((relative) => path.join(dir, relative))
    .filter((file) => fs.statSync(file).isFile());
}

test('운영 빌드에서 /dev/components는 404이다', async ({ request, page }) => {
  const response = await request.get(DEV_PAGE_PATH);
  expect(response.status()).toBe(404);

  const browserResponse = await page.goto(DEV_PAGE_PATH);
  expect(browserResponse?.status()).toBe(404);
});

// M2-05: 본문 렌더 미리보기도 운영 빌드에 없어야 한다.
test('운영 빌드에서 /dev/markdown은 404이다', async ({ request, page }) => {
  const response = await request.get('/dev/markdown');
  expect(response.status()).toBe(404);

  const browserResponse = await page.goto('/dev/markdown');
  expect(browserResponse?.status()).toBe(404);
});

for (const marker of [DEV_MARKER, MARKDOWN_DEV_MARKER]) {
  test(`운영 빌드 산출물(클라이언트 청크·서버 번들)에 dev 페이지 코드 문자열 ${marker}이 없다`, () => {
    const files = BUILD_OUTPUT_DIRS.flatMap((dir) => filesUnder(path.resolve(PROD_DIST_DIR, dir)));
    // 산출물이 비어 있어 "없음"이 우연히 통과하는 것을 막는다.
    expect(files.length, '검사할 빌드 산출물이 없다').toBeGreaterThan(0);

    const leaked = files
      .filter((file) => /\.(js|html|rsc|json|txt)$/.test(file))
      .filter((file) => fs.readFileSync(file, 'utf8').includes(marker));
    expect(leaked).toEqual([]);
  });
}
