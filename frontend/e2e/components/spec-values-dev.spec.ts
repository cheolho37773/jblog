import { expect, test, type Locator, type Page } from '@playwright/test';

// M1-04 Codex r4: UI 기획서 §4.1·§5.7·§5.9 수치 점검 중 예시 값이 필요한 것(Contact Me 카드, Category, PageInfo, 제목 있는 Section).
// 원본 1920px 프레임, 허용 오차 ±0.5px. 제외·의도된 차이는 docs/work/M1/tasks/M1-04.md "UI 수치 목록표" 참고.

test.use({ colorScheme: 'light' });

const PAGE_PATH = '/dev/components';
const FRAME = { width: 1920, height: 1000 };
const TOLERANCE = 0.5;

const section = (page: Page, id: string) => page.getByTestId(id);

function expectNear(actual: number, expected: number, label: string) {
  expect
    .soft(Math.abs(actual - expected), `${label}: 기획 ${expected} / 실제 ${actual}`)
    .toBeLessThanOrEqual(TOLERANCE);
}

const rectOf = (target: Locator) =>
  target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  });

const style = (target: Locator, property: string) =>
  target.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FRAME);
  await page.goto(PAGE_PATH);
});

test.describe('§5.9 Contact Me 카드 (Newsletter 박스 대체, 박스 크기·여백 동일)', () => {
  const card = (page: Page) =>
    section(page, 'dev-layout-footer')
      .locator('div.bg-footer-card, [class*="bg-footer-card"]')
      .first();

  test('padding 32, radius 12, 폭 392px이다', async ({ page }) => {
    const target = card(page);
    await expect(target).toBeVisible();

    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(await style(target, `padding-${side}`), `padding-${side}`).toBe('32px');
    }
    expect(await style(target, 'border-top-left-radius')).toBe('12px');
    expectNear((await rectOf(target)).width, 392, '카드 폭');
  });

  test('제목 ↔ 연락처 묶음 gap 30px, 제목은 h4 20/24 600이다', async ({ page }) => {
    const title = section(page, 'dev-layout-footer').getByRole('heading', { name: 'Contact Me' });
    const body = card(page).locator('.allow-select');
    const titleBox = await rectOf(title);
    const bodyBox = await rectOf(body);

    expectNear(bodyBox.top - titleBox.bottom, 30, '제목 ↔ 연락처');
    expect(await style(title, 'font-size')).toBe('20px');
    expect(await style(title, 'line-height')).toBe('24px');
    expect(await style(title, 'font-weight')).toBe('600');
  });
});

