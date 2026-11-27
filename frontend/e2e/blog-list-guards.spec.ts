import { expect, test, type Page } from '@playwright/test';
import {
  DEFAULT_FIXTURE_INTERNAL_KEY,
  EMPTY_CATEGORY_SLUG,
  ERROR_TAG,
  POST_SUMMARIES,
} from './fixtures/server';
import {
  GRID_SELECTOR,
  MOBILE,
  DESKTOP,
  PAGE_SIZE,
  WIDTHS,
  blockingViolations,
  gridCards,
  gridSlugs,
  loadMoreButton,
  openBlog,
} from './helpers/blog';
import { THEMES } from './helpers/theme';

// M2-07 ① 필수 검증(거부·회귀): 없는 slug 404, Load More 실패·중복 클릭, 서버 조회 실패, 가로 스크롤, 접근성, /internal 비노출.

const TOTAL_POSTS = POST_SUMMARIES.length;
const FAILURE_TEXT = '글을 더 불러오지 못했습니다. 다시 시도해 주세요.';
const NOT_FOUND_STATUS = 404;
const SERVER_ERROR_STATUS = 500;

const isPostsPage2 = (url: URL) =>
  url.pathname === '/api/posts' && url.searchParams.get('page') === '2';

test.describe('없는 slug는 404', () => {
  for (const path of ['/blog?category=no-such-category', '/blog?tag=no-such-tag']) {
    test(`${path} → 404 페이지`, async ({ request, page }) => {
      // 대조: /blog 자체는 열려야 한다(페이지가 없어서 나오는 404와 구분).
      expect((await request.get('/blog')).status()).toBe(200);
      const response = await request.get(path);
      expect(response.status()).toBe(NOT_FOUND_STATUS);

      const rendered = await page.goto(path);
      expect(rendered?.status()).toBe(NOT_FOUND_STATUS);
      await expect(page.locator(GRID_SELECTOR)).toHaveCount(0);
      await expect(page.getByText('아직 글이 없습니다')).toHaveCount(0);
    });
  }

  test('tag가 없는 slug면 category가 있어도 404다(tag 우선)', async ({ request }) => {
    expect((await request.get('/blog')).status()).toBe(200);
    const response = await request.get('/blog?category=backend&tag=no-such-tag');
    expect(response.status()).toBe(NOT_FOUND_STATUS);
  });

  test('tag가 있으면 없는 category는 무시하므로 404가 아니다(tag 우선)', async ({ request }) => {
    const response = await request.get('/blog?category=no-such-category&tag=nextjs');
    expect(response.status()).toBe(200);
  });

  test('글이 0개인 카테고리는 있는 slug라 404가 아니라 200 빈 상태다', async ({ request }) => {
    const response = await request.get(`/blog?category=${EMPTY_CATEGORY_SLUG}`);
    expect(response.status()).toBe(200);
  });
});

test.describe('Load More 실패·진행 중', () => {
  test('500이면 기존 카드를 두고 role="alert" 오류 문구를 보이며, 재시도하면 성공한다', async ({
    page,
  }) => {
    await openBlog(page, '/blog');
    await page.route(isPostsPage2, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 500, code: 'INTERNAL_ERROR' }),
      }),
    );

    await loadMoreButton(page).click();
    const alert = page.getByRole('alert').filter({ hasText: FAILURE_TEXT });
    await expect(alert).toBeVisible();
    await expect(gridCards(page)).toHaveCount(PAGE_SIZE);
    await expect(loadMoreButton(page)).toBeEnabled();
    await expect(loadMoreButton(page)).not.toHaveAttribute('aria-busy', 'true');
    expect(new URL(page.url()).searchParams.has('page')).toBe(false);

    await page.unroute(isPostsPage2);
    await loadMoreButton(page).click();
    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);
    await expect(page.getByRole('alert').filter({ hasText: FAILURE_TEXT })).toHaveCount(0);
    await expect(page).toHaveURL(/\/blog\?page=2$/);
  });

  test('네트워크가 끊겨도 같은 오류 문구를 보이고 카드는 유지된다', async ({ page }) => {
    await openBlog(page, '/blog');
    await page.route(isPostsPage2, (route) => route.abort('failed'));
    await loadMoreButton(page).click();
    await expect(page.getByRole('alert').filter({ hasText: FAILURE_TEXT })).toBeVisible();
    await expect(gridCards(page)).toHaveCount(PAGE_SIZE);
  });

  test('요청 중 버튼은 disabled·aria-busy이고 여러 번 눌러도 요청은 1번이다', async ({ page }) => {
    await openBlog(page, '/blog');
    let requests = 0;
    await page.route(isPostsPage2, async (route) => {
      requests += 1;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });

    const button = loadMoreButton(page);
    await button.click();
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await button.dispatchEvent('click');
    await button.dispatchEvent('click');

    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);
    expect(requests).toBe(1);
    expect(new Set(await gridSlugs(page)).size).toBe(TOTAL_POSTS);
  });
});

