import { expect, test, type Locator, type Page } from '@playwright/test';

// M1-04 Codex r4: UI 기획서 §4.1·§5.1·§5.9에 적힌 원본 수치를 실제 렌더링으로 한 번에 점검한다 (공개 사이트 `/`).
// 측정 폭은 원본 1920px 프레임(좌우 여백 352). 허용 오차 ±0.5px (글자 폭처럼 폰트에 좌우되는 값은 제외).
// 제외·의도된 차이 항목은 docs/work/M1/tasks/M1-04.md "UI 수치 목록표" 참고.

test.use({ colorScheme: 'light' });

const FRAME_WIDTH = 1920;
const FRAME_HEIGHT = 1000;
const TOLERANCE = 0.5;
const CONTAINER_LEFT = 352; // (1920 - 1216) / 2
const CONTENT_WIDTH = 1216;

const header = (page: Page) => page.getByRole('banner');
const footer = (page: Page) => page.getByRole('contentinfo');

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

async function box(target: Locator): Promise<Box> {
  await expect(target).toBeVisible();
  return target.evaluate((element) => {
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
}

const style = (target: Locator, property: string) =>
  target.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);

function expectNear(actual: number, expected: number, label: string) {
  expect
    .soft(Math.abs(actual - expected), `${label}: 기획 ${expected} / 실제 ${actual}`)
    .toBeLessThanOrEqual(TOLERANCE);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: FRAME_WIDTH, height: FRAME_HEIGHT });
  await page.goto('/');
});

test.describe('UI §4.1 레이아웃', () => {
  test('콘텐츠 영역은 폭 1216, 왼쪽 여백 352이다 (Navbar 로고·Footer 내용의 시작점)', async ({
    page,
  }) => {
    expectNear(
      (await box(header(page).getByRole('link', { name: 'jblog 홈' }))).left,
      CONTAINER_LEFT,
      'Navbar 로고 왼쪽',
    );
    // `/`의 Footer에는 About이 없어 첫 칸 제목 위치가 내용 시작점이 아니다(Quick Link는 Links 칸 안에서 오른쪽 정렬). 컨테이너 자체로 잰다.
    // 컨테이너는 좌우 padding을 포함해 폭이 더 크므로, padding을 뺀 내용 상자로 잰다.
    const content = await footer(page)
      .locator('.container-site')
      .first()
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const left = rect.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
        const right =
          rect.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
        return { left, width: right - left };
      });
    expectNear(content.left, CONTAINER_LEFT, 'Footer 내용 왼쪽');
    expectNear(content.width, CONTENT_WIDTH, 'Footer 내용 폭');
  });

  test('Navbar → 콘텐츠 간격 24px (Navbar 하단 ↔ 본문 첫 제목 상단)', async ({ page }) => {
    const navbar = await box(header(page));
    const firstContent = await box(page.getByRole('main').getByRole('heading').first());

    expectNear(firstContent.top - navbar.bottom, 24, 'Navbar → 콘텐츠');
  });

  test('Footer padding-top 64px (상단 테두리 아래 ↔ 첫 칸 제목 상단)', async ({ page }) => {
    const top = await footer(page).evaluate(
      (element) => element.getBoundingClientRect().top + element.clientTop,
    );
    const firstTitle = await box(footer(page).locator('h2').first());

    expectNear(firstTitle.top - top, 64, 'Footer padding-top');
  });

  test('Footer 상단 border 1px이고 배경은 footer-bg이다', async ({ page }) => {
    expect(await style(footer(page), 'border-top-width')).toBe('1px');
    expect(await style(footer(page), 'background-color')).toBe('rgb(246, 246, 247)'); // #F6F6F7
  });

  test('Footer 상단 콘텐츠 ↔ 카피라이트 구분선 64px, 구분선 ↔ 카피라이트 줄 32px, 줄 ↔ Footer 하단 32px', async ({
    page,
  }) => {
    const metrics = await footer(page).evaluate((root) => {
      const rule = Array.from(root.querySelectorAll<HTMLElement>('div')).find(
        (element) =>
          getComputedStyle(element).borderTopWidth === '1px' &&
          element.querySelector('a[aria-label="jblog 홈"]'),
      );
      if (!rule) throw new Error('카피라이트 구분선을 찾을 수 없다');
      const ruleBox = rule.getBoundingClientRect();
      const content = Array.from(rule.parentElement!.children)
        .filter((child) => child !== rule)
        .map((child) => child.getBoundingClientRect().bottom);
      const row = Array.from(rule.children).map((child) => child.getBoundingClientRect());
      return {
        above: ruleBox.top - Math.max(...content),
        below: Math.min(...row.map((r) => r.top)) - (ruleBox.top + 1),
        bottom: root.getBoundingClientRect().bottom - Math.max(...row.map((r) => r.bottom)),
      };
    });

    expectNear(metrics.above, 64, '콘텐츠 ↔ 구분선');
    expectNear(metrics.below, 32, '구분선 ↔ 카피라이트 줄 상단 (padding 32)');
    expectNear(metrics.bottom, 32, '카피라이트 줄 하단 ↔ Footer 하단 (padding 32)');
  });
});

