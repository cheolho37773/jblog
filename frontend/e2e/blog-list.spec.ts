import { expect, test, type Page } from '@playwright/test';
import {
  CATEGORIES_RESPONSE,
  EMPTY_CATEGORY_SLUG,
  FEATURED_SLUG,
  INTERNAL_POSTS,
  POST_SUMMARIES,
  SLOW_CATEGORIES,
  SLOW_CATEGORY_DELAY_MS,
} from './fixtures/server';
import {
  DESKTOP,
  GRID_SELECTOR,
  MOBILE,
  PAGE_SIZE,
  TOLERANCE,
  WIDTHS,
  categoryNav,
  gridCards,
  gridSlugs,
  loadMoreButton,
  openBlog,
  overlayCard,
} from './helpers/blog';

// M2-07 ① 필수 검증(성공): `/blog` 목록. 실제 빌드(prod) + 픽스처 서버 기준이다.
// 픽스처: 글 13개(featured 1개 = 최신순 3번째), 카테고리 7개(글 0개 1개 포함), 태그 여러 개. 한 페이지 9개 → Load More 1회로 13개.
// 간격 해석: 칩 간격은 "보이는 칩(링크) 박스" 기준이다(칩 영역의 위아래 8px 여백은 간격에 넣지 않는다). 오차 ±1px.

const TOTAL_POSTS = POST_SUMMARIES.length;
const FIRST_PAGE = POST_SUMMARIES.slice(0, PAGE_SIZE);
const SECOND_PAGE = POST_SUMMARIES.slice(PAGE_SIZE);
const FEATURED_TITLE = POST_SUMMARIES.find((p) => p.slug === FEATURED_SLUG)?.title ?? '';
const VISIBLE_CATEGORIES = CATEGORIES_RESPONSE.filter((c) => c.postCount > 0);
const slugOf = (post: { slug: string }) => post.slug;

type Rect = { top: number; bottom: number; left: number; right: number; height: number };

/** 블록 사이 세로 간격을 한 번에 잰다. 없는 블록은 null. */
async function measureStack(page: Page) {
  return page.evaluate(() => {
    const rect = (el: Element | null | undefined) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    const main = document.querySelector('main');
    const pageInfo = main?.querySelector('h1')?.parentElement;
    const chip = document.querySelector('nav[aria-label="카테고리"] a');
    const overlay = [...document.querySelectorAll('main article')].find((a) =>
      a.querySelector('h2'),
    );
    const grid = document.querySelector('ul[aria-label="글 목록"]');
    const button = [...document.querySelectorAll('button')].find((b) =>
      /Load More/.test(b.textContent ?? ''),
    );
    return {
      navbar: rect(document.querySelector('header')),
      pageInfo: rect(pageInfo),
      chip: rect(chip),
      overlay: rect(overlay),
      grid: rect(grid),
      button: rect(button),
    };
  });
}

const gap = (upper: Rect | null, lower: Rect | null) =>
  (lower?.top ?? NaN) - (upper?.bottom ?? NaN);

