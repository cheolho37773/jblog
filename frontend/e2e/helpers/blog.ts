import { expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pinTheme, waitForFonts, type Theme } from './theme';

// M2-07 `/blog` E2E 공용 도구. 구현자가 지킬 DOM 계약은 지시서 인계 노트 "① 테스트 선작성"에 있다.

export const GRID_SELECTOR = 'ul[aria-label="글 목록"]';
export const WIDTHS = [1440, 1024, 768, 375] as const;
export const DESKTOP = { width: 1440, height: 900 };
export const MOBILE = { width: 375, height: 800 };
export const TOLERANCE = 1;
export const PAGE_SIZE = 9;

export const gridCards = (page: Page): Locator => page.locator(`${GRID_SELECTOR} > li`);
export const loadMoreButton = (page: Page): Locator =>
  page.getByRole('button', { name: 'Load More' });
export const categoryNav = (page: Page): Locator =>
  page.getByRole('navigation', { name: '카테고리' });
/** Overlay = main 안에서 h2 제목을 가진 article (그리드 카드는 h3). */
export const overlayCard = (page: Page): Locator =>
  page.locator('main article').filter({ has: page.locator('h2') });

export async function openBlog(
  page: Page,
  path: string,
  view: { theme?: Theme; size?: { width: number; height: number } } = {},
): Promise<void> {
  if (view.theme) await pinTheme(page, view.theme);
  await page.setViewportSize(view.size ?? DESKTOP);
  const response = await page.goto(path);
  expect(response?.status(), `${path} 응답 상태`).toBe(200);
  await waitForFonts(page);
}

export async function gridSlugs(page: Page): Promise<string[]> {
  return gridCards(page)
    .locator('a')
    .evaluateAll((links) => links.map((a) => (a.getAttribute('href') ?? '').replace('/blog/', '')));
}

const BLOCKING_IMPACTS = ['serious', 'critical'];

export async function blockingViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ''))
    .map((v) => ({
      rule: v.id,
      impact: v.impact,
      targets: v.nodes.map((n) => n.target.join(' ')),
    }));
}
