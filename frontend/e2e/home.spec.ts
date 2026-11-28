import { expect, test, type Page } from '@playwright/test';
import { FEATURED_SLUG, POST_SUMMARIES } from './fixtures/server';
import { DESKTOP, MOBILE, TOLERANCE, openBlog, overlayCard } from './helpers/blog';
import {
  HOME_GRID_SELECTOR,
  HOME_LATEST_COUNT,
  gridLayoutOf,
  homeGridCards,
  homeSlugs,
} from './helpers/search';

// M2-09 ① 필수 검증(성공): Home 블로그 섹션. 실제 빌드(prod) + 픽스처 서버 기준이다.
// 픽스처: 글 13개(featured 1개 = 최신순 3번째 → 발행 4개 이상이라 Featured 조건 충족).
// Home에서 Featured 글이 Latest 6에도 나오는 것은 의도다(목록은 API 순서 그대로).

const FEATURED = POST_SUMMARIES.find((post) => post.slug === FEATURED_SLUG);
const LATEST = POST_SUMMARIES.slice(0, HOME_LATEST_COUNT);

const latestHeading = (page: Page) => page.getByRole('heading', { level: 2, name: 'Latest Post' });
const viewAll = (page: Page) => page.getByRole('link', { name: 'View All Post' });

type Box = { top: number; bottom: number; left: number; right: number; height: number };

async function measureHome(page: Page) {
  return page.evaluate((gridSelector) => {
    const rect = (el: Element | null | undefined): Box | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    const headings = [...document.querySelectorAll('main h2')];
    const featured = [...document.querySelectorAll('main article')].find((a) =>
      a.querySelector('h2'),
    );
    const latest = headings.find((h) => h.textContent?.trim() === 'Latest Post');
    const button = [...document.querySelectorAll('main a')].find(
      (a) => a.textContent?.trim() === 'View All Post',
    );
    return {
      navbar: rect(document.querySelector('header')),
      featured: rect(featured),
      latest: rect(latest),
      grid: rect(document.querySelector(gridSelector)),
      button: rect(button),
      footer: rect(document.querySelector('footer')),
    };
  }, HOME_GRID_SELECTOR);
}

const gap = (upper: Box | null, lower: Box | null) => (lower?.top ?? NaN) - (upper?.bottom ?? NaN);