test.describe('기본 /blog 구성', () => {
  test('PageInfo(Blog, Home / Blog) → 칩(All 선택) → Overlay(featured) → 그리드 9 → Load More 순서다', async ({
    page,
  }) => {
    await openBlog(page, '/blog');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blog');
    const crumbs = page.getByRole('navigation', { name: '현재 위치' });
    await expect(crumbs.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Blog');

    const chips = categoryNav(page).getByRole('link');
    await expect(chips.first()).toHaveText('All');
    await expect(chips.first()).toHaveAttribute('aria-current', 'page');
    await expect(categoryNav(page).locator('[aria-current="page"]')).toHaveCount(1);

    await expect(overlayCard(page)).toHaveCount(1);
    await expect(overlayCard(page).getByRole('heading', { level: 2 })).toHaveText(FEATURED_TITLE);
    await expect(gridCards(page)).toHaveCount(PAGE_SIZE);
    await expect(loadMoreButton(page)).toBeVisible();

    const stack = await measureStack(page);
    const tops = [stack.pageInfo, stack.chip, stack.overlay, stack.grid, stack.button].map(
      (r) => r?.top ?? NaN,
    );
    expect(tops, '위에서 아래로 PageInfo, 칩, Overlay, 그리드, Load More 순서').toEqual(
      [...tops].sort((a, b) => a - b),
    );
  });

  test('칩은 All + 글이 있는 카테고리뿐이고(글 0개 카테고리는 뺀다) 링크는 /blog?category={slug}다', async ({
    page,
  }) => {
    await openBlog(page, '/blog');
    const chips = categoryNav(page).getByRole('link');

    await expect(chips).toHaveCount(1 + VISIBLE_CATEGORIES.length);
    await expect(chips).toHaveText(['All', ...VISIBLE_CATEGORIES.map((c) => c.name)]);
    const hrefs = await chips.evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual(['/blog', ...VISIBLE_CATEGORIES.map((c) => `/blog?category=${c.slug}`)]);
    await expect(categoryNav(page).getByText('빈 카테고리')).toHaveCount(0);
  });

  test('Overlay 글도 그리드 1페이지에 그대로 나온다(그리드는 API 페이지를 그대로 보여 준다)', async ({
    page,
  }) => {
    await openBlog(page, '/blog');
    expect(await gridSlugs(page)).toEqual(FIRST_PAGE.map(slugOf));
    await expect(page.locator('main').locator(`a[href="/blog/${FEATURED_SLUG}"]`)).toHaveCount(2);
  });

  test('Overlay와 카드 링크는 /blog/{slug}로 간다', async ({ page }) => {
    await openBlog(page, '/blog');
    await expect(overlayCard(page).getByRole('link')).toHaveAttribute(
      'href',
      `/blog/${FEATURED_SLUG}`,
    );
  });
});

for (const size of [DESKTOP, MOBILE]) {
  test.describe(`${size.width}px 세로 간격 (UI §7.2)`, () => {
    test('Navbar→PageInfo 24, PageInfo→칩 24, 칩→Overlay 48, Overlay→그리드 48, 그리드→Load More 32', async ({
      page,
    }) => {
      await openBlog(page, '/blog', { size });
      const s = await measureStack(page);

      const measured = {
        'Navbar→PageInfo': gap(s.navbar, s.pageInfo),
        'PageInfo→칩': gap(s.pageInfo, s.chip),
        '칩→Overlay': gap(s.chip, s.overlay),
        'Overlay→그리드': gap(s.overlay, s.grid),
        '그리드→Load More': gap(s.grid, s.button),
      };
      const expected = {
        'Navbar→PageInfo': 24,
        'PageInfo→칩': 24,
        '칩→Overlay': 48,
        'Overlay→그리드': 48,
        '그리드→Load More': 32,
      };
      for (const [name, value] of Object.entries(measured)) {
        expect
          .soft(Math.abs(value - expected[name as keyof typeof expected]), `${name}: ${value}px`)
          .toBeLessThanOrEqual(TOLERANCE);
      }
    });
  });
}

test.describe('그리드 열·gap (UI §4.2)와 행 높이', () => {
  const EXPECTED: Record<number, { columns: number; gap: number }> = {
    1440: { columns: 3, gap: 20 },
    1024: { columns: 3, gap: 20 },
    768: { columns: 2, gap: 20 },
    375: { columns: 1, gap: 16 },
  };

  for (const width of WIDTHS) {
    test(`${width}px: ${EXPECTED[width]?.columns}열, gap ${EXPECTED[width]?.gap}`, async ({
      page,
    }) => {
      await openBlog(page, '/blog', { size: { width, height: 900 } });
      const layout = await page.evaluate((selector) => {
        const items = [...document.querySelectorAll(`${selector} > li`)].map((li) => {
          const r = li.getBoundingClientRect();
          const link = li.querySelector('a')?.getBoundingClientRect();
          return {
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            right: r.right,
            linkTop: link?.top ?? NaN,
            linkHeight: link?.height ?? NaN,
            linkBottom: link?.bottom ?? NaN,
          };
        });
        return items;
      }, GRID_SELECTOR);

      const columns = layout.filter((item) => Math.abs(item.top - layout[0]!.top) < 1).length;
      const { columns: expectedColumns, gap: expectedGap } = EXPECTED[width]!;
      expect(layout).toHaveLength(PAGE_SIZE);
      expect(columns).toBe(expectedColumns);
      if (columns > 1) {
        expect(Math.abs(layout[1]!.left - layout[0]!.right - expectedGap)).toBeLessThanOrEqual(
          TOLERANCE,
        );
      }
      expect(Math.abs(layout[columns]!.top - layout[0]!.bottom - expectedGap)).toBeLessThanOrEqual(
        TOLERANCE,
      );
    });

    test(`${width}px: 한 행의 카드 높이는 같고 카드가 행을 가득 채운다`, async ({ page }) => {
      await openBlog(page, '/blog', { size: { width, height: 900 } });
      const rows = await page.evaluate((selector) => {
        const byTop = new Map<number, { linkHeight: number; slack: number }[]>();
        for (const li of document.querySelectorAll(`${selector} > li`)) {
          const row = li.getBoundingClientRect();
          const link = li.querySelector('a')?.getBoundingClientRect();
          if (!link) throw new Error('카드 링크가 없다');
          const key = Math.round(row.top);
          const list = byTop.get(key) ?? [];
          list.push({ linkHeight: link.height, slack: row.bottom - link.bottom });
          byTop.set(key, list);
        }
        return [...byTop.values()];
      }, GRID_SELECTOR);

      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        const heights = row.map((item) => item.linkHeight);
        expect(
          Math.max(...heights) - Math.min(...heights),
          `행 높이 ${heights}`,
        ).toBeLessThanOrEqual(0.5);
        for (const item of row) expect(Math.abs(item.slack)).toBeLessThanOrEqual(0.5);
      }
    });
  }
});