test.describe('§5.9 Footer 3덩어리 폭과 간격 (예시 값 Footer, 1920)', () => {
  // 원본: [Info 289] ─20─ [Links 495: Quick Link ─80─ Category] ─20─ [Newsletter 392] = 1216
  test('미리보기 Footer도 콘텐츠 폭이 1216px이다 (다른 컨테이너 안에 갇히지 않는다)', async ({
    page,
  }) => {
    const footerBox = await rectOf(section(page, 'dev-layout-footer').getByRole('contentinfo'));
    const first = await rectOf(
      section(page, 'dev-layout-footer').getByRole('heading', { name: 'About' }),
    );
    const cardBox = await rectOf(
      section(page, 'dev-layout-footer').locator('[class*="bg-footer-card"]').first(),
    );

    expectNear(cardBox.right - first.left, 1216, 'About 왼쪽 ↔ 카드 오른쪽');
    expect(footerBox.width).toBeGreaterThanOrEqual(1216);
  });

  test('Info 289 · Links 495 · 카드 392px, 덩어리 사이 20px', async ({ page }) => {
    const footer = section(page, 'dev-layout-footer');
    const blocks = await footer.evaluate((root) => {
      const about = Array.from(root.querySelectorAll('h2')).find(
        (h) => h.textContent === 'About',
      )!.parentElement!;
      const links = Array.from(root.querySelectorAll('h2')).find(
        (h) => h.textContent === 'Quick Link',
      )!.parentElement!.parentElement!;
      const card = root.querySelector('[class*="bg-footer-card"]')!;
      const rects = [about, links, card].map((element) => element.getBoundingClientRect());
      return rects.map((rect) => ({ left: rect.left, right: rect.right, width: rect.width }));
    });

    expectNear(blocks[0]!.width, 289, 'Info 폭');
    expectNear(blocks[1]!.width, 495, 'Links 폭');
    expectNear(blocks[2]!.width, 392, '카드 폭');
    expectNear(blocks[1]!.left - blocks[0]!.right, 20, 'Info ↔ Links');
    expectNear(blocks[2]!.left - blocks[1]!.right, 20, 'Links ↔ 카드');
  });

  test('Quick Link ↔ Category 칸 사이 80px', async ({ page }) => {
    const footer = section(page, 'dev-layout-footer');
    const quick = await rectOf(
      footer.getByRole('heading', { name: 'Quick Link' }).locator('xpath=..'),
    );
    const category = await rectOf(
      footer.getByRole('heading', { name: 'Category' }).locator('xpath=..'),
    );

    expectNear(category.left - quick.right, 80, 'Quick Link ↔ Category');
  });

  test('Info 소개 문단 폭 280px, muted 색이다', async ({ page }) => {
    const about = section(page, 'dev-layout-footer').getByText(
      '기술과 기록을 모아 두는 개인 블로그입니다.',
    );

    expectNear((await rectOf(about)).width, 280, '소개 문단 폭');
    expect(await style(about, 'color')).toBe('rgb(105, 106, 117)');
  });

  test('Category 칸도 제목 ↔ 목록 24px, 목록 항목 사이 8px이다', async ({ page }) => {
    const footer = section(page, 'dev-layout-footer');
    const gaps = await footer.evaluate((root) => {
      const title = Array.from(root.querySelectorAll('h2')).find(
        (h) => h.textContent === 'Category',
      )!;
      const links = Array.from(title.parentElement!.querySelectorAll('a')).map((a) =>
        a.getBoundingClientRect(),
      );
      return {
        first: links[0]!.top - title.getBoundingClientRect().bottom,
        between: links.slice(1).map((rect, index) => rect.top - links[index]!.bottom),
      };
    });

    expectNear(gaps.first, 24, 'Category 제목 ↔ 첫 링크');
    for (const [index, gap] of gaps.between.entries())
      expectNear(gap, 8, `Category 항목 ${index + 1}↔${index + 2}`);
  });
});

test.describe('§5.7 PageInfo', () => {
  const pageInfo = (page: Page) => section(page, 'dev-layout-pageinfo');

  test('높이 100px이고 제목·Breadcrumb이 가운데 정렬이다', async ({ page }) => {
    const root = pageInfo(page).getByRole('heading', { name: 'Blog' }).locator('xpath=..');
    const rect = await rectOf(root);
    const title = await rectOf(pageInfo(page).getByRole('heading', { name: 'Blog' }));
    const nav = await rectOf(pageInfo(page).getByRole('navigation', { name: '현재 위치' }));

    expectNear(rect.height, 100, 'PageInfo 높이');
    const center = (rect.left + rect.right) / 2;
    expectNear((title.left + title.right) / 2, center, '제목 가운데');
    expectNear((nav.left + nav.right) / 2, center, 'Breadcrumb 가운데');
  });

  test('제목은 h3 Bold 24/28 700, Breadcrumb은 16/24이고 현재 위치는 muted 색이다', async ({
    page,
  }) => {
    const title = pageInfo(page).getByRole('heading', { name: 'Blog' });
    const home = pageInfo(page).getByRole('link', { name: 'Home' });
    const current = pageInfo(page).getByRole('navigation', { name: '현재 위치' }).getByText('Blog');

    expect(await style(title, 'font-size')).toBe('24px');
    expect(await style(title, 'line-height')).toBe('28px');
    expect(await style(title, 'font-weight')).toBe('700');
    expect(await style(home, 'font-size')).toBe('16px');
    expect(await style(home, 'line-height')).toBe('24px');
    expect(await style(current, 'color')).toBe('rgb(105, 106, 117)');
  });
});

test.describe('§4.1 Section 제목 ↔ 내용 32px', () => {
  test('제목이 있는 Section(section-titled)의 제목 하단 ↔ 내용 상단 32px', async ({ page }) => {
    const target = section(page, 'dev-layout-sections').locator('[data-example="section-titled"]');
    await expect(
      target,
      'dev 페이지에 data-example="section-titled" 예제가 필요하다',
    ).toBeVisible();

    const gap = await target.evaluate((element) => {
      const title = element.querySelector('h2')!.getBoundingClientRect();
      const body = Array.from(element.children)
        .find((child) => child.tagName !== 'H2')!
        .getBoundingClientRect();
      return body.top - title.bottom;
    });
    expectNear(gap, 32, '제목 ↔ 내용');
  });
});