test.describe('UI §5.1 Navbar', () => {
  test('메뉴 항목은 Work Sans 400 16/24이고 hover 전환은 150ms이다', async ({ page }) => {
    const blog = header(page).getByRole('link', { name: 'Blog', exact: true });

    expect(await style(blog, 'font-size')).toBe('16px');
    expect(await style(blog, 'line-height')).toBe('24px');
    expect(await style(blog, 'font-weight')).toBe('400');
    expect(await style(blog, 'transition-duration')).toContain('0.15s');
  });

  test('활성 메뉴(Home)는 weight 500이다', async ({ page }) => {
    expect(
      await style(header(page).getByRole('link', { name: 'Home', exact: true }), 'font-weight'),
    ).toBe('500');
  });

  test('메뉴 항목 사이 간격 40px (링크 상자 기준, 히트 영역 확장 제외)', async ({ page }) => {
    const names = ['Home', 'Blog', 'Projects', 'About', 'Contact'];
    const boxes = [];
    for (const name of names)
      boxes.push(await box(header(page).getByRole('link', { name, exact: true })));

    for (let index = 1; index < boxes.length; index += 1) {
      expectNear(
        boxes[index]!.left - boxes[index - 1]!.right,
        40,
        `${names[index - 1]} ↔ ${names[index]}`,
      );
    }
  });

  test('메뉴는 Navbar 내부에서 가운데 정렬이다 (콘텐츠 중심 ±1px)', async ({ page }) => {
    const first = await box(header(page).getByRole('link', { name: 'Home', exact: true }));
    const last = await box(header(page).getByRole('link', { name: 'Contact', exact: true }));
    const menuCenter = (first.left + last.right) / 2;

    expect(Math.abs(menuCenter - FRAME_WIDTH / 2), `메뉴 중심 ${menuCenter}`).toBeLessThanOrEqual(
      1,
    );
  });

  test('Search 입력은 폭 166, radius 5, 아이콘 16px이다', async ({ page }) => {
    const input = header(page).getByRole('searchbox', { name: '검색' });

    expectNear((await box(input)).width, 166, 'Search 폭');
    expect(await style(input, 'border-top-left-radius')).toBe('5px');
    expectNear(
      (await box(header(page).locator('form[role="search"] svg'))).width,
      16,
      'Search 아이콘',
    );
  });

  test('Search 입력 높이 36px (padding 8 + 줄 20 + padding 8)', async ({ page }) => {
    expectNear(
      (await box(header(page).getByRole('searchbox', { name: '검색' }))).height,
      36,
      'Search 높이',
    );
  });

  test('Search padding 8 / 8+16+12(아이콘·gap) / 8 / 16', async ({ page }) => {
    const input = header(page).getByRole('searchbox', { name: '검색' });

    expect(await style(input, 'padding-top')).toBe('8px');
    expect(await style(input, 'padding-bottom')).toBe('8px');
    expect(await style(input, 'padding-left')).toBe('16px');
    // 원본: 오른쪽 padding 8 + 아이콘 16 + 아이콘↔글자 gap 12 = 글자 영역이 끝나는 위치
    expect(await style(input, 'padding-right')).toBe('36px');
    const input_ = await box(input);
    const icon = await box(header(page).locator('form[role="search"] svg'));
    expectNear(input_.right - icon.right, 8, 'Search 아이콘 오른쪽 여백');
  });

  test('Search ↔ 테마 토글 간격 40px', async ({ page }) => {
    const search = await box(header(page).getByRole('searchbox', { name: '검색' }));
    const toggle = await box(header(page).getByRole('switch', { name: '다크 모드' }));

    expectNear(toggle.left - search.right, 40, 'Search → Toggle');
  });

  test('테마 토글: 트랙 48×28(radius 100), 노브 24×24 · margin 2 · 아이콘 14', async ({ page }) => {
    const toggle = header(page).getByRole('switch', { name: '다크 모드' });
    const track = await box(toggle);
    const knob = await box(toggle.locator('span').first());
    const icon = await box(toggle.locator('svg'));

    expectNear(track.width, 48, '트랙 폭');
    expectNear(track.height, 28, '트랙 높이');
    expect(parseFloat(await style(toggle, 'border-top-left-radius'))).toBeGreaterThanOrEqual(14);
    expectNear(knob.width, 24, '노브 폭');
    expectNear(knob.height, 24, '노브 높이');
    expectNear(knob.left - track.left, 2, '노브 margin(왼쪽)');
    expectNear(knob.top - track.top, 2, '노브 margin(위)');
    expectNear(icon.width, 14, '노브 아이콘');
    expect(await style(toggle.locator('span').first(), 'box-shadow')).not.toBe('none');
  });

  test('Dark에서 노브가 오른쪽으로 20px 이동한다', async ({ page }) => {
    const toggle = header(page).getByRole('switch', { name: '다크 모드' });
    const before = await box(toggle.locator('span').first());
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.waitForTimeout(300); // 이동 애니메이션 200ms

    const after = await box(toggle.locator('span').first());
    expectNear(after.left - before.left, 20, '노브 이동');
  });

  test('Sticky Navbar: 하단 border 1px, 배경은 bg이다', async ({ page }) => {
    expect(await style(header(page), 'border-bottom-width')).toBe('1px');
    expect(await style(header(page), 'background-color')).toBe('rgb(255, 255, 255)');
  });
});

