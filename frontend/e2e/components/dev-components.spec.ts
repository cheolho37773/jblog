import { expect, test, type Page } from '@playwright/test';

// /dev/components (M1-03): 개발 전용 페이지(JBLOG_DEV_PAGES=1 빌드)에서 Atom의 렌더링·접근성을 확인한다.

const PAGE_PATH = '/dev/components';
const SECTIONS = [
  'dev-badge',
  'dev-button',
  'dev-avatar',
  'dev-input',
  'dev-searchinput',
  'dev-themetoggle',
  'dev-icon',
  'dev-tokens',
];
const THEMES = ['light', 'dark'] as const;
const MOBILE_VIEWPORT = { width: 375, height: 800 };
const MAX_TAB_PRESSES = 150;
const PRIMARY_RGB = 'rgb(75, 107, 251)'; // #4B6BFB (UI §3.3)
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const section = (page: Page, id: string) => page.getByTestId(id);

test('/dev/components가 200으로 열리고 noindex이다', async ({ page }) => {
  const response = await page.goto(PAGE_PATH);

  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

for (const theme of THEMES) {
  test.describe(`${theme} 테마`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(PAGE_PATH);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    });

    for (const id of SECTIONS) {
      test(`${id} 섹션이 보인다`, async ({ page }) => {
        await expect(section(page, id)).toBeVisible();
      });
    }
  });
}

/** Tab을 눌러 조건을 만족하는 요소에 키보드 포커스를 옮긴다. 마우스 포커스가 아니라 :focus-visible을 얻기 위해서다. */
async function tabTo(page: Page, sectionId: string, selector: string) {
  const target = section(page, sectionId).locator(selector).first();
  await expect(target, `${sectionId} 안에 ${selector} 없음`).toBeVisible();

  for (let pressed = 0; pressed < MAX_TAB_PRESSES; pressed += 1) {
    await page.keyboard.press('Tab');
    const focused = await target.evaluate((element) => element === document.activeElement);
    if (focused) return target;
  }
  throw new Error(`Tab ${MAX_TAB_PRESSES}번 안에 ${sectionId}의 ${selector}에 닿지 않았다`);
}

const FOCUS_TARGETS = [
  { name: 'Button', section: 'dev-button', selector: 'button:not([disabled])' },
  { name: 'Input', section: 'dev-input', selector: 'input:not([disabled])' },
  {
    name: 'SearchInput',
    section: 'dev-searchinput',
    selector: '[role="searchbox"], input[type="search"]',
  },
  { name: 'ThemeToggle', section: 'dev-themetoggle', selector: '[role="switch"]' },
];

test.describe('키보드 포커스 링 (UI §9)', () => {
  for (const target of FOCUS_TARGETS) {
    test(`${target.name}에 Tab으로 포커스하면 2px solid primary outline이 보인다`, async ({
      page,
    }) => {
      await page.goto(PAGE_PATH);
      const element = await tabTo(page, target.section, target.selector);

      const outline = await element.evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          width: style.outlineWidth,
          style: style.outlineStyle,
          color: style.outlineColor,
          offset: style.outlineOffset,
        };
      });
      expect(outline).toEqual({ width: '2px', style: 'solid', color: PRIMARY_RGB, offset: '2px' });
    });
  }
});

test('375px 폭에서 가로 스크롤이 생기지 않는다', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  const response = await page.goto(PAGE_PATH);
  // 404 페이지는 스크롤이 없어 우연히 통과하므로 페이지가 실제로 열렸는지 먼저 본다.
  expect(response?.status()).toBe(200);
  await expect(section(page, 'dev-button')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test.describe('그라디언트 텍스트 (M1-02에서 넘긴 확인)', () => {
  for (const name of ['primary', 'orange', 'blue']) {
    test(`text-gradient-${name}는 배경 그라디언트를 글자 모양으로 자르고 글자는 투명하다`, async ({
      page,
    }) => {
      await page.goto(PAGE_PATH);
      const element = section(page, 'dev-tokens').locator(`.text-gradient-${name}`).first();
      await expect(element).toBeVisible();

      const style = await element.evaluate((node) => {
        const computed = getComputedStyle(node);
        return {
          clip: computed.backgroundClip,
          color: computed.color,
          image: computed.backgroundImage,
        };
      });
      expect(style.clip).toBe('text');
      expect(style.color).toBe(TRANSPARENT);
      expect(style.image).toContain('linear-gradient');
    });
  }
});