test.describe('카테고리 필터', () => {
  test('칩을 누르면 ?category=로 이동하고 그 칩이 aria-current, Overlay 없이 그 카테고리 글만 나온다', async ({
    page,
  }) => {
    await openBlog(page, '/blog');
    await categoryNav(page).getByRole('link', { name: '프론트엔드' }).click();

    await expect(page).toHaveURL(/\/blog\?category=frontend$/);
    const selected = categoryNav(page).locator('[aria-current="page"]');
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveText('프론트엔드');
    await expect(overlayCard(page)).toHaveCount(0);

    const expected = POST_SUMMARIES.filter((p) => p.category?.slug === 'frontend').map(slugOf);
    await expect(gridCards(page)).toHaveCount(expected.length);
    expect(await gridSlugs(page)).toEqual(expected);
    await expect(loadMoreButton(page)).toHaveCount(0);
  });

  test('칩 링크에는 tag·page가 붙지 않는다', async ({ page }) => {
    await openBlog(page, '/blog?category=backend&page=2');
    const hrefs = await categoryNav(page)
      .getByRole('link')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
    for (const href of hrefs) expect(href).not.toMatch(/tag=|page=/);
  });

  test('All 칩으로 돌아가면 /blog로 가고 Overlay가 다시 나온다', async ({ page }) => {
    await openBlog(page, '/blog?category=backend');
    await categoryNav(page).getByRole('link', { name: 'All' }).click();
    await expect(page).toHaveURL(/\/blog$/);
    await expect(overlayCard(page)).toHaveCount(1);
    await expect(gridCards(page)).toHaveCount(PAGE_SIZE);
  });
});

