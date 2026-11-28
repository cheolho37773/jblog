import { expect, test, type Page } from '@playwright/test';
import { CATEGORIES_RESPONSE } from './fixtures/server';
import { DESKTOP, MOBILE, openBlog } from './helpers/blog';

// M2-09 ① 필수 검증(성공·회귀): prefetch 복원(#43). 운영 빌드에서만 Link prefetch가 동작한다(prod 프로젝트).
// 페이지가 있는 `/blog`(Navbar·Footer Quick Link·Footer Category)는 prefetch하고, 아직 없는 `/projects`·`/about`은 하지 않는다(M4에서 복원).
// 관찰 수단: 브라우저가 보내는 RSC prefetch 요청(`Next-Router-Prefetch` 또는 `Next-Router-Segment-Prefetch` 헤더).

const SETTLE_MS = 800;
const FIRST_CATEGORY_SLUG = CATEGORIES_RESPONSE.find((c) => c.postCount > 0)?.slug ?? '';

/** prefetch 요청의 경로(+category 쿼리만 남김)를 모은다. RSC 캐시용 `_rsc` 같은 내부 쿼리는 뗀다. */
function watchPrefetch(page: Page) {
  const pending: Array<Promise<string | null>> = [];
  const allRequested: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    allRequested.push(url.pathname);
    pending.push(
      request.allHeaders().then((headers) => {
        const isPrefetch =
          headers['next-router-prefetch'] !== undefined ||
          headers['next-router-segment-prefetch'] !== undefined;
        if (!isPrefetch) return null;
        const category = url.searchParams.get('category');
        return category ? `${url.pathname}?category=${category}` : url.pathname;
      }),
    );
  });
  return {
    prefetched: async () => (await Promise.all(pending)).filter((p): p is string => p !== null),
    allRequested: () => allRequested,
  };
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(SETTLE_MS);
}

test.describe('Link prefetch', () => {
  test('데스크톱: Navbar의 /blog 링크가 prefetch되고, /projects·/about은 prefetch도 요청도 없다', async ({
    page,
  }) => {
    const watch = watchPrefetch(page);
    await openBlog(page, '/', { size: DESKTOP });
    await expect.poll(async () => (await watch.prefetched()).includes('/blog')).toBe(true);
    await settle(page);

    const prefetched = await watch.prefetched();
    expect(prefetched).toContain('/blog');
    for (const path of ['/projects', '/about']) {
      expect(prefetched, `${path} prefetch`).not.toContain(path);
      expect(watch.allRequested(), `${path} 요청`).not.toContain(path);
    }
  });

  test('Footer(Quick Link·Category)가 화면에 들어오면 /blog와 /blog?category=가 prefetch된다', async ({
    page,
  }) => {
    const watch = watchPrefetch(page);
    await openBlog(page, '/', { size: DESKTOP });
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
    await page
      .getByRole('contentinfo')
      .locator(`a[href="/blog?category=${FIRST_CATEGORY_SLUG}"]`)
      .scrollIntoViewIfNeeded();

    await expect
      .poll(async () =>
        (await watch.prefetched()).includes(`/blog?category=${FIRST_CATEGORY_SLUG}`),
      )
      .toBe(true);
    await settle(page);
    const prefetched = await watch.prefetched();
    expect(prefetched).toContain('/blog');
    expect(prefetched).not.toContain('/projects');
    expect(prefetched).not.toContain('/about');
    expect(watch.allRequested()).not.toContain('/projects');
    expect(watch.allRequested()).not.toContain('/about');
  });

  test('모바일 메뉴를 열어도 /projects·/about은 prefetch되지 않는다', async ({ page }) => {
    const watch = watchPrefetch(page);
    await openBlog(page, '/', { size: MOBILE });
    await page.getByRole('banner').getByRole('button', { name: '메뉴 열기' }).click();
    await expect(page.getByRole('dialog', { name: '메뉴' })).toBeVisible();
    await settle(page);

    const prefetched = await watch.prefetched();
    expect(prefetched).not.toContain('/projects');
    expect(prefetched).not.toContain('/about');
    expect(watch.allRequested()).not.toContain('/projects');
    expect(watch.allRequested()).not.toContain('/about');
  });

  test('RSS(/feed.xml)는 prefetch하지 않는다', async ({ page }) => {
    const watch = watchPrefetch(page);
    await openBlog(page, '/', { size: DESKTOP });
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
    await settle(page);
    expect(await watch.prefetched()).not.toContain('/feed.xml');
    expect(watch.allRequested()).not.toContain('/feed.xml');
  });
});

test.describe('prefetch 복원 후 콘솔·네트워크 오류 없음', () => {
  for (const [label, path] of [
    ['Home', '/'],
    ['/blog', '/blog'],
    ['/search', '/search?q=%EC%BA%90%EC%8B%9C'],
  ] as const) {
    test(`${label}: 콘솔 오류와 4xx·5xx 응답(prefetch 404 포함)이 없다`, async ({ page }) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('response', (response) => {
        if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
      });

      await openBlog(page, path, { size: DESKTOP });
      await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
      await settle(page);

      expect(problems).toEqual([]);
    });
  }
});
