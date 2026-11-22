import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { pinTheme, THEMES, waitForFonts, type Theme } from './helpers/theme';

// M1-05 규약 8: 공개 페이지 접근성(axe) 검사. serious·critical 위반은 0이어야 한다.
// 규칙을 끄거나 대상에서 빼지 않는다. 위반이 나오면 구현을 고친다(차이 목록 참고).

const BLOCKING_IMPACTS = ['serious', 'critical'];
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 800 };
const PAGES = ['/', '/search?q=test'];

async function blockingViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((violation) => BLOCKING_IMPACTS.includes(violation.impact ?? ''))
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(' ')),
    }));
}

async function open(page: Page, path: string, view: { theme: Theme; size: typeof MOBILE }) {
  const { theme, size } = view;
  await pinTheme(page, theme);
  await page.setViewportSize(size);
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await waitForFonts(page);
}

for (const theme of THEMES) {
  for (const [label, size] of [
    ['1440', DESKTOP],
    ['375', MOBILE],
  ] as const) {
    for (const path of PAGES) {
      test(`axe: ${path} ${label}px ${theme} — serious·critical 위반 0`, async ({ page }) => {
        await open(page, path, { theme, size });
        expect(await blockingViolations(page)).toEqual([]);
      });
    }
  }

  test(`axe: 모바일 메뉴가 열린 화면 375px ${theme} — serious·critical 위반 0`, async ({
    page,
  }) => {
    await open(page, '/', { theme, size: MOBILE });
    await page.getByRole('banner').getByRole('button', { name: '메뉴 열기' }).click();
    await expect(page.getByRole('dialog', { name: '메뉴' })).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);
  });

  test(`axe: 검색 오버레이가 열린 화면 375px ${theme} — serious·critical 위반 0`, async ({
    page,
  }) => {
    await open(page, '/', { theme, size: MOBILE });
    await page.getByRole('banner').getByRole('button', { name: '검색 열기' }).click();
    await expect(page.getByRole('dialog', { name: '검색' })).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);
  });
}