test.describe('태그 필터', () => {
  const NEXTJS_POSTS = INTERNAL_POSTS.filter((p) => p.tags.some((t) => t.slug === 'nextjs'));

  test('?tag=: 제목 #태그명, Breadcrumb 3단, 해제 칩 1개(/blog), Overlay 없음, 그 태그 글만', async ({
    page,
  }) => {
    await openBlog(page, '/blog?tag=nextjs');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('#Next.js');
    const crumbs = page.getByRole('navigation', { name: '현재 위치' });
    await expect(crumbs.getByRole('listitem')).toHaveText(['Home', 'Blog', '#Next.js']);
    await expect(crumbs.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog');
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText('#Next.js');

    await expect(categoryNav(page)).toHaveCount(0);
    const clear = page.getByRole('link', { name: '#Next.js 필터 해제' });
    await expect(clear).toHaveCount(1);
    await expect(clear).toHaveAttribute('href', '/blog');
    await expect(clear.locator('[aria-hidden="true"]').first()).toBeAttached();

    await expect(overlayCard(page)).toHaveCount(0);
    expect(new Set(await gridSlugs(page))).toEqual(new Set(NEXTJS_POSTS.map(slugOf)));
    await expect(loadMoreButton(page)).toHaveCount(0);
  });

  test('category와 tag가 함께 오면 tag만 적용한다(category는 무시)', async ({ page }) => {
    await openBlog(page, '/blog?category=backend&tag=nextjs');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('#Next.js');
    expect(new Set(await gridSlugs(page))).toEqual(new Set(NEXTJS_POSTS.map(slugOf)));
  });

  test('태그 해제 칩을 누르면 /blog로 가고 Overlay가 다시 나온다', async ({ page }) => {
    await openBlog(page, '/blog?tag=nextjs');
    await page.getByRole('link', { name: '#Next.js 필터 해제' }).click();
    await expect(page).toHaveURL(/\/blog$/);
    await expect(overlayCard(page)).toHaveCount(1);
  });

  test('PageInfo→해제 칩 24, 해제 칩→그리드 48이다(Overlay가 없으면 칩 아래 48)', async ({
    page,
  }) => {
    await openBlog(page, '/blog?tag=nextjs');
    const rects = await page.evaluate(() => {
      const top = (el: Element | null | undefined) => el?.getBoundingClientRect().top ?? NaN;
      const bottom = (el: Element | null | undefined) => el?.getBoundingClientRect().bottom ?? NaN;
      const chip = [...document.querySelectorAll('main a')].find(
        (a) =>
          /필터 해제/.test(a.textContent ?? '') ||
          /필터 해제/.test(a.getAttribute('aria-label') ?? ''),
      );
      return {
        pageInfoToChip: top(chip) - bottom(document.querySelector('main h1')?.parentElement),
        chipToGrid: top(document.querySelector('ul[aria-label="글 목록"]')) - bottom(chip),
      };
    });
    expect(Math.abs(rects.pageInfoToChip - 24)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(rects.chipToGrid - 48)).toBeLessThanOrEqual(TOLERANCE);
  });
});

test.describe('Load More', () => {
  test('누르면 13개가 되고 버튼이 사라지며 주소가 ?page=2, 중복 카드가 없다', async ({ page }) => {
    await openBlog(page, '/blog');
    await loadMoreButton(page).click();

    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);
    await expect(loadMoreButton(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/blog\?page=2$/);
    const slugs = await gridSlugs(page);
    expect(new Set(slugs).size).toBe(TOTAL_POSTS);
    expect(slugs).toEqual(POST_SUMMARIES.map(slugOf));
  });

  test('성공 안내 문구가 aria-live 영역에 읽힌다', async ({ page }) => {
    await openBlog(page, '/blog');
    await loadMoreButton(page).click();
    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);
    await expect(page.locator('main [aria-live="polite"]')).toContainText(
      `글 ${SECOND_PAGE.length}개를 더 불러왔습니다.`,
    );
  });

  test('버튼이 사라지면 포커스가 새로 붙은 첫 카드 링크로 간다', async ({ page }) => {
    await openBlog(page, '/blog');
    await loadMoreButton(page).click();
    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);

    const focusedHref = page.locator(':focus');
    await expect(focusedHref).toHaveAttribute('href', `/blog/${SECOND_PAGE[0]!.slug}`);
    await expect(page.locator(`${GRID_SELECTOR} :focus`)).toHaveCount(1);
  });

  test('다른 쿼리(알 수 없는 키)는 ?page=2 갱신 뒤에도 유지된다', async ({ page }) => {
    await openBlog(page, '/blog?foo=bar');
    await loadMoreButton(page).click();
    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);
    const params = new URL(page.url()).searchParams;
    expect(params.get('page')).toBe('2');
    expect(params.get('foo')).toBe('bar');
  });

  test('브라우저는 /api/posts?page=2&size=9 한 번만 부른다(그 밖의 API·/internal 호출 없음)', async ({
    page,
  }) => {
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      const { pathname, search } = new URL(request.url());
      if (pathname.startsWith('/api/') || pathname.startsWith('/internal/')) {
        apiCalls.push(`${pathname}${search}`);
      }
    });
    await openBlog(page, '/blog');
    await loadMoreButton(page).click();
    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);

    expect(apiCalls).toHaveLength(1);
    const url = new URL(apiCalls[0]!, 'http://x');
    expect(url.pathname).toBe('/api/posts');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('size')).toBe(String(PAGE_SIZE));
  });
});