test.describe('UI §5.9 Footer (값 없는 공개 사이트 `/`)', () => {
  test('칸 제목은 Plus Jakarta 600 18/28, 링크는 400 16/24이다', async ({ page }) => {
    const title = footer(page).getByRole('heading', { name: 'Quick Link' });
    const link = footer(page).getByRole('link', { name: 'Blog', exact: true });

    expect(await style(title, 'font-size')).toBe('18px');
    expect(await style(title, 'line-height')).toBe('28px');
    expect(await style(title, 'font-weight')).toBe('600');
    expect(await style(title, 'font-family')).toMatch(/jakarta/i);
    expect(await style(link, 'font-size')).toBe('16px');
    expect(await style(link, 'line-height')).toBe('24px');
    expect(await style(link, 'font-weight')).toBe('400');
    expect(await style(link, 'font-family')).toMatch(/jakarta/i);
  });

  test('카피라이트 문구는 16/24 muted이다', async ({ page }) => {
    const copyright = footer(page).getByText(/All rights reserved/);

    expect(await style(copyright, 'font-size')).toBe('16px');
    expect(await style(copyright, 'line-height')).toBe('24px');
    expect(await style(copyright, 'color')).toBe('rgb(105, 106, 117)'); // --color-text-muted Light #696A75
  });

  test('Footer 내용 폭은 1216px이다', async ({ page }) => {
    const rule = await footer(page).evaluate((root) => {
      const grid = root.querySelector('h2')!.closest('div')!.parentElement!.parentElement!;
      return grid.getBoundingClientRect().width;
    });

    expectNear(rule, CONTENT_WIDTH, 'Footer 내용 폭');
  });
});

test.describe('UI §5.9 Footer 저작권 줄 (로고 + 문구 묶음)', () => {
  const copyrightBundle = async (page: Page) => {
    const logo = await box(footer(page).getByRole('link', { name: 'jblog 홈' }));
    const text = await box(footer(page).getByText(/All rights reserved/));
    return { logo, text };
  };

  test('1920: 로고 아래에 문구가 gap 2px로 붙고 둘 다 콘텐츠 왼쪽(352)에서 시작한다', async ({
    page,
  }) => {
    const { logo, text } = await copyrightBundle(page);

    expectNear(text.top - logo.bottom, 2, '로고 ↔ 저작권 문구 gap');
    expectNear(text.left, CONTAINER_LEFT, '저작권 문구 왼쪽');
    expectNear(logo.left, CONTAINER_LEFT, '저작권 로고 왼쪽');
  });

  test('768 이상(tablet 경계)에서도 왼쪽 정렬이다', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: FRAME_HEIGHT });
    const { logo, text } = await copyrightBundle(page);

    expectNear(text.left, logo.left, '문구 왼쪽 ↔ 로고 왼쪽');
  });

  test('768 미만(375)에서는 로고와 문구가 가운데 정렬이다', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: FRAME_HEIGHT });
    const { logo, text } = await copyrightBundle(page);
    const center = (target: Box) => (target.left + target.right) / 2;

    expectNear(center(logo), 375 / 2, '로고 가운데');
    expectNear(center(text), 375 / 2, '문구 가운데');
  });
});

// 자체 검사 수정 1: 값이 없는 Footer(Quick Link만)에서 Quick Link가 콘텐츠 왼쪽에서 시작해야 한다.
// 수정 전에는 Links 묶음이 오른쪽에 붙어 1920에서 약 472에서 시작했다.
test.describe('Footer 값 없음: Quick Link 제목은 콘텐츠 왼쪽에서 시작한다', () => {
  for (const width of [1920, 1280]) {
    test(`${width}px에서 Quick Link 제목 왼쪽 = 콘텐츠 내용 상자 왼쪽`, async ({ page }) => {
      await page.setViewportSize({ width, height: FRAME_HEIGHT });
      await page.goto('/');
      const positions = await footer(page).evaluate((root) => {
        const container = root.querySelector<HTMLElement>('.container-site')!;
        const style = getComputedStyle(container);
        const contentLeft =
          container.getBoundingClientRect().left +
          parseFloat(style.paddingLeft) +
          parseFloat(style.borderLeftWidth);
        const title = Array.from(root.querySelectorAll('h2')).find(
          (h) => h.textContent?.trim() === 'Quick Link',
        );
        if (!title) throw new Error('Quick Link 제목을 찾을 수 없다');
        return { contentLeft, titleLeft: title.getBoundingClientRect().left };
      });

      expectNear(positions.titleLeft, positions.contentLeft, `Quick Link 왼쪽(${width})`);
    });
  }
});