test.describe('Home 구성', () => {
  test('Featured → Latest Post 제목 → 최신 6개 그리드 → View All Post 순서다', async ({ page }) => {
    await openBlog(page, '/');
    await expect(overlayCard(page)).toHaveCount(1);
    await expect(latestHeading(page)).toBeVisible();
    await expect(homeGridCards(page)).toHaveCount(HOME_LATEST_COUNT);
    await expect(viewAll(page)).toBeVisible();

    const s = await measureHome(page);
    const tops = [s.featured, s.latest, s.grid, s.button].map((r) => r?.top ?? NaN);
    expect(tops, 'Featured, Latest 제목, 그리드, View All 순서').toEqual(
      [...tops].sort((a, b) => a - b),
    );
  });

  test('화면에 보이지 않는 h1 jblog가 하나뿐이고, 보이는 Profile Hero·Tech Stack 등은 없다', async ({
    page,
  }) => {
    await openBlog(page, '/');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('jblog');
    const box = await h1.boundingBox();
    expect(box?.width ?? NaN, 'sr-only: 1px 이하').toBeLessThanOrEqual(1);
    expect(box?.height ?? NaN).toBeLessThanOrEqual(1);

    await expect(page.getByRole('heading', { name: /Tech Stack|Featured Projects/ })).toHaveCount(
      0,
    );
  });

  test('Featured는 featured 글이고 /blog/{slug}로 간다(h2)', async ({ page }) => {
    await openBlog(page, '/');
    await expect(overlayCard(page).getByRole('heading', { level: 2 })).toHaveText(
      FEATURED?.title ?? '',
    );
    await expect(overlayCard(page).getByRole('link')).toHaveAttribute(
      'href',
      `/blog/${FEATURED_SLUG}`,
    );
  });

  test('Latest Post는 h2, 카드 제목은 h3이고 API 순서 그대로 최신 6개다(Featured 글도 빼지 않는다)', async ({
    page,
  }) => {
    await openBlog(page, '/');
    expect(await homeSlugs(page)).toEqual(LATEST.map((post) => post.slug));
    await expect(homeGridCards(page).getByRole('heading', { level: 3 })).toHaveCount(
      HOME_LATEST_COUNT,
    );
    await expect(page.locator('main').locator(`a[href="/blog/${FEATURED_SLUG}"]`)).toHaveCount(2);
  });

  test('Latest Post 제목 스타일은 h3/Bold 24/28이다', async ({ page }) => {
    await openBlog(page, '/');
    const style = await latestHeading(page).evaluate((el) => {
      const css = getComputedStyle(el);
      return { size: css.fontSize, line: css.lineHeight, weight: css.fontWeight };
    });
    expect(style).toEqual({ size: '24px', line: '28px', weight: '700' });
  });

  test('View All Post는 /blog로 가는 outline 버튼이고 가운데에 있다', async ({ page }) => {
    await openBlog(page, '/');
    const link = viewAll(page);
    await expect(link).toHaveAttribute('href', '/blog');

    const look = await link.evaluate((el) => {
      const css = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        border: parseFloat(css.borderTopWidth),
        background: css.backgroundColor,
        center: (r.left + r.right) / 2,
        viewport: document.documentElement.clientWidth / 2,
      };
    });
    expect(look.border, 'outline은 테두리가 있다').toBeGreaterThanOrEqual(1);
    expect(look.background, 'outline은 채움이 없다').toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(Math.abs(look.center - look.viewport)).toBeLessThanOrEqual(TOLERANCE);

    await link.click();
    await expect(page).toHaveURL(/\/blog$/);
  });

  test('title은 기본값 jblog이고 canonical은 /다', async ({ page, baseURL }) => {
    await openBlog(page, '/');
    expect(await page.title()).toBe('jblog');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${baseURL}/`);
  });
});

for (const size of [DESKTOP, MOBILE]) {
  test.describe(`${size.width}px 세로 간격 (UI §7.1)`, () => {
    test('Navbar→Featured 24, Featured→Latest 제목 80, 제목→그리드 32, 그리드→View All 32, View All→Footer 100', async ({
      page,
    }) => {
      await openBlog(page, '/', { size });
      const s = await measureHome(page);

      const measured = {
        'Navbar→Featured': gap(s.navbar, s.featured),
        'Featured→Latest 제목': gap(s.featured, s.latest),
        '제목→그리드': gap(s.latest, s.grid),
        '그리드→View All': gap(s.grid, s.button),
        'View All→Footer': gap(s.button, s.footer),
      };
      const expected = {
        'Navbar→Featured': 24,
        'Featured→Latest 제목': 80,
        '제목→그리드': 32,
        '그리드→View All': 32,
        'View All→Footer': 100,
      };
      for (const [name, value] of Object.entries(measured)) {
        expect
          .soft(Math.abs(value - expected[name as keyof typeof expected]), `${name}: ${value}px`)
          .toBeLessThanOrEqual(TOLERANCE);
      }
    });
  });
}

test.describe('Latest 그리드 열·gap (UI §4.2)', () => {
  const EXPECTED: Array<[number, number, number, number]> = [
    [1440, 3, 2, 20],
    [1024, 3, 2, 20],
    [768, 2, 3, 20],
    [375, 1, 6, 16],
  ];
  for (const [width, columns, rows, gapPx] of EXPECTED) {
    test(`${width}px: ${columns}열 × ${rows}행, gap ${gapPx}`, async ({ page }) => {
      await openBlog(page, '/', { size: { width, height: 900 } });
      const layout = await gridLayoutOf(page, HOME_GRID_SELECTOR);
      expect(layout.count).toBe(HOME_LATEST_COUNT);
      expect(layout.columns).toBe(columns);
      expect(layout.count / layout.columns).toBe(rows);
      if (columns > 1) expect(Math.abs(layout.columnGap - gapPx)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(layout.rowGap - gapPx)).toBeLessThanOrEqual(TOLERANCE);
    });
  }
});
