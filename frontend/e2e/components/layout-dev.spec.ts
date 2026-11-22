import { expect, test, type Locator, type Page } from '@playwright/test';

// M1-04: /dev/components의 레이아웃 섹션(dev-layout-*)에서 Footer·PageInfo 동작을 확인한다.

const PAGE_PATH = '/dev/components';
const LIGHT_CARD_BG = 'rgb(255, 255, 255)'; // --footer-card Light #FFFFFF
const DARK_CARD_BG = 'rgb(36, 37, 53)'; // --footer-card Dark #242535
const MAX_CATEGORIES = 6;

const section = (page: Page, id: string) => page.getByTestId(id);

/** 제목에서 위로 올라가며 처음 만나는 불투명 배경색. Footer 바탕이 아니라 카드 색을 얻기 위해서다. */
function cardBackground(heading: Locator): Promise<string> {
  return heading.evaluate((element) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const color = getComputedStyle(node).backgroundColor;
      if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
    }
    return 'none';
  });
}

test.describe('예시 값을 모두 넘긴 Footer (dev-layout-footer)', () => {
  test('Category 칸이 있고 링크는 /blog?category=<slug> 형식이며 최대 6개이다', async ({
    page,
  }) => {
    await page.goto(PAGE_PATH);
    const footer = section(page, 'dev-layout-footer');

    await expect(footer.getByRole('heading', { name: 'Category' })).toBeVisible();
    const links = footer.locator('a[href^="/blog?category="]');
    expect(await links.count()).toBeGreaterThan(0);
    expect(await links.count()).toBeLessThanOrEqual(MAX_CATEGORIES);
  });

  test('Contact Me 카드에 이메일(mailto)과 "GitHub" 외부 링크가 있다', async ({ page }) => {
    await page.goto(PAGE_PATH);
    const footer = section(page, 'dev-layout-footer');

    await expect(footer.getByRole('heading', { name: 'Contact Me' })).toBeVisible();
    await expect(footer.locator('a[href^="mailto:"]')).toHaveCount(1);
    const github = footer.getByRole('link', { name: 'GitHub' });
    await expect(github).toBeVisible();
    await expect(github).toHaveAttribute('rel', /noopener/);
    await expect(github).toHaveAttribute('rel', /noreferrer/);
  });

  test('이메일 텍스트는 복사 방지 예외(.allow-select)이다', async ({ page }) => {
    await page.goto(PAGE_PATH);
    const email = section(page, 'dev-layout-footer').locator('a[href^="mailto:"]');

    const allowed = await email.evaluate((element) => element.closest('.allow-select') !== null);
    expect(allowed).toBe(true);
  });

  test('Light에서 Contact Me 카드 배경은 footer-card(흰색)이고 Footer 바탕과 다르다', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(PAGE_PATH);
    const footer = section(page, 'dev-layout-footer');

    const card = await cardBackground(footer.getByRole('heading', { name: 'Contact Me' }));
    const footerBackground = await cardBackground(footer.getByRole('contentinfo').first());
    expect(card).toBe(LIGHT_CARD_BG);
    expect(footerBackground).not.toBe(card); // 카드가 Footer 바탕과 구분되어 보여야 한다 (M1-10)
  });

  test('Dark에서 Contact Me 카드 배경은 footer-card(#242535)이다', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(PAGE_PATH);

    const card = await cardBackground(
      section(page, 'dev-layout-footer').getByRole('heading', { name: 'Contact Me' }),
    );
    expect(card).toBe(DARK_CARD_BG);
  });
});

test.describe('값 없는 Footer (dev-layout-footer-empty)', () => {
  test('Category 칸·Contact Me 카드가 없고 Quick Link 6개는 있다', async ({ page }) => {
    await page.goto(PAGE_PATH);
    const footer = section(page, 'dev-layout-footer-empty');

    await expect(footer.getByRole('contentinfo')).toBeVisible();
    await expect(footer.getByRole('heading', { name: 'Category' })).toHaveCount(0);
    await expect(footer.getByRole('heading', { name: 'Contact Me' })).toHaveCount(0);
    for (const name of ['Home', 'Blog', 'Projects', 'About', 'Contact', 'RSS']) {
      await expect(footer.getByRole('link', { name, exact: true }), name).toBeVisible();
    }
  });
});

test.describe('PageInfo (dev-layout-pageinfo)', () => {
  test('제목 "Blog"와 breadcrumb "Home / Blog"가 보인다', async ({ page }) => {
    await page.goto(PAGE_PATH);
    const pageInfo = section(page, 'dev-layout-pageinfo');

    await expect(pageInfo.getByRole('heading', { name: 'Blog' })).toBeVisible();
    const nav = pageInfo.getByRole('navigation', { name: '현재 위치' });
    await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    await expect(nav.getByRole('link', { name: 'Blog' })).toHaveCount(0);
    await expect(nav.getByText('Blog')).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('Navbar 미리보기 (dev-layout-navbar)', () => {
  test('로고와 검색·테마 토글이 보인다', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PAGE_PATH);
    const navbar = section(page, 'dev-layout-navbar');

    await expect(navbar.getByRole('link', { name: 'jblog 홈' })).toBeVisible();
    await expect(navbar.getByRole('searchbox', { name: '검색' })).toBeVisible();
  });
});