test.describe('?page= 새로고침 (SSR)', () => {
  test('?page=2로 열면 13개가 이어 그려지고 Load More·Overlay가 없다', async ({ page }) => {
    await openBlog(page, '/blog?page=2');
    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);
    expect(await gridSlugs(page)).toEqual(POST_SUMMARIES.map(slugOf));
    await expect(loadMoreButton(page)).toHaveCount(0);
    await expect(overlayCard(page)).toHaveCount(0);
    expect(page.url()).toMatch(/\/blog\?page=2$/);
  });

  test('Load More 후 새로고침해도 같은 13개다', async ({ page }) => {
    await openBlog(page, '/blog');
    await loadMoreButton(page).click();
    await expect(page).toHaveURL(/\/blog\?page=2$/);
    await page.reload();
    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);
    await expect(loadMoreButton(page)).toHaveCount(0);
  });

  for (const raw of ['0', 'abc', '-3', '1.5']) {
    test(`?page=${raw}는 1페이지로 본다(주소는 그대로, Overlay·Load More 있음)`, async ({
      page,
    }) => {
      await openBlog(page, `/blog?page=${raw}`);
      await expect(gridCards(page)).toHaveCount(PAGE_SIZE);
      await expect(overlayCard(page)).toHaveCount(1);
      await expect(loadMoreButton(page)).toBeVisible();
      expect(page.url()).toContain(`page=${raw}`);
    });
  }

  test('?page=99는 마지막 페이지(2)까지 그린다(주소는 그대로)', async ({ page }) => {
    await openBlog(page, '/blog?page=99');
    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);
    await expect(loadMoreButton(page)).toHaveCount(0);
    await expect(overlayCard(page)).toHaveCount(0);
    expect(page.url()).toContain('page=99');
  });

  test('필터와 함께 쓴 큰 page도 그 필터의 마지막 페이지로 줄인다', async ({ page }) => {
    await openBlog(page, '/blog?category=frontend&page=9');
    await expect(gridCards(page)).toHaveCount(
      POST_SUMMARIES.filter((p) => p.category?.slug === 'frontend').length,
    );
  });

  test.describe('자바스크립트를 끄고', () => {
    test.use({ javaScriptEnabled: false });

    test('?page=2는 13개가 서버에서 그려지고 Load More 버튼이 없다', async ({ page }) => {
      await page.goto('/blog?page=2');
      await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);
      await expect(loadMoreButton(page)).toHaveCount(0);
    });

    test('기본 /blog는 9개와 Overlay가 서버에서 그려진다', async ({ page }) => {
      await page.goto('/blog');
      await expect(gridCards(page)).toHaveCount(PAGE_SIZE);
      await expect(overlayCard(page)).toHaveCount(1);
    });
  });
});

test.describe('빈 카테고리', () => {
  test('글 0개 카테고리는 "아직 글이 없습니다"와 Home 링크만 보이고 그리드·Load More·Overlay가 없다', async ({
    page,
  }) => {
    await openBlog(page, `/blog?category=${EMPTY_CATEGORY_SLUG}`);

    const empty = page.getByTestId('blog-empty');
    await expect(empty).toContainText('아직 글이 없습니다');
    await expect(empty.locator('a[href="/"]')).toHaveCount(1);
    await expect(page.locator(GRID_SELECTOR)).toHaveCount(0);
    await expect(loadMoreButton(page)).toHaveCount(0);
    await expect(overlayCard(page)).toHaveCount(0);
  });

  test('빈 카테고리 칩은 어떤 화면에서도 칩 목록에 없다', async ({ page }) => {
    await openBlog(page, `/blog?category=${EMPTY_CATEGORY_SLUG}`);
    await expect(
      categoryNav(page).locator(`a[href="/blog?category=${EMPTY_CATEGORY_SLUG}"]`),
    ).toHaveCount(0);
  });
});

