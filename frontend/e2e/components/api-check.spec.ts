import { expect, test } from '@playwright/test';
import {
  CATEGORIES_RESPONSE,
  DEFAULT_FIXTURE_INTERNAL_KEY,
  FEATURED_SLUG,
  INTERNAL_POSTS,
} from '../fixtures/server';

// /dev/api-check (M2-E 동작 규약 7): 서버 렌더·브라우저 요청·내부 API가 모두 픽스처 서버 값으로 이어지는지 확인한다.
// components 빌드(JBLOG_DEV_PAGES=1)에서만 존재하는 페이지다.

const PAGE_PATH = '/dev/api-check';
const BROWSER_BUTTON_NAME = '브라우저 요청';
const PUBLIC_CATEGORIES_PATH = '/api/categories';
const INTERNAL_KEY_HEADER = 'x-internal-key';

const featuredTitle = INTERNAL_POSTS.find((post) => post.slug === FEATURED_SLUG)?.title ?? '';

test('/dev/api-check가 200으로 열리고 noindex이다', async ({ page }) => {
  const response = await page.goto(PAGE_PATH);

  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('서버 렌더 목록에 픽스처 카테고리 이름이 모두 있다', async ({ page }) => {
  await page.goto(PAGE_PATH);

  const server = page.getByTestId('api-check-server');
  for (const category of CATEGORIES_RESPONSE) {
    await expect(server).toContainText(category.name);
  }
});

test('서버 렌더 결과는 JS 없이도 HTML에 들어 있다(요청 시 서버가 API를 불러 그린 것이다)', async ({
  request,
}) => {
  const html = await (await request.get(PAGE_PATH)).text();

  for (const category of CATEGORIES_RESPONSE) {
    expect(html).toContain(category.name);
  }
  expect(html).toContain(featuredTitle);
});

test('"브라우저 요청" 버튼은 브라우저에서 /api/categories를 한 번 불러 픽스처 개수를 보여 준다', async ({
  page,
}) => {
  await page.goto(PAGE_PATH);
  const categoryRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === PUBLIC_CATEGORIES_PATH)
      categoryRequests.push(request.url());
  });

  const responsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === PUBLIC_CATEGORIES_PATH,
  );
  await page.getByRole('button', { name: BROWSER_BUTTON_NAME }).click();
  const response = await responsePromise;

  expect(response.status()).toBe(200);
  expect(await response.json()).toHaveLength(CATEGORIES_RESPONSE.length);
  await expect(page.getByTestId('api-check-browser')).toContainText(
    new RegExp(`\\b${CATEGORIES_RESPONSE.length}\\b`),
  );
  expect(categoryRequests).toHaveLength(1);
});

test('내부 API 결과로 featured 글 제목이 서버에서 그려진다', async ({ page }) => {
  await page.goto(PAGE_PATH);

  await expect(page.getByTestId('api-check-internal')).toContainText(featuredTitle);
});

test('브라우저가 보내는 요청에는 X-Internal-Key 헤더도, /internal 경로도 없다', async ({
  page,
}) => {
  const sent: { url: string; headers: Record<string, string> }[] = [];
  page.on('request', (request) => sent.push({ url: request.url(), headers: request.headers() }));

  await page.goto(PAGE_PATH);
  await page.getByRole('button', { name: BROWSER_BUTTON_NAME }).click();
  await expect(page.getByTestId('api-check-browser')).toContainText(
    String(CATEGORIES_RESPONSE.length),
  );

  expect(sent.length).toBeGreaterThan(0);
  expect(sent.filter((r) => INTERNAL_KEY_HEADER in r.headers)).toEqual([]);
  expect(sent.filter((r) => new URL(r.url).pathname.startsWith('/internal'))).toEqual([]);
});

test('페이지 HTML과 브라우저 응답 어디에도 내부 키 값이 노출되지 않는다', async ({
  page,
  request,
}) => {
  const html = await (await request.get(PAGE_PATH)).text();
  expect(html).not.toContain(DEFAULT_FIXTURE_INTERNAL_KEY);

  const bodies: string[] = [];
  page.on('response', async (response) => {
    if (response.url().includes('/_next/static/'))
      bodies.push(await response.text().catch(() => ''));
  });
  await page.goto(PAGE_PATH);
  await page.getByRole('button', { name: BROWSER_BUTTON_NAME }).click();
  await page.waitForLoadState('networkidle');

  expect(bodies.filter((body) => body.includes(DEFAULT_FIXTURE_INTERNAL_KEY))).toEqual([]);
});
