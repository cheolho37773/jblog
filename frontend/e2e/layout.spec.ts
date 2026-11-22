import { expect, test, type Page } from '@playwright/test';

// M1-04 레이아웃(Navbar·Footer) 반응형 규약 검증. 공개 사이트 첫 화면(/)에서 실제 렌더링으로 확인한다.
// 요소 이름은 지시서의 접근 가능한 이름을 따른다: banner·contentinfo·"메뉴 열기"·"검색 열기"·"검색".

test.use({ colorScheme: 'light' });

const DESKTOP_WIDTHS = [1920, 1440, 1280, 1024];
const TABLET_WIDTHS = [768, 1023];
const MOBILE_WIDTHS = [375, 767];
const ALL_WIDTHS = [1920, 1440, 1280, 1024, 768, 375];
const VIEWPORT_HEIGHT = 900;
const MENU_NAMES = ['Home', 'Blog', 'Projects', 'About', 'Contact'];
const FOOTER_QUICK_LINKS = ['Home', 'Blog', 'Projects', 'About', 'Contact', 'RSS'];
const POLICY_LINKS = [/terms/i, /privacy/i, /cookie/i];
const STICKY_TOLERANCE = 1;

const banner = (page: Page) => page.getByRole('banner');
const menuLink = (page: Page, name: string) =>
  banner(page).getByRole('link', { name, exact: true });

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
}

test.describe('Navbar 반응형 (UI §4.2)', () => {
  for (const width of DESKTOP_WIDTHS) {
    test(`${width}px: Logo · 메뉴 5개 · 검색 입력창 · 테마 토글이 보이고 햄버거는 없다`, async ({
      page,
    }) => {
      await open(page, width);

      await expect(banner(page).getByRole('link', { name: 'jblog 홈' })).toBeVisible();
      for (const name of MENU_NAMES) await expect(menuLink(page, name), name).toBeVisible();
      await expect(banner(page).getByRole('searchbox', { name: '검색' })).toBeVisible();
      await expect(banner(page).getByRole('switch', { name: '다크 모드' })).toBeVisible();
      await expect(banner(page).getByRole('button', { name: '메뉴 열기' })).toBeHidden();
      await expect(banner(page).getByRole('button', { name: '검색 열기' })).toBeHidden();
    });
  }

  for (const width of TABLET_WIDTHS) {
    test(`${width}px: Logo · 검색 입력창 · 테마 토글 · 햄버거가 보이고 메뉴 링크는 숨는다`, async ({
      page,
    }) => {
      await open(page, width);

      await expect(banner(page).getByRole('link', { name: 'jblog 홈' })).toBeVisible();
      await expect(banner(page).getByRole('searchbox', { name: '검색' })).toBeVisible();
      await expect(banner(page).getByRole('switch', { name: '다크 모드' })).toBeVisible();
      await expect(banner(page).getByRole('button', { name: '메뉴 열기' })).toBeVisible();
      await expect(banner(page).getByRole('button', { name: '검색 열기' })).toBeHidden();
      for (const name of MENU_NAMES) await expect(menuLink(page, name), name).toBeHidden();
    });
  }

  for (const width of MOBILE_WIDTHS) {
    test(`${width}px: Logo · 검색 아이콘 버튼 · 테마 토글 · 햄버거가 보이고 검색 입력창은 접힌다`, async ({
      page,
    }) => {
      await open(page, width);

      await expect(banner(page).getByRole('link', { name: 'jblog 홈' })).toBeVisible();
      await expect(banner(page).getByRole('button', { name: '검색 열기' })).toBeVisible();
      await expect(banner(page).getByRole('switch', { name: '다크 모드' })).toBeVisible();
      await expect(banner(page).getByRole('button', { name: '메뉴 열기' })).toBeVisible();
      await expect(banner(page).getByRole('searchbox', { name: '검색' })).toBeHidden();
      for (const name of MENU_NAMES) await expect(menuLink(page, name), name).toBeHidden();
    });
  }
});