test.describe('칩 전환 중 로딩 표시 (loading.tsx 없음, 프론트 §6.2 v0.5)', () => {
  const FRONTEND_SLUGS = INTERNAL_POSTS.filter((post) => post.category?.slug === 'frontend').map(
    slugOf,
  );

  test('카테고리 칩을 눌러 목록이 바뀌는 동안 그리드 자리에 스켈레톤 9개가 보이고, 끝나면 새 목록이 된다', async ({
    page,
  }, testInfo) => {
    // 서버 fetch 캐시가 같은 주소를 재사용하므로 재시도마다 다른 지연 카테고리를 쓴다.
    const slow = SLOW_CATEGORIES[testInfo.retry % SLOW_CATEGORIES.length]!;
    await openBlog(page, '/blog');
    await expect(gridCards(page)).toHaveCount(PAGE_SIZE);

    await categoryNav(page).getByRole('link', { name: slow.name, exact: true }).click();

    // 전환 중: 스켈레톤이 Overlay·그리드·Load More 자리를 대신하고 PageInfo·칩은 그대로다.
    const skeleton = page.getByTestId('blog-loading-grid');
    await expect(skeleton).toBeVisible({ timeout: SLOW_CATEGORY_DELAY_MS });
    const children = await skeleton.evaluate((el) =>
      [...el.children].map(
        (child) =>
          child.matches('[aria-hidden="true"]') || !!child.querySelector('[aria-hidden="true"]'),
      ),
    );
    expect(children).toHaveLength(PAGE_SIZE);
    expect(children.every(Boolean)).toBe(true);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blog');
    await expect(categoryNav(page)).toBeVisible();
    await expect(page.locator(GRID_SELECTOR)).toHaveCount(0);
    await expect(overlayCard(page)).toHaveCount(0);
    await expect(loadMoreButton(page)).toHaveCount(0);

    // 끝나면 스켈레톤이 사라지고 새 목록이 나온다.
    await expect(gridCards(page)).toHaveCount(FRONTEND_SLUGS.length, {
      timeout: SLOW_CATEGORY_DELAY_MS * 3,
    });
    await expect(skeleton).toHaveCount(0);
    expect(await gridSlugs(page)).toEqual(FRONTEND_SLUGS);
    await expect(page).toHaveURL(new RegExp(`/blog\\?category=${slow.slug}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blog');
    await expect(categoryNav(page)).toBeVisible();
  });

  test('주소로 바로 들어온 /blog 첫 응답 HTML에는 스켈레톤이 없고 글 목록이 들어 있다', async ({
    request,
  }) => {
    const response = await request.get('/blog');
    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).not.toContain('blog-loading-grid');
    expect(html).toContain('aria-label="글 목록"');
    for (const post of FIRST_PAGE) expect(html, post.slug).toContain(`/blog/${post.slug}`);
  });
});

test.describe('Footer Category', () => {
  const EXPECTED = VISIBLE_CATEGORIES.slice(0, 6);
  const PATHS = ['/', '/search?q=test', '/blog', '/blog?category=frontend', '/blog?tag=nextjs'];

  for (const path of PATHS) {
    test(`${path}: /api/categories 순서의 앞 6개(글 0개 제외)이고 링크는 /blog?category={slug}다`, async ({
      page,
    }) => {
      await openBlog(page, path);
      const footer = page.getByRole('contentinfo');
      await expect(footer.getByRole('heading', { name: 'Category' })).toBeVisible();
      const links = footer.locator('a[href^="/blog?category="]');

      await expect(links).toHaveCount(EXPECTED.length);
      await expect(links).toHaveText(EXPECTED.map((c) => c.name));
      const hrefs = await links.evaluateAll((els) => els.map((a) => a.getAttribute('href')));
      expect(hrefs).toEqual(EXPECTED.map((c) => `/blog?category=${c.slug}`));
      await expect(footer.getByText('빈 카테고리')).toHaveCount(0);
    });
  }
});

// Codex r1 대응: 같은 필터에서 서버가 넘긴 page·목록이 바뀌는 이동(주소만 바뀌는 이동)은 화면 상태도 따라가야 한다.
test.describe('같은 필터에서 page만 바뀌는 이동', () => {
  const navbarBlog = (page: Page) =>
    page.getByRole('banner').getByRole('link', { name: 'Blog', exact: true });

  test('/blog?page=2에서 Navbar Blog를 누르면 /blog에서 카드 9개·Overlay·Load More가 복원된다', async ({
    page,
  }) => {
    await openBlog(page, '/blog?page=2');
    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);

    await navbarBlog(page).click();

    await expect(page).toHaveURL(/\/blog$/);
    await expect(gridCards(page)).toHaveCount(PAGE_SIZE);
    expect(await gridSlugs(page)).toEqual(FIRST_PAGE.map(slugOf));
    await expect(loadMoreButton(page)).toBeVisible();
    await expect(overlayCard(page)).toHaveCount(1);
  });

  test('Load More로 13개가 된 뒤 Navbar Blog를 누르면 다시 9개와 Load More다', async ({ page }) => {
    await openBlog(page, '/blog');
    await loadMoreButton(page).click();
    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);

    await navbarBlog(page).click();

    await expect(page).toHaveURL(/\/blog$/);
    await expect(gridCards(page)).toHaveCount(PAGE_SIZE);
    await expect(loadMoreButton(page)).toBeVisible();
  });

  test('같은 카테고리 칩을 다시 눌러도 목록이 그 카테고리의 글로 맞는다', async ({ page }) => {
    const frontend = POST_SUMMARIES.filter((p) => p.category?.slug === 'frontend').map(slugOf);
    await openBlog(page, '/blog?category=frontend&page=2');
    await categoryNav(page).getByRole('link', { name: '프론트엔드', exact: true }).click();

    await expect(page).toHaveURL(/\/blog\?category=frontend$/);
    expect(await gridSlugs(page)).toEqual(frontend);
  });

  test('이동 뒤 브라우저 뒤로가기·앞으로가기도 주소에 맞는 목록이다', async ({ page }) => {
    await openBlog(page, '/blog?page=2');
    await navbarBlog(page).click();
    await expect(gridCards(page)).toHaveCount(PAGE_SIZE);

    await page.goBack();
    await expect(page).toHaveURL(/\/blog\?page=2$/);
    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);
    await expect(loadMoreButton(page)).toHaveCount(0);

    await page.goForward();
    await expect(page).toHaveURL(/\/blog$/);
    await expect(gridCards(page)).toHaveCount(PAGE_SIZE);
    await expect(loadMoreButton(page)).toBeVisible();
  });
});

// Codex r2 대응: 서버 렌더 한 번 = 목록 상태 한 벌. 이동 전에 시작한 Load More 요청은 이동 뒤 목록·주소를 바꾸지 못한다.
// (같은 slug 글의 제목이 바뀐 서버 값이 이동 뒤 반영되는지는 E2E로 재현하지 못한다. 서버 fetch 캐시(revalidate 3600)가 같은 주소의
// 응답을 재사용해 한 서버 실행 안에서 같은 주소의 목록 내용을 바꿀 수 없다. 단위 테스트가 새 키 + 제목 변경으로 확인한다.)
test.describe('지연된 Load More 중 이동', () => {
  const navbarBlog = (page: Page) =>
    page.getByRole('banner').getByRole('link', { name: 'Blog', exact: true });
  const LATE_RESPONSE_MS = 1500;
  const isPostsPage2 = (url: URL) =>
    url.pathname === '/api/posts' && url.searchParams.get('page') === '2';

  test('/blog에서 Load More를 누른 뒤 응답이 오기 전에 Navbar Blog로 이동하면, 늦은 응답이 카드·주소를 바꾸지 않고 새 Load More가 동작한다', async ({
    page,
  }) => {
    await openBlog(page, '/blog');
    let requests = 0;
    await page.route(isPostsPage2, async (route) => {
      requests += 1;
      // 첫 요청만 늦게 보낸다. 이동한 뒤의 새 요청은 바로 진행한다.
      if (requests === 1) await new Promise((resolve) => setTimeout(resolve, LATE_RESPONSE_MS));
      await route.continue().catch(() => {});
    });

    await loadMoreButton(page).click();
    await navbarBlog(page).click();
    await expect(page).toHaveURL(/\/blog$/);
    await expect(gridCards(page)).toHaveCount(PAGE_SIZE);

    // 늦은 응답이 도착할 시간을 충분히 기다린 뒤에도 목록·주소가 이동한 상태 그대로다.
    await page.waitForTimeout(LATE_RESPONSE_MS + 500);
    await expect(gridCards(page)).toHaveCount(PAGE_SIZE);
    await expect(page).toHaveURL(/\/blog$/);

    // 새 Load More는 눌리고(요청 중 상태가 남지 않음) 13개가 된다.
    const button = loadMoreButton(page);
    await expect(button).toBeEnabled();
    await button.click();
    await expect(gridCards(page)).toHaveCount(TOTAL_POSTS);
    await expect(page).toHaveURL(/\/blog\?page=2$/);
  });
});
