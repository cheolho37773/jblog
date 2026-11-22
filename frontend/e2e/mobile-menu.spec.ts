import { expect, test, type Page } from '@playwright/test';

// M1-04 모바일 메뉴 규약 1~8 (프론트엔드 §8). 네이티브 <dialog>의 실제 포커스·스크롤 동작을 브라우저로 확인한다.

test.use({ colorScheme: 'light' });

const MOBILE = { width: 375, height: 800 };
const DESKTOP_WIDTH = 1024;
const MENU_DIALOG_NAME = '메뉴';
const SEARCH_DIALOG_NAME = '검색';
const MENU_LINK_COUNT = 5; // Home · Blog · Projects · About · Contact
const TAB_CYCLE_MARGIN = 3; // 메뉴 안 이동 가능한 요소 수보다 더 눌러 한 바퀴 이상 돈다
const CLOSED_STATE_TAB_PRESSES = 40; // 페이지 전체를 훑고도 남는 횟수

const hamburger = (page: Page) =>
  page.getByRole('banner').getByRole('button', { name: '메뉴 열기' });
const menu = (page: Page) => page.getByRole('dialog', { name: MENU_DIALOG_NAME });

async function openMenu(page: Page) {
  await page.setViewportSize(MOBILE);
  await page.goto('/');
  await hamburger(page).click();
  await expect(menu(page)).toBeVisible();
}

/** 지금 포커스된 요소가 메뉴 dialog 안에 있는지 */
const focusInsideMenu = (page: Page) =>
  page.evaluate(() => document.activeElement?.closest('dialog[open]') !== null);

const scrollLocked = (page: Page) =>
  page.evaluate(() => {
    const locked = (element: HTMLElement) =>
      ['hidden', 'clip'].includes(getComputedStyle(element).overflowY);
    return locked(document.documentElement) || locked(document.body);
  });