test.describe('서버 조회 실패', () => {
  test('글 목록 조회가 5xx면 빈 목록이 아니라 5xx 응답이거나 /blog 오류 경계(blog-error)가 보인다', async ({
    page,
  }) => {
    // 픽스처 서버는 시험용 태그의 글 조회에만 500을 준다(목록·태그 목록은 정상이라 404가 아니다).
    // loading.tsx 스트리밍으로 상태가 200으로 굳을 수 있어 "5xx 또는 오류 경계"를 통과로 본다(프론트 §4).
    const response = await page.goto(`/blog?tag=${ERROR_TAG.slug}`);
    if ((response?.status() ?? 0) >= SERVER_ERROR_STATUS) return;

    const boundary = page.getByTestId('blog-error');
    await expect(boundary).toBeVisible();
    await expect(boundary).toHaveAttribute('role', 'alert');
    await expect(page.locator(GRID_SELECTOR)).toHaveCount(0);
    await expect(page.getByTestId('blog-empty')).toHaveCount(0);
  });
});

test.describe('가로 스크롤 없음', () => {
  const PATHS = [
    '/blog',
    '/blog?tag=nextjs',
    `/blog?category=${EMPTY_CATEGORY_SLUG}`,
    '/blog?page=2',
  ];
  for (const width of WIDTHS) {
    for (const path of PATHS) {
      test(`${width}px ${path}`, async ({ page }) => {
        await openBlog(page, path, { size: { width, height: 900 } });
        const overflow = await page.evaluate(() => ({
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          body: document.body.scrollWidth - document.documentElement.clientWidth,
        }));
        expect(overflow.page).toBeLessThanOrEqual(0);
        expect(overflow.body).toBeLessThanOrEqual(0);
      });
    }
  }
});

test.describe('접근성 axe (serious·critical 0)', () => {
  const STATES = [
    ['기본', '/blog'],
    ['태그 필터', '/blog?tag=nextjs'],
    ['빈 상태', `/blog?category=${EMPTY_CATEGORY_SLUG}`],
  ] as const;
  for (const theme of THEMES) {
    for (const [label, path] of STATES) {
      for (const size of [DESKTOP, MOBILE]) {
        test(`${label} ${size.width}px ${theme}`, async ({ page }) => {
          await openBlog(page, path, { theme, size });
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          expect(await blockingViolations(page)).toEqual([]);
        });
      }
    }
  }

  test('Load More 오류 알림이 보이는 상태도 위반이 없다', async ({ page }) => {
    await openBlog(page, '/blog', { theme: 'light' });
    await page.route(isPostsPage2, (route) => route.fulfill({ status: 500, body: '{}' }));
    await loadMoreButton(page).click();
    await expect(page.getByRole('alert').filter({ hasText: FAILURE_TEXT })).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);
  });
});

test.describe('/internal 비노출', () => {
  async function collect(page: Page) {
    const urls: string[] = [];
    const internalHeaders: string[] = [];
    const bundles: string[] = [];
    page.on('request', (request) => {
      urls.push(request.url());
      if ('x-internal-key' in request.headers()) internalHeaders.push(request.url());
    });
    page.on('response', async (response) => {
      if (response.request().resourceType() !== 'script') return;
      bundles.push(await response.text().catch(() => ''));
    });
    return { urls, internalHeaders, bundles };
  }

  test('/blog와 Load More 동안 브라우저는 /internal/* 를 부르지 않고 내부 키를 싣지 않는다', async ({
    page,
  }) => {
    const seen = await collect(page);
    await openBlog(page, '/blog');
    await loadMoreButton(page).click();
    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);

    expect(seen.urls.filter((url) => new URL(url).pathname.startsWith('/internal'))).toEqual([]);
    expect(seen.internalHeaders).toEqual([]);
    const apiPaths = seen.urls
      .map((url) => new URL(url).pathname)
      .filter((pathname) => pathname.startsWith('/api/'));
    expect(new Set(apiPaths)).toEqual(new Set(['/api/posts']));
  });

  test('받은 스크립트(번들)에 내부 키와 /internal/ 경로가 없다', async ({ page }) => {
    const seen = await collect(page);
    await openBlog(page, '/blog');
    await loadMoreButton(page).click();
    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);

    expect(seen.bundles.length).toBeGreaterThan(0);
    for (const code of seen.bundles) {
      expect(code).not.toContain(DEFAULT_FIXTURE_INTERNAL_KEY);
      expect(code.toLowerCase()).not.toContain('x-internal-key');
      expect(code).not.toContain('/internal/posts');
    }
  });
});
