import { expect, test } from '@playwright/test';
import {
  BULK_SEARCH_COUNT,
  BULK_SEARCH_QUERY,
  CATEGORIES_RESPONSE,
  EXCERPT_ONLY_QUERY,
  EXCERPT_ONLY_SLUG,
  FEATURED_SLUG,
  NO_RESULT_QUERY,
} from './fixtures/server';
import { DESKTOP, MOBILE, TOLERANCE, categoryNav, openBlog } from './helpers/blog';
import {
  OVERFLOW_NOTICE,
  SEARCH_GRID_SELECTOR,
  SEARCH_LIMIT,
  SHORT_QUERY_GUIDE,
  gridLayoutOf,
  noResultText,
  rejectedSearchCalls,
  resultCountText,
  searchCallsFor,
  searchGridCards,
  searchPath,
  searchSlugs,
} from './helpers/search';

// M2-09 ① 필수 검증(성공): `/search`. 실제 빌드(prod) + 픽스처 서버 기준이다.
// 픽스처: `캐시` → 제목 일치 1(캐시 전략 설계하기) + 발췌문만 일치 1(응답 시간 줄이기 메모). `대량결과` → 55개. `없는검색어` → 0개.

const VISIBLE_CATEGORIES = CATEGORIES_RESPONSE.filter((c) => c.postCount > 0);

test.describe('검색 결과', () => {
  test('/search?q=캐시: 제목 Search: 캐시, Breadcrumb Home / Search, 결과 개수, 그리드', async ({
    page,
  }) => {
    await openBlog(page, searchPath(EXCERPT_ONLY_QUERY));

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      `Search: ${EXCERPT_ONLY_QUERY}`,
    );
    const crumbs = page.getByRole('navigation', { name: '현재 위치' });
    await expect(crumbs.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Search');
    await expect(page.getByText(resultCountText(2), { exact: true })).toBeVisible();
    await expect(searchGridCards(page)).toHaveCount(2);
    await expect(page.getByText(SHORT_QUERY_GUIDE)).toHaveCount(0);
    await expect(page.getByText(noResultText(EXCERPT_ONLY_QUERY))).toHaveCount(0);
    await expect(page.getByText(OVERFLOW_NOTICE)).toHaveCount(0);
  });

  test('제목 일치 글이 앞이고, 발췌문만 일치하는 글도 뒤에 나온다', async ({ page }) => {
    await openBlog(page, searchPath(EXCERPT_ONLY_QUERY));
    expect(await searchSlugs(page)).toEqual([FEATURED_SLUG, EXCERPT_ONLY_SLUG]);
  });

  test('결과 개수는 PageInfo 아래, 그리드 위에 있다', async ({ page }) => {
    await openBlog(page, searchPath(EXCERPT_ONLY_QUERY));
    const tops = await Promise.all([
      page.getByRole('heading', { level: 1 }).boundingBox(),
      page.getByText(resultCountText(2), { exact: true }).boundingBox(),
      page.locator(SEARCH_GRID_SELECTOR).boundingBox(),
    ]);
    const [heading, count, grid] = tops.map((box) => ({
      top: box?.y ?? NaN,
      bottom: (box?.y ?? NaN) + (box?.height ?? NaN),
    }));
    expect(count?.top).toBeGreaterThanOrEqual((heading?.bottom ?? NaN) - 1);
    expect(grid?.top).toBeGreaterThanOrEqual((count?.bottom ?? NaN) - 1);
  });

  test('카드 링크는 /blog/{slug}로 가고 카드 제목은 h3다', async ({ page }) => {
    await openBlog(page, searchPath(EXCERPT_ONLY_QUERY));
    const first = searchGridCards(page).first();
    await expect(first.getByRole('link')).toHaveAttribute('href', `/blog/${FEATURED_SLUG}`);
    await expect(searchGridCards(page).getByRole('heading', { level: 3 })).toHaveCount(2);
  });

  test('앞뒤 공백은 지우고 검색한다(?q=%20캐시%20 → Search: 캐시, 같은 결과)', async ({ page }) => {
    await openBlog(page, '/search?q=%20%20캐시%20');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search: 캐시');
    expect(await searchSlugs(page)).toEqual([FEATURED_SLUG, EXCERPT_ONLY_SLUG]);
  });

  test('q가 여러 번 오면 첫 값만 쓴다(?q=캐시&q=docker)', async ({ page }) => {
    await openBlog(page, '/search?q=캐시&q=docker');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search: 캐시');
    await expect(searchGridCards(page)).toHaveCount(2);
  });

  test('검색어는 글자 그대로 보인다(HTML로 해석하지 않는다)', async ({ page }) => {
    const q = '<b>굵게</b>';
    await openBlog(page, searchPath(q));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Search: ${q}`);
    await expect(page.getByText(noResultText(q))).toBeVisible();
    await expect(page.locator('main b')).toHaveCount(0);
  });

  test('검색 조회는 캐시하지 않는다: 같은 검색어를 두 번 열면 검색 API가 두 번 불린다', async ({
    page,
    request,
  }) => {
    const q = `no-store-probe-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    expect(await searchCallsFor(request, q)).toBe(0);
    await openBlog(page, searchPath(q));
    expect(await searchCallsFor(request, q)).toBe(1);
    await openBlog(page, searchPath(q));
    expect(await searchCallsFor(request, q)).toBe(2);
  });
});