test.describe('모바일 메뉴 (375px)', () => {
  test('햄버거는 aria-expanded와 aria-controls를 가지고, 열면 true가 되며 메뉴를 가리킨다', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');

    await expect(hamburger(page)).toHaveAttribute('aria-expanded', 'false');
    const controls = await hamburger(page).getAttribute('aria-controls');
    expect(controls).toBeTruthy();

    await hamburger(page).click();

    await expect(hamburger(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`#${controls}`)).toBeVisible();
    await expect(menu(page)).toHaveAttribute('id', controls as string);
  });

  test('열면 메뉴 안(첫 링크 또는 닫기 버튼)으로 포커스가 들어간다', async ({ page }) => {
    await openMenu(page);

    expect(await focusInsideMenu(page)).toBe(true);
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('메뉴에는 링크 5개와 이름이 "메뉴 닫기"인 버튼이 있다', async ({ page }) => {
    await openMenu(page);

    await expect(menu(page).getByRole('link')).toHaveCount(MENU_LINK_COUNT);
    await expect(menu(page).getByRole('button', { name: '메뉴 닫기' })).toBeVisible();
  });

  test('Tab으로 계속 이동해도 포커스가 메뉴 밖으로 나가지 않는다 (트랩)', async ({ page }) => {
    await openMenu(page);
    const focusable = await menu(page).locator('a, button').count();

    for (let pressed = 0; pressed < focusable + TAB_CYCLE_MARGIN; pressed += 1) {
      await page.keyboard.press('Tab');
      expect(await focusInsideMenu(page), `Tab ${pressed + 1}번째`).toBe(true);
    }
  });

  test('Shift+Tab으로 거꾸로 이동해도 포커스가 메뉴 밖으로 나가지 않는다', async ({ page }) => {
    await openMenu(page);
    const focusable = await menu(page).locator('a, button').count();

    for (let pressed = 0; pressed < focusable + TAB_CYCLE_MARGIN; pressed += 1) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusInsideMenu(page), `Shift+Tab ${pressed + 1}번째`).toBe(true);
    }
  });

  test('열린 동안 문서 스크롤이 잠기고, 닫으면 원래대로 돌아온다', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    expect(await scrollLocked(page)).toBe(false);

    await hamburger(page).click();
    await expect(menu(page)).toBeVisible();
    expect(await scrollLocked(page)).toBe(true);

    await page.keyboard.press('Escape');
    await expect(menu(page)).toBeHidden();
    expect(await scrollLocked(page)).toBe(false);
  });

  test('ESC로 닫히고 포커스가 햄버거 버튼으로 돌아온다', async ({ page }) => {
    await openMenu(page);

    await page.keyboard.press('Escape');

    await expect(menu(page)).toBeHidden();
    await expect(hamburger(page)).toBeFocused();
    await expect(hamburger(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('닫기 버튼으로 닫히고 포커스가 햄버거 버튼으로 돌아온다', async ({ page }) => {
    await openMenu(page);

    await menu(page).getByRole('button', { name: '메뉴 닫기' }).click();

    await expect(menu(page)).toBeHidden();
    await expect(hamburger(page)).toBeFocused();
  });

  test('메뉴 링크를 누르면 닫히고 포커스가 햄버거 버튼으로 돌아온다 (Home은 같은 페이지로 이동)', async ({
    page,
  }) => {
    await openMenu(page);

    await menu(page).getByRole('link', { name: 'Home', exact: true }).click();

    await expect(menu(page)).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
    await expect(hamburger(page)).toBeFocused();
    expect(await scrollLocked(page)).toBe(false);
  });

  test('메뉴를 연 채 브라우저 뒤로 가기로 경로가 바뀌면 닫히고 스크롤 잠금이 풀리며 포커스가 햄버거로 돌아온다 (Codex M1-04 r1 #2)', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    // 클라이언트 이동으로 /search에 간다(전체 새로고침이면 메뉴 상태가 초기화되어 검증이 무의미하다).
    await page.getByRole('banner').getByRole('button', { name: '검색 열기' }).click();
    await page.getByRole('dialog', { name: SEARCH_DIALOG_NAME }).getByRole('searchbox').fill('x');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/search?q=x');
    await expect(hamburger(page)).toBeVisible();

    await hamburger(page).click();
    await expect(menu(page)).toBeVisible();
    expect(await scrollLocked(page)).toBe(true);

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);

    await expect(menu(page)).toBeHidden();
    await expect(hamburger(page)).toHaveAttribute('aria-expanded', 'false');
    expect(await scrollLocked(page)).toBe(false);
    await expect(hamburger(page)).toBeFocused();
  });

  test('메뉴의 현재 항목 표시: / 에서 Home이 aria-current="page"이다', async ({ page }) => {
    await openMenu(page);

    await expect(menu(page).getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(menu(page).getByRole('link', { name: 'Blog', exact: true })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('닫힌 상태에서는 Tab으로 메뉴 링크에 도달할 수 없다', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await expect(hamburger(page)).toBeVisible(); // 메뉴가 아예 없어서 통과하는 것을 막는다

    for (let pressed = 0; pressed < CLOSED_STATE_TAB_PRESSES; pressed += 1) {
      await page.keyboard.press('Tab');
      const inMenu = await page.evaluate(() => document.activeElement?.closest('dialog') !== null);
      expect(inMenu, `Tab ${pressed + 1}번째 포커스가 메뉴 안`).toBe(false);
    }
  });

  test(`메뉴를 연 채 ${DESKTOP_WIDTH}px 이상으로 넓히면 메뉴가 보이지 않고 스크롤 잠금이 풀린다`, async ({
    page,
  }) => {
    await openMenu(page);

    await page.setViewportSize({ width: DESKTOP_WIDTH, height: MOBILE.height });

    await expect(menu(page)).toBeHidden();
    expect(await scrollLocked(page)).toBe(false);
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Blog', exact: true }),
    ).toBeVisible();
  });
});

test.describe('모바일 검색 오버레이 (375px)', () => {
  const searchButton = (page: Page) =>
    page.getByRole('banner').getByRole('button', { name: '검색 열기' });
  const overlay = (page: Page) => page.getByRole('dialog', { name: SEARCH_DIALOG_NAME });

  test('검색 아이콘을 누르면 오버레이가 열리고 입력창에 포커스된다', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');

    await searchButton(page).click();

    await expect(overlay(page)).toBeVisible();
    await expect(overlay(page).getByRole('searchbox', { name: '검색' })).toBeFocused();
  });

  test('입력 후 Enter를 누르면 /search?q=<인코딩된 값>으로 이동한다', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await searchButton(page).click();

    await overlay(page).getByRole('searchbox', { name: '검색' }).fill('  react hooks  ');
    await page.keyboard.press('Enter');

    await page.waitForURL('**/search?q=react%20hooks');
  });

  test('빈 값으로 Enter를 눌러도 이동하지 않는다', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await searchButton(page).click();

    await overlay(page).getByRole('searchbox', { name: '검색' }).fill('   ');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('ESC로 닫히고 포커스가 검색 아이콘 버튼으로 돌아온다', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await searchButton(page).click();
    await expect(overlay(page)).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(overlay(page)).toBeHidden();
    await expect(searchButton(page)).toBeFocused();
  });
});

test.describe('데스크톱 검색 (1280px)', () => {
  test('입력창에 쓰고 Enter를 누르면 /search?q=…로 이동한다', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await page.getByRole('banner').getByRole('searchbox', { name: '검색' }).fill('블로그');
    await page.keyboard.press('Enter');

    await page.waitForURL(`**/search?q=${encodeURIComponent('블로그')}`);
  });
});