test.describe('가로 스크롤 없음', () => {
  for (const width of ALL_WIDTHS) {
    test(`${width}px에서 scrollWidth가 clientWidth를 넘지 않는다`, async ({ page }) => {
      await open(page, width);
      await expect(page.getByRole('contentinfo')).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test('첫 화면: 본문 바로가기 링크는 첫 Tab에서 포커스되어 보이고 #main으로 이동한다', async ({
  page,
}) => {
  await open(page, 1280);

  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: '본문으로 건너뛰기' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await expect(skip).toHaveAttribute('href', '#main');
  await expect(page.locator('main#main')).toHaveCount(1);
});

test('첫 화면: 본문(main)이 하나이고 Container 안에 제목 "jblog"가 있다', async ({ page }) => {
  await open(page, 1280);

  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('main').getByRole('heading', { name: 'jblog' })).toBeVisible();
});

test('Navbar는 스크롤 후에도 viewport 상단에 붙어 있다 (sticky)', async ({ page }) => {
  await open(page, 1280);
  await page.evaluate(() => {
    document.body.style.minHeight = '4000px'; // 첫 화면은 짧아서 스크롤 여유를 만든다
  });

  await page.evaluate(() => window.scrollTo(0, 1500));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);

  const top = await banner(page).evaluate((element) => element.getBoundingClientRect().top);
  expect(Math.abs(top)).toBeLessThanOrEqual(STICKY_TOLERANCE);
});

test('테마 토글이 Navbar에서 동작한다', async ({ page }) => {
  await open(page, 1280);

  const toggle = banner(page).getByRole('switch', { name: '다크 모드' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
});

test('Navbar의 현재 메뉴: / 에서는 Home만 aria-current="page"이다', async ({ page }) => {
  await open(page, 1280);

  await expect(menuLink(page, 'Home')).toHaveAttribute('aria-current', 'page');
  for (const name of MENU_NAMES.filter((menu) => menu !== 'Home')) {
    await expect(menuLink(page, name), name).not.toHaveAttribute('aria-current', 'page');
  }
});

test.describe('값 없는 Footer (공개 사이트는 아직 값을 넘기지 않는다)', () => {
  test('Quick Link 6개가 있고 Category 칸·Contact Me 카드·정책 링크는 없다', async ({ page }) => {
    await open(page, 1280);
    const footer = page.getByRole('contentinfo');

    for (const name of FOOTER_QUICK_LINKS) {
      await expect(footer.getByRole('link', { name, exact: true }), name).toBeVisible();
    }
    await expect(footer.getByRole('link', { name: 'RSS' })).toHaveAttribute('href', '/feed.xml');
    await expect(footer.getByRole('heading', { name: 'Category' })).toHaveCount(0);
    await expect(footer.getByRole('heading', { name: 'Contact Me' })).toHaveCount(0);
    for (const policy of POLICY_LINKS)
      await expect(footer.getByRole('link', { name: policy })).toHaveCount(0);
  });

  test('카피라이트는 로고와 "© 연도 jblog. All rights reserved." 문구이다', async ({ page }) => {
    await open(page, 1280);
    const footer = page.getByRole('contentinfo');

    await expect(footer.getByRole('link', { name: 'jblog 홈' })).toBeVisible();
    await expect(footer).toContainText(`© ${new Date().getFullYear()} jblog. All rights reserved.`);
  });
});

test.describe('히트 영역 44x44 (375px, M1-03 터치 타겟 방식)', () => {
  const MIN_TARGET = 44;
  const HALF = MIN_TARGET / 2;
  const EDGE_INSET = 1;
  const OUTSIDE_OFFSET = 30; // 44px 영역(22px) 바깥. 대조용

  /**
   * 요소 중심에서 44x44 영역의 가장자리(부족한 축만)를 elementFromPoint로 찍어 같은 요소(또는 자식)가 잡히는지 본다.
   * padding·::after 확장은 해당 요소의 히트 영역이므로 이 방식으로 드러난다.
   */
  async function hitAreaProblems(page: Page, selector: string): Promise<string[]> {
    // 대상이 하나도 없으면 아무것도 검사하지 않고 통과해 버리므로, 없으면 문제로 돌려준다.
    return page.evaluate(
      ({ selector: query, half, inset }) => {
        const reach = half - inset;
        const isShown = (element: HTMLElement) => {
          const style = getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden';
        };
        // 44px에 못 미치는 축만 점검한다.
        const probesFor = (box: DOMRect): [string, number, number][] => {
          const cx = box.left + box.width / 2;
          const cy = box.top + box.height / 2;
          const probes: [string, number, number][] = [];
          if (box.height < half * 2) probes.push(['위', cx, cy - reach], ['아래', cx, cy + reach]);
          if (box.width < half * 2)
            probes.push(['왼쪽', cx - reach, cy], ['오른쪽', cx + reach, cy]);
          return probes;
        };
        const labelOf = (element: HTMLElement) =>
          element.getAttribute('aria-label') ?? element.textContent?.trim();

        const problems: string[] = [];
        const targets = Array.from(document.querySelectorAll<HTMLElement>(query)).filter(isShown);
        // 대상이 하나도 없으면 아무것도 검사하지 않고 통과해 버리므로 문제로 돌려준다.
        if (targets.length === 0) problems.push(`보이는 대상 없음: ${query}`);
        for (const target of targets) {
          target.scrollIntoView({ block: 'center' });
          for (const [side, x, y] of probesFor(target.getBoundingClientRect())) {
            const hit = document.elementFromPoint(x, y);
            if (!hit || !target.contains(hit)) problems.push(`${labelOf(target)} ${side}`);
          }
        }
        return problems;
      },
      { selector, half: HALF, inset: EDGE_INSET },
    );
  }

  test.beforeEach(async ({ page }) => {
    await open(page, 375);
  });

  test('Navbar의 조작 요소(로고·검색 열기·테마 토글·메뉴 열기)가 44x44 이상이다', async ({
    page,
  }) => {
    expect(await hitAreaProblems(page, 'header a, header button, header [role="switch"]')).toEqual(
      [],
    );
  });

  test('Footer 링크가 44x44 이상이다', async ({ page }) => {
    expect(await hitAreaProblems(page, 'footer a')).toEqual([]);
  });

  test('모바일 메뉴의 닫기 버튼과 링크가 44x44 이상이다', async ({ page }) => {
    await banner(page).getByRole('button', { name: '메뉴 열기' }).click();
    await expect(page.getByRole('dialog', { name: '메뉴' })).toBeVisible();

    expect(await hitAreaProblems(page, 'dialog[open] a, dialog[open] button')).toEqual([]);
  });

  test('검색 오버레이의 조작 요소가 44x44 이상이다', async ({ page }) => {
    await banner(page).getByRole('button', { name: '검색 열기' }).click();
    await expect(page.getByRole('dialog', { name: '검색' })).toBeVisible();

    expect(await hitAreaProblems(page, 'dialog[open] button, dialog[open] input')).toEqual([]);
  });

  test('대조: 햄버거 버튼에서 30px 떨어진 위쪽은 버튼 영역이 아니다', async ({ page }) => {
    const hamburger = banner(page).getByRole('button', { name: '메뉴 열기' });
    const box = await hamburger.boundingBox();
    if (!box) throw new Error('햄버거 버튼이 보이지 않는다');

    const insideButton = await hamburger.evaluate(
      (element, point) => {
        const hit = document.elementFromPoint(point.x, point.y);
        return hit !== null && element.contains(hit);
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 - OUTSIDE_OFFSET },
    );
    expect(insideButton).toBe(false);
  });
});

// Codex M1-04 r2: 데스크톱(>= 1024) Navbar는 하단 테두리를 뺀 높이가 100px이고(UI §4.1·§5.1),
// 내부 요소는 세로 가운데에 놓인다. 44x44 히트 영역은 유지하므로 시각 높이가 아니라 요소의 상자 중심을 본다.
test.describe('데스크톱 Navbar 높이와 세로 정렬 (UI §5.1)', () => {
  const NAVBAR_HEIGHT = 100;
  const HEIGHT_TOLERANCE = 0.5;
  const CENTER_TOLERANCE = 1;

  for (const width of [1280, 1024]) {
    test(`${width}px: banner 높이(테두리 제외)는 ${NAVBAR_HEIGHT}px이다`, async ({ page }) => {
      await open(page, width);

      const height = await banner(page).evaluate((element) => element.clientHeight);

      expect(Math.abs(height - NAVBAR_HEIGHT), `실제 높이 ${height}px`).toBeLessThanOrEqual(
        HEIGHT_TOLERANCE,
      );
    });

    test(`${width}px: 로고·메뉴·검색 입력·테마 토글의 세로 중심이 Navbar 중심과 ±${CENTER_TOLERANCE}px이다`, async ({
      page,
    }) => {
      await open(page, width);
      const targets = [
        banner(page).getByRole('link', { name: 'jblog 홈' }),
        ...MENU_NAMES.map((name) => menuLink(page, name)),
        banner(page).getByRole('searchbox', { name: '검색' }),
        banner(page).getByRole('switch', { name: '다크 모드' }),
      ];

      const navbarCenter = await banner(page).evaluate((element) => {
        const box = element.getBoundingClientRect();
        return box.top + element.clientTop + element.clientHeight / 2; // 상단 테두리·하단 테두리 제외한 가운데
      });

      for (const target of targets) {
        await expect(target).toBeVisible();
        const center = await target.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return box.top + box.height / 2;
        });
        const label = await target.evaluate(
          (element) => element.getAttribute('aria-label') ?? element.textContent?.trim(),
        );
        expect(
          Math.abs(center - navbarCenter),
          `${label} 중심 ${center} / Navbar 중심 ${navbarCenter}`,
        ).toBeLessThanOrEqual(CENTER_TOLERANCE);
      }
    });
  }
});