test.describe('Navbar 검색창', () => {
  test('입력 후 Enter를 누르면 /search?q=로 이동해 결과를 보여 준다', async ({ page }) => {
    await openBlog(page, '/');
    const box = page.getByRole('banner').getByRole('searchbox', { name: '검색' });
    await box.fill(EXCERPT_ONLY_QUERY);
    await box.press('Enter');

    await expect(page).toHaveURL(/\/search\?q=/);
    expect(new URL(page.url()).searchParams.get('q')).toBe(EXCERPT_ONLY_QUERY);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      `Search: ${EXCERPT_ONLY_QUERY}`,
    );
    await expect(searchGridCards(page)).toHaveCount(2);
  });
});

test.describe('결과 없음', () => {
  test("문구 '{q}'에 대한 검색 결과가 없습니다. + 카테고리 칩(선택 없음, All 포함)", async ({
    page,
  }) => {
    await openBlog(page, searchPath(NO_RESULT_QUERY));

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Search: ${NO_RESULT_QUERY}`);
    await expect(page.getByText(noResultText(NO_RESULT_QUERY))).toBeVisible();
    await expect(page.locator(SEARCH_GRID_SELECTOR)).toHaveCount(0);
    await expect(page.getByText(OVERFLOW_NOTICE)).toHaveCount(0);
    await expect(page.getByText(SHORT_QUERY_GUIDE)).toHaveCount(0);

    const chips = categoryNav(page).getByRole('link');
    await expect(chips).toHaveText(['All', ...VISIBLE_CATEGORIES.map((c) => c.name)]);
    const hrefs = await chips.evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual(['/blog', ...VISIBLE_CATEGORIES.map((c) => `/blog?category=${c.slug}`)]);
    await expect(categoryNav(page).locator('[aria-current]')).toHaveCount(0);
  });

  test('칩을 누르면 그 카테고리의 /blog로 이동한다', async ({ page }) => {
    await openBlog(page, searchPath(NO_RESULT_QUERY));
    await categoryNav(page).getByRole('link', { name: '프론트엔드' }).click();
    await expect(page).toHaveURL(/\/blog\?category=frontend$/);
  });
});

test.describe('50개 초과', () => {
  test(`${BULK_SEARCH_COUNT}개가 일치하면 ${SEARCH_LIMIT}개만 보여 주고 그리드 아래에 안내 문구가 나온다`, async ({
    page,
  }) => {
    await openBlog(page, searchPath(BULK_SEARCH_QUERY));

    await expect(page.getByText(resultCountText(BULK_SEARCH_COUNT), { exact: true })).toBeVisible();
    await expect(searchGridCards(page)).toHaveCount(SEARCH_LIMIT);
    const notice = page.getByText(OVERFLOW_NOTICE);
    await expect(notice).toBeVisible();

    const grid = await page.locator(SEARCH_GRID_SELECTOR).boundingBox();
    const box = await notice.boundingBox();
    expect(box?.y ?? NaN).toBeGreaterThanOrEqual((grid?.y ?? NaN) + (grid?.height ?? NaN) - 1);
    await expect(page.getByRole('button', { name: 'Load More' })).toHaveCount(0);
  });
});

test.describe('2자 미만 안내', () => {
  // 검색 호출 수는 서버 전체 합계라 같은 파일의 다른 테스트와 겹치지 않게 차례로 실행한다.
  test.describe.configure({ mode: 'serial' });

  const CASES: Array<[string, string]> = [
    ['q 없음', '/search'],
    ['빈 q', '/search?q='],
    ['1자', '/search?q=a'],
    ['한글 1자', `/search?q=${encodeURIComponent('캐')}`],
    ['공백만', '/search?q=%20%20%20'],
    ['앞뒤 공백을 빼면 1자', '/search?q=%20a%20'],
    ['이모지 1자(서로게이트 쌍)', `/search?q=${encodeURIComponent('😀')}`],
    ['변형 선택자가 붙은 1자', `/search?q=${encodeURIComponent('❤️')}`],
  ];

  for (const [label, path] of CASES) {
    test(`${label}: 안내 문구만 보이고 검색 API를 부르지 않는다`, async ({ page, request }) => {
      const before = await rejectedSearchCalls(request);
      await openBlog(page, path);

      await expect(page.getByText(SHORT_QUERY_GUIDE)).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search');
      await expect(page.locator(SEARCH_GRID_SELECTOR)).toHaveCount(0);
      await expect(page.getByText(/검색 결과 \d+개/)).toHaveCount(0);
      await expect(page.getByText(/에 대한 검색 결과가 없습니다/)).toHaveCount(0);
      expect(await rejectedSearchCalls(request)).toBe(before);
    });
  }

  test('이모지 2자는 검색한다: 오류 화면이 아니라 결과 없음 화면이다', async ({ page }) => {
    const q = '😀😀';
    await openBlog(page, searchPath(q));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Search: ${q}`);
    await expect(page.getByText(noResultText(q))).toBeVisible();
    await expect(page.getByText(SHORT_QUERY_GUIDE)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('2자(앞뒤 공백 제외)면 검색한다 — 경계', async ({ page }) => {
    await openBlog(page, '/search?q=%20Do%20');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search: Do');
    await expect(page.getByText(SHORT_QUERY_GUIDE)).toHaveCount(0);
  });
});

test.describe('그리드 열·gap (/blog와 같다, UI §4.2)', () => {
  const EXPECTED: Array<[number, number, number]> = [
    [1440, 3, 20],
    [1024, 3, 20],
    [768, 2, 20],
    [375, 1, 16],
  ];
  for (const [width, columns, gap] of EXPECTED) {
    test(`${width}px: ${columns}열, gap ${gap}`, async ({ page }) => {
      await openBlog(page, searchPath(BULK_SEARCH_QUERY), { size: { width, height: 900 } });
      const layout = await gridLayoutOf(page, SEARCH_GRID_SELECTOR);
      expect(layout.count).toBe(SEARCH_LIMIT);
      expect(layout.columns).toBe(columns);
      if (columns > 1) expect(Math.abs(layout.columnGap - gap)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(layout.rowGap - gap)).toBeLessThanOrEqual(TOLERANCE);
    });
  }

  for (const size of [DESKTOP, MOBILE]) {
    test(`${size.width}px: Navbar → PageInfo 간격 24 (/blog와 같다)`, async ({ page }) => {
      await openBlog(page, searchPath(EXCERPT_ONLY_QUERY), { size });
      const gapPx = await page.evaluate(() => {
        const navbar = document.querySelector('header')?.getBoundingClientRect();
        const info = document.querySelector('main h1')?.parentElement?.getBoundingClientRect();
        return (info?.top ?? NaN) - (navbar?.bottom ?? NaN);
      });
      expect(Math.abs(gapPx - 24)).toBeLessThanOrEqual(TOLERANCE);
    });
  }
});
