import { expect, test, type Page } from '@playwright/test';
import {
  BULK_SEARCH_QUERY,
  EXCERPT_ONLY_QUERY,
  NO_RESULT_QUERY,
  SEARCH_ERROR_QUERY,
} from './fixtures/server';
import { DESKTOP, MOBILE, WIDTHS, blockingViolations, openBlog } from './helpers/blog';
import {
  SEARCH_GRID_SELECTOR,
  SERVER_ERROR_TEXT,
  expectNoHorizontalScroll,
  noResultText,
  searchPath,
} from './helpers/search';
import { THEMES } from './helpers/theme';

// M2-09 ① 필수 검증(거부·회귀): `/search` 서버 오류, noindex·메타, 가로 스크롤, 접근성.

test.describe('검색 조회 5xx는 결과 없음이 아니라 오류 화면', () => {
  test('검색 API가 500이면 role="alert" 오류 화면이고 "검색 결과가 없습니다"·그리드가 없다', async ({
    page,
  }) => {
    await page.goto(searchPath(SEARCH_ERROR_QUERY));

    const alert = page.getByRole('alert').filter({ hasText: SERVER_ERROR_TEXT });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('button', { name: '다시 시도' })).toBeVisible();
    await expect(page.getByText(/에 대한 검색 결과가 없습니다/)).toHaveCount(0);
    await expect(page.locator(SEARCH_GRID_SELECTOR)).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: '카테고리' })).toHaveCount(0);
  });

  test('대조: 정상인 결과 없음 검색어는 오류 화면이 아니다', async ({ page }) => {
    await openBlog(page, searchPath(NO_RESULT_QUERY));
    await expect(page.getByText(noResultText(NO_RESULT_QUERY))).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: SERVER_ERROR_TEXT })).toHaveCount(0);
  });
});

test.describe('메타: noindex·title·canonical', () => {
  // 태그가 없어도 기다리지 않고 빈 문자열을 돌려준다(없을 때 30초 대기하지 않게).
  const robotsOf = (page: Page) =>
    page.evaluate(
      () => document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '',
    );

  test('결과 화면은 robots noindex, follow이고 canonical이 없다', async ({ page }) => {
    await openBlog(page, searchPath(EXCERPT_ONLY_QUERY));
    const robots = await robotsOf(page);
    expect(robots).toContain('noindex');
    expect(robots).toContain('follow');
    expect(robots).not.toContain('nofollow');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });

  for (const [label, path] of [
    ['결과 없음', searchPath(NO_RESULT_QUERY)],
    ['2자 미만 안내', '/search?q=a'],
    ['q 없음', '/search'],
  ] as const) {
    test(`${label}도 noindex이고 canonical이 없다`, async ({ page }) => {
      await openBlog(page, path);
      expect(await robotsOf(page)).toContain('noindex');
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    });
  }

  test('title은 Search: {q}에 사이트 템플릿이 붙고, 2자 미만이면 Search다', async ({ page }) => {
    await openBlog(page, searchPath(EXCERPT_ONLY_QUERY));
    expect(await page.title()).toBe(`Search: ${EXCERPT_ONLY_QUERY} | jblog`);
    await openBlog(page, '/search?q=a');
    expect(await page.title()).toBe('Search | jblog');
    await openBlog(page, '/search');
    expect(await page.title()).toBe('Search | jblog');
  });

  test('HTML 응답에도 noindex가 들어 있다(JS 없이도)', async ({ request }) => {
    const html = await (await request.get(searchPath(EXCERPT_ONLY_QUERY))).text();
    expect(html).toMatch(/<meta name="robots" content="[^"]*noindex/);
  });
});

test.describe('가로 스크롤 없음', () => {
  const PATHS = [
    searchPath(EXCERPT_ONLY_QUERY),
    searchPath(BULK_SEARCH_QUERY),
    searchPath(NO_RESULT_QUERY),
    '/search?q=a',
    '/',
  ];
  for (const width of WIDTHS) {
    for (const path of PATHS) {
      test(`${width}px ${decodeURIComponent(path)}`, async ({ page }) => {
        await openBlog(page, path, { size: { width, height: 900 } });
        await expectNoHorizontalScroll(page);
      });
    }
  }
});

test.describe('접근성 axe (serious·critical 0)', () => {
  const STATES = [
    ['Home', '/'],
    ['검색 결과', searchPath(EXCERPT_ONLY_QUERY)],
    ['50개 초과', searchPath(BULK_SEARCH_QUERY)],
    ['결과 없음', searchPath(NO_RESULT_QUERY)],
    ['2자 미만 안내', '/search?q=a'],
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
});
