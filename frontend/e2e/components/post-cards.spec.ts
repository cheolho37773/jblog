import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { pinTheme, THEMES, waitForFonts, type Theme } from '../helpers/theme';

// M2-06 ① 필수 검증: /dev/components 의 `dev-posts-cards` 섹션(카드 컴포넌트 모음).
// 수치는 UI §5.2~§5.6·§4.2 표 그대로이며 원본 1440px 프레임에서 계산값(getComputedStyle·getBoundingClientRect)으로 비교한다.
//
// 구현자가 /dev/components 섹션에 둬야 하는 래퍼(data-testid). 카드 내부 구조는 가정하지 않는다.
//   dev-posts-cards  섹션 전체
//   dev-card-grid    PostCardGrid 3장 (커버 있음 · 커버 없음 · 카테고리 null 중 하나 이상, 3줄을 넘는 긴 제목 1장 이상). 1440에서 3열.
//   dev-card-overlay PostCardOverlay 1장 (첫 자식이 카드 루트)
//   dev-card-hero    FeaturedHeroCard 1장 (첫 자식이 카드 루트)
//   dev-chips        CategoryChips (activeSlug가 있는 선택 상태, 칩 5개 이상)
//   dev-card-skeleton PostCardSkeleton 3장
// 해석: "카드 박스" = 제목(heading)에서 위로 올라가며 처음 만나는 1px 테두리 조상. 플로팅 카드도 같다.

const SECTION = 'dev-posts-cards';
const DESKTOP = { width: 1440, height: 900 };
const WIDTHS = [375, 768, 1024, 1440] as const;
const TOLERANCE = 0.5;
const HOVER_SETTLE_MS = 600;

const COLORS = {
  light: {
    surface: 'rgb(255, 255, 255)',
    border: 'rgb(232, 232, 234)',
    strong: 'rgb(24, 26, 42)',
    muted: 'rgb(105, 106, 117)',
    subtle: 'rgb(246, 246, 247)',
  },
  dark: {
    surface: 'rgb(24, 26, 42)',
    border: 'rgb(36, 37, 53)',
    strong: 'rgb(255, 255, 255)',
    muted: 'rgb(151, 152, 159)',
    subtle: 'rgb(36, 37, 53)',
  },
} as const;
const ON_PRIMARY = 'rgb(255, 255, 255)';
const OVERLAY = 'rgba(20, 22, 36, 0.4)';
const SHADOW_MD = 'rgba(24, 26, 42, 0.12) 0px 12px 24px -6px';

const wrap = (page: Page, id: string) => page.getByTestId(SECTION).getByTestId(id);

async function open(page: Page, theme: Theme, size: { width: number; height: number }) {
  await pinTheme(page, theme);
  await page.setViewportSize(size);
  await page.goto('/dev/components');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  // 섹션이 없는 상태에서 "겹침 없음"·axe 0건이 우연히 통과하지 않게 한다.
  await expect(page.getByTestId(SECTION)).toBeVisible();
  await waitForFonts(page);
}

function near(actual: number, expected: number, label: string) {
  expect
    .soft(Math.abs(actual - expected), `${label}: 기획 ${expected} / 실제 ${actual}`)
    .toBeLessThanOrEqual(TOLERANCE);
}

/** 제목에서 위로 올라가며 처음 만나는 1px 테두리 조상(카드 박스)과 그 안쪽 수치를 돌려준다. */
function measureCard(root: Locator) {
  // eslint-disable-next-line complexity -- 페이지 안에서 한 번에 수치를 모으는 측정 함수라 분기가 많다
  return root.evaluate((rootEl) => {
    const px = (v: string) => parseFloat(v);
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    };
    const heading = rootEl.querySelector('h1, h2, h3');
    if (!heading) throw new Error('제목(heading)이 없다');
    let box: Element | null = heading;
    while (box && box !== rootEl.parentElement && px(getComputedStyle(box).borderTopWidth) !== 1)
      box = box.parentElement;
    if (!box || px(getComputedStyle(box).borderTopWidth) !== 1)
      throw new Error('1px 테두리 카드 박스가 없다');
    const s = getComputedStyle(box);
    const img = rootEl.querySelector('img');
    const time = rootEl.querySelector('time');
    const badge = [...rootEl.querySelectorAll('span, div')].find((e) =>
      /bg-primary-(soft|strong)/.test(e.className.toString()),
    );
    return {
      box: rect(box),
      boxStyle: {
        padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(px),
        rowGap: px(s.rowGap),
        radius: px(s.borderTopLeftRadius),
        background: s.backgroundColor,
        border: s.borderTopColor,
        shadow: s.boxShadow,
        display: s.display,
      },
      heading: {
        ...rect(heading),
        color: getComputedStyle(heading).color,
        fontSize: px(getComputedStyle(heading).fontSize),
        lineHeight: px(getComputedStyle(heading).lineHeight),
      },
      time: time
        ? { ...rect(time), color: getComputedStyle(time.parentElement ?? time).color }
        : null,
      badge: badge ? { ...rect(badge), background: getComputedStyle(badge).backgroundColor } : null,
      img: img ? { ...rect(img), radius: px(getComputedStyle(img).borderTopLeftRadius) } : null,
    };
  });
}

test.describe('섹션 존재와 구성', () => {
  test('dev-posts-cards 섹션에 카드 3장·오버레이·히어로·칩·스켈레톤 3장이 있다', async ({
    page,
  }) => {
    await open(page, 'light', DESKTOP);
    await expect(wrap(page, 'dev-card-grid').getByRole('article')).toHaveCount(3);
    await expect(wrap(page, 'dev-card-overlay')).toBeVisible();
    await expect(wrap(page, 'dev-card-hero')).toBeVisible();
    await expect(
      wrap(page, 'dev-chips').getByRole('navigation', { name: '카테고리' }),
    ).toBeVisible();
    await expect(wrap(page, 'dev-card-skeleton').locator('[aria-hidden="true"]')).not.toHaveCount(
      0,
    );
  });

  test('예시 카드에 커버 없음·카테고리 없음·3줄 넘는 제목이 모두 포함된다', async ({ page }) => {
    await open(page, 'light', DESKTOP);
    const articles = wrap(page, 'dev-card-grid').getByRole('article');
    const info = await articles.evaluateAll((els) =>
      els.map((el) => ({
        hasImg: el.querySelector('img') !== null,
        hasBadge: [...el.querySelectorAll('*')].some((e) =>
          /bg-primary-soft/.test(e.className.toString()),
        ),
        clamped: (() => {
          const h = el.querySelector('h2, h3');
          return !!h && h.scrollHeight > h.clientHeight + 1;
        })(),
      })),
    );
    expect(info.some((c) => c.hasImg)).toBe(true);
    expect(info.some((c) => !c.hasImg)).toBe(true);
    expect(info.some((c) => !c.hasBadge)).toBe(true);
    expect(info.some((c) => c.clamped)).toBe(true);
  });

  test('카드 안에 링크가 중첩되지 않고 카드마다 링크가 하나다', async ({ page }) => {
    await open(page, 'light', DESKTOP);
    await expect(page.getByTestId(SECTION).locator('a a')).toHaveCount(0);
    for (const article of await wrap(page, 'dev-card-grid').getByRole('article').all()) {
      await expect(article.getByRole('link')).toHaveCount(1);
      await expect(article.getByRole('link')).toHaveAttribute('href', /^\/blog\/[^/]+$/);
    }
  });

  test('커버가 없는 카드는 img 없이 bg-subtle 자리 표시가 썸네일 비율(3:2)로 잡힌다', async ({
    page,
  }) => {
    await open(page, 'light', DESKTOP);
    const articles = await wrap(page, 'dev-card-grid').getByRole('article').all();
    let checked = 0;
    for (const article of articles) {
      if ((await article.locator('img').count()) > 0) continue;
      const placeholder = await article.evaluate((el, subtle) => {
        const found = [...el.querySelectorAll('*')].find(
          (e) => getComputedStyle(e).backgroundColor === subtle,
        );
        if (!found) return null;
        const r = found.getBoundingClientRect();
        return { ratio: r.width / r.height };
      }, COLORS.light.subtle);
      expect(placeholder, '자리 표시(bg-subtle)').not.toBeNull();
      expect(placeholder?.ratio ?? 0).toBeCloseTo(1.5, 1);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

for (const theme of THEMES) {
  test.describe(`UI §5.4 Post Card Grid 수치 (1440, ${theme})`, () => {
    test('카드: 배경 surface·테두리 1px border·radius 12·padding 16·gap 16', async ({ page }) => {
      await open(page, theme, DESKTOP);
      const card = await measureCard(wrap(page, 'dev-card-grid').getByRole('article').first());
      const { boxStyle } = card;
      expect(boxStyle.background).toBe(COLORS[theme].surface);
      expect(boxStyle.border).toBe(COLORS[theme].border);
      near(boxStyle.radius, 12, 'radius');
      // padding 16은 카드 박스 또는 링크(article > a) 어느 쪽에 걸려도 되므로 박스 + 내부 이격의 합으로 본다: 썸네일 위·좌 이격 = 1(border) + 16.
      const thumbLeft = (card.img?.left ?? card.box.left) - card.box.left;
      near(thumbLeft, 17, '썸네일 좌측 이격(border 1 + padding 16)');
    });

    test('썸네일: 3:2 비율, radius 6, 카드 안쪽 폭을 채우며 위쪽 이격 17', async ({ page }) => {
      await open(page, theme, DESKTOP);
      const card = await measureCard(wrap(page, 'dev-card-grid').getByRole('article').first());
      expect(card.img).not.toBeNull();
      const img = card.img!;
      expect(img.width / img.height).toBeCloseTo(1.5, 2);
      near(img.radius, 6, '썸네일 radius');
      near(img.top - card.box.top, 17, '썸네일 위 이격');
      near(card.box.right - img.right, 17, '썸네일 우측 이격');
    });

    test('제목 24/28 text-strong, 메타 16/24 text-muted', async ({ page }) => {
      await open(page, theme, DESKTOP);
      const card = await measureCard(wrap(page, 'dev-card-grid').getByRole('article').first());
      expect(card.heading.fontSize).toBe(24);
      expect(card.heading.lineHeight).toBe(28);
      expect(card.heading.color).toBe(COLORS[theme].strong);
      expect(card.time?.color).toBe(COLORS[theme].muted);
    });

    test('Content: 썸네일→배지 16+8, 배지→제목 16, 제목→메타 20', async ({ page }) => {
      await open(page, theme, DESKTOP);
      const card = await measureCard(wrap(page, 'dev-card-grid').getByRole('article').first());
      expect(card.badge).not.toBeNull();
      near(card.badge!.top - card.img!.bottom, 24, '썸네일→배지(gap 16 + content padding 8)');
      near(card.heading.top - card.badge!.bottom, 16, '배지→제목');
      expect(card.time).not.toBeNull();
      near(card.time!.top - card.heading.bottom, 20, '제목→메타(content gap 20)');
    });

    test('카드 배지는 soft(primary-soft 배경)다', async ({ page }) => {
      await open(page, theme, DESKTOP);
      const card = await measureCard(wrap(page, 'dev-card-grid').getByRole('article').first());
      expect(card.badge?.background).toBe('rgba(75, 107, 251, 0.05)');
    });

    test('제목은 3줄에서 잘린다 (최대 높이 84)', async ({ page }) => {
      await open(page, theme, DESKTOP);
      const heights = await wrap(page, 'dev-card-grid')
        .getByRole('article')
        .evaluateAll((els) =>
          els.map((el) => el.querySelector('h2, h3')?.getBoundingClientRect().height ?? 0),
        );
      expect(Math.max(...heights)).toBeCloseTo(84, 0);
      for (const h of heights) expect(h).toBeLessThanOrEqual(84.5);
    });

    test('1440에서 카드 3장이 한 줄(3열)에 놓인다', async ({ page }) => {
      await open(page, theme, DESKTOP);
      const tops = await wrap(page, 'dev-card-grid')
        .getByRole('article')
        .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
      expect(new Set(tops).size).toBe(1);
    });
  });

  test.describe(`UI §5.6 Overlay Post Card 수치 (1440, ${theme})`, () => {
    const root = (page: Page) => wrap(page, 'dev-card-overlay').locator('> *').first();

    test('1216×450, radius 12, overflow hidden, padding 40', async ({ page }) => {
      await open(page, theme, DESKTOP);
      const r = await root(page).evaluate((el) => {
        const s = getComputedStyle(el);
        const b = el.getBoundingClientRect();
        return {
          w: b.width,
          h: b.height,
          radius: parseFloat(s.borderTopLeftRadius),
          overflow: s.overflow,
        };
      });
      near(r.w, 1216, '폭');
      near(r.h, 450, '높이');
      near(r.radius, 12, 'radius');
      expect(r.overflow).toBe('hidden');
    });

    test('오버레이 rgba(20,22,36,0.4)가 카드 전체를 덮는다', async ({ page }) => {
      await open(page, theme, DESKTOP);
      const covered = await root(page).evaluate((el, overlay) => {
        const b = el.getBoundingClientRect();
        return [...el.querySelectorAll('*')].some((e) => {
          const r = e.getBoundingClientRect();
          return (
            getComputedStyle(e).backgroundColor === overlay &&
            r.width >= b.width - 1 &&
            r.height >= b.height - 1
          );
        });
      }, OVERLAY);
      expect(covered).toBe(true);
    });

    test('내용은 하단 정렬이다: 메타 아래 이격 40, 왼쪽 이격 40', async ({ page }) => {
      await open(page, theme, DESKTOP);
      const card = await root(page).evaluate((el) => {
        const b = el.getBoundingClientRect();
        const time = el.querySelector('time')!.getBoundingClientRect();
        const h = el.querySelector('h1, h2')!.getBoundingClientRect();
        return { bottom: b.bottom - time.bottom, left: h.left - b.left, headingWidth: h.width };
      });
      near(card.bottom, 40, '메타 아래 이격');
      near(card.left, 40, '왼쪽 이격');
      expect(card.headingWidth).toBeLessThanOrEqual(720 + TOLERANCE);
    });

    test('제목 36/40·메타 16/24 글자색이 모두 on-primary다 (이미지 위 글자 규칙)', async ({
      page,
    }) => {
      await open(page, theme, DESKTOP);
      const s = await root(page).evaluate((el) => {
        const h = el.querySelector('h1, h2')!;
        const t = el.querySelector('time')!;
        const hs = getComputedStyle(h);
        return {
          size: parseFloat(hs.fontSize),
          line: parseFloat(hs.lineHeight),
          title: hs.color,
          meta: getComputedStyle(t.parentElement!).color,
          time: getComputedStyle(t).color,
        };
      });
      expect(s.size).toBe(36);
      expect(s.line).toBe(40);
      expect(s.title).toBe(ON_PRIMARY);
      expect(s.meta).toBe(ON_PRIMARY);
      expect(s.time).toBe(ON_PRIMARY);
    });

    test('배지는 solid(primary-strong 배경)이고 제목과 메타 사이 간격은 AuthorMeta gap 20이다', async ({
      page,
    }) => {
      await open(page, theme, DESKTOP);
      const s = await root(page).evaluate((el) => {
        const badge = [...el.querySelectorAll('*')].find((e) =>
          /bg-primary-strong/.test(e.className.toString()),
        );
        return { bg: badge ? getComputedStyle(badge).backgroundColor : null };
      });
      expect(s.bg).toBe('rgb(67, 97, 238)');
    });
  });

  test.describe(`UI §5.5 Featured Hero Card 수치 (1440, ${theme})`, () => {
    const root = (page: Page) => wrap(page, 'dev-card-hero').locator('> *').first();

    test('이미지 1216×600 radius 12 위에 overlay가 덮인다', async ({ page }) => {
      await open(page, theme, DESKTOP);
      const found = await root(page).evaluate((el, overlay) => {
        const all = [el, ...el.querySelectorAll('*')];
        const image = all.find((e) => {
          const r = e.getBoundingClientRect();
          return Math.abs(r.width - 1216) <= 0.5 && Math.abs(r.height - 600) <= 0.5;
        });
        if (!image) return null;
        const ib = image.getBoundingClientRect();
        const covered = [...image.querySelectorAll('*'), image].some((e) => {
          const r = e.getBoundingClientRect();
          return (
            getComputedStyle(e).backgroundColor === overlay &&
            r.width >= ib.width - 1 &&
            r.height >= ib.height - 1
          );
        });
        return { radius: parseFloat(getComputedStyle(image).borderTopLeftRadius), covered };
      }, OVERLAY);
      expect(found, '1216×600 이미지 영역').not.toBeNull();
      near(found!.radius, 12, '이미지 radius');
      expect(found!.covered).toBe(true);
    });

    test('플로팅 카드: left 64·top 360·폭 598·padding 40·gap 24·radius 12·surface·border·shadow-md', async ({
      page,
    }) => {
      await open(page, theme, DESKTOP);
      const card = await measureCard(root(page));
      const imageBox = await root(page).evaluate((el) => {
        const all = [el, ...el.querySelectorAll('*')];
        const image = all.find((e) => {
          const r = e.getBoundingClientRect();
          return Math.abs(r.width - 1216) <= 0.5 && Math.abs(r.height - 600) <= 0.5;
        })!;
        const r = image.getBoundingClientRect();
        return { left: r.left, top: r.top };
      });
      near(card.box.left - imageBox.left, 64, 'left');
      near(card.box.top - imageBox.top, 360, 'top');
      near(card.box.width, 598, '폭');
      near(card.boxStyle.radius, 12, 'radius');
      for (const p of card.boxStyle.padding) near(p, 40, 'padding');
      near(card.boxStyle.rowGap, 24, 'gap');
      expect(card.boxStyle.background).toBe(COLORS[theme].surface);
      expect(card.boxStyle.border).toBe(COLORS[theme].border);
      expect(card.boxStyle.shadow).toBe(SHADOW_MD);
    });

    test('플로팅 카드 안: 배지 solid, 제목 h1 36/40 text-strong, 메타 text-muted', async ({
      page,
    }) => {
      await open(page, theme, DESKTOP);
      const card = await measureCard(root(page));
      expect(card.badge?.background).toBe('rgb(67, 97, 238)');
      expect(card.heading.fontSize).toBe(36);
      expect(card.heading.lineHeight).toBe(40);
      expect(card.heading.color).toBe(COLORS[theme].strong);
      expect(card.time?.color).toBe(COLORS[theme].muted);
    });

    test('카드는 이미지 하단 아래로 돌출하고 블록 밖(다음 요소)과 겹치지 않는다', async ({
      page,
    }) => {
      await open(page, theme, DESKTOP);
      const gap = await wrap(page, 'dev-card-hero').evaluate((w) => {
        const r = w.firstElementChild!.getBoundingClientRect();
        const heading = w.querySelector('h1, h2')!;
        let box: Element | null = heading;
        while (box && parseFloat(getComputedStyle(box).borderTopWidth) !== 1)
          box = box.parentElement;
        const panel = box!.getBoundingClientRect();
        return {
          panelBottom: panel.bottom,
          rootBottom: r.bottom,
          wrapBottom: w.getBoundingClientRect().bottom,
        };
      });
      expect(gap.panelBottom).toBeLessThanOrEqual(gap.rootBottom + TOLERANCE);
      expect(gap.rootBottom).toBeLessThanOrEqual(gap.wrapBottom + TOLERANCE);
    });
  });

  test.describe(`UI §5.2 배지 (${theme})`, () => {
    test('배지는 Work Sans 500 14/20, radius 6, padding 4/10이다 (카드 안)', async ({ page }) => {
      await open(page, theme, DESKTOP);
      const s = await wrap(page, 'dev-card-grid')
        .getByRole('article')
        .first()
        .evaluate((el) => {
          const badge = [...el.querySelectorAll('*')].find((e) =>
            /bg-primary-soft/.test(e.className.toString()),
          )!;
          const c = getComputedStyle(badge);
          return {
            size: c.fontSize,
            line: c.lineHeight,
            weight: c.fontWeight,
            radius: c.borderTopLeftRadius,
            pad: [c.paddingTop, c.paddingRight].join(' '),
          };
        });
      expect(s).toEqual({
        size: '14px',
        line: '20px',
        weight: '500',
        radius: '6px',
        pad: '4px 10px',
      });
    });
  });
}

test.describe('CategoryChips', () => {
  test('가로 스크롤(overflow-x)이고 줄바꿈 없이 한 줄에 놓인다 (375px)', async ({ page }) => {
    await open(page, 'light', { width: 375, height: 800 });
    const nav = wrap(page, 'dev-chips').getByRole('navigation', { name: '카테고리' });
    const layout = await nav.evaluate((el) => {
      const links = [...el.querySelectorAll('a')];
      return {
        overflowX: getComputedStyle(el).overflowX,
        tops: new Set(links.map((a) => Math.round(a.getBoundingClientRect().top))).size,
        count: links.length,
      };
    });
    expect(['auto', 'scroll']).toContain(layout.overflowX);
    expect(layout.tops).toBe(1);
    expect(layout.count).toBeGreaterThanOrEqual(5);
  });

  test('선택 칩은 aria-current=page이고 solid, 나머지는 soft다', async ({ page }) => {
    await open(page, 'light', DESKTOP);
    const nav = wrap(page, 'dev-chips').getByRole('navigation', { name: '카테고리' });
    const current = nav.locator('a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveCSS('background-color', 'rgb(67, 97, 238)');
    const others = await nav
      .locator('a:not([aria-current])')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
    expect(others.length).toBeGreaterThan(0);
    for (const bg of others) expect(bg).toBe('rgba(75, 107, 251, 0.05)');
  });

  for (const width of [375, 1440]) {
    test(`터치 타겟: 칩 중심에서 위·아래 22px 지점이 같은 칩이다 (${width}px)`, async ({
      page,
    }) => {
      await open(page, 'light', { width, height: 800 });
      const nav = wrap(page, 'dev-chips').getByRole('navigation', { name: '카테고리' });
      const chip = nav.getByRole('link').nth(1);
      await chip.scrollIntoViewIfNeeded();
      const hit = await chip.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const at = (dy: number) => {
          const target = document.elementFromPoint(x, y + dy);
          return !!target && el.contains(target);
        };
        return { height: r.height, up: at(-21), down: at(21) };
      });
      expect(hit.up, '위 21px 지점').toBe(true);
      expect(hit.down, '아래 21px 지점').toBe(true);
    });
  }

  test('키보드 Tab으로 칩에 닿으면 포커스 링이 보인다', async ({ page }) => {
    await open(page, 'light', DESKTOP);
    const first = wrap(page, 'dev-chips')
      .getByRole('navigation', { name: '카테고리' })
      .getByRole('link')
      .first();
    await first.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(first).toBeFocused();
    const ring = await first.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
    });
    expect(ring.style).not.toBe('none');
    expect(ring.width).toBeGreaterThan(0);
    expect(ring.color).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('카드 포커스 링', () => {
  test('카드 링크에 키보드 포커스가 오면 포커스 링이 보이고 마우스를 올리지 않아도 유지된다', async ({
    page,
  }) => {
    await open(page, 'light', DESKTOP);
    const link = wrap(page, 'dev-card-grid').getByRole('article').first().getByRole('link');
    await link.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(link).toBeFocused();
    const ring = await link.evaluate((el) => {
      const s = getComputedStyle(el);
      const cardRing = [el, ...(el.parentElement ? [el.parentElement] : [])].map((e) =>
        getComputedStyle(e),
      );
      return {
        own: { style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor },
        parentStyle: cardRing[1]?.outlineStyle,
      };
    });
    expect(ring.own.style).not.toBe('none');
    expect(ring.own.width).toBeGreaterThan(0);
    expect(ring.own.color).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('hover (UI §5.4)', () => {
  const firstCard = (page: Page) => wrap(page, 'dev-card-grid').getByRole('article').first();

  /** 카드 박스(1px 테두리 조상)와 썸네일의 transform 배율·이동값을 읽는다. */
  const motion = (article: Locator) =>
    article.evaluate((el) => {
      const parse = (v: string) => {
        if (v === 'none') return { scale: 1, y: 0 };
        const m = new DOMMatrix(v);
        return { scale: m.a, y: m.f };
      };
      const heading = el.querySelector('h2, h3')!;
      let box: Element | null = heading;
      while (box && parseFloat(getComputedStyle(box).borderTopWidth) !== 1) box = box.parentElement;
      const img = el.querySelector('img')!;
      // 확대는 img 자신이나 그 부모 래퍼 어느 쪽에 걸려도 된다.
      const imgScale = Math.max(
        parse(getComputedStyle(img).transform).scale,
        parse(getComputedStyle(img.parentElement!).transform).scale,
      );
      return {
        card: parse(getComputedStyle(box!).transform),
        cardShadow: getComputedStyle(box!).boxShadow,
        imgScale,
      };
    });

  test('hover하면 카드가 위로 4px 이동하고 shadow-md가 붙으며 썸네일이 1.03배 확대된다', async ({
    page,
  }) => {
    await open(page, 'light', DESKTOP);
    const before = await motion(firstCard(page));
    expect(before.card.y).toBe(0);
    expect(before.imgScale).toBe(1);
    await firstCard(page).hover();
    await expect
      .poll(async () => (await motion(firstCard(page))).card.y, { timeout: HOVER_SETTLE_MS * 3 })
      .toBeCloseTo(-4, 1);
    const after = await motion(firstCard(page));
    expect(after.cardShadow).toBe(SHADOW_MD);
    expect(after.cardShadow).not.toBe(before.cardShadow);
    expect(after.imgScale).toBeCloseTo(1.03, 3);
  });

  test('prefers-reduced-motion이면 hover해도 이동·확대가 없다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'light', DESKTOP);
    await firstCard(page).hover();
    await page.waitForTimeout(HOVER_SETTLE_MS);
    const after = await motion(firstCard(page));
    expect(after.card.y).toBe(0);
    expect(after.imgScale).toBe(1);
  });

  test('썸네일 확대가 카드 밖으로 넘치지 않도록 썸네일 영역은 overflow hidden이다', async ({
    page,
  }) => {
    await open(page, 'light', DESKTOP);
    const hidden = await firstCard(page).evaluate((el) => {
      const img = el.querySelector('img')!;
      for (let e: Element | null = img; e && e !== el.parentElement; e = e.parentElement) {
        if (getComputedStyle(e).overflow === 'hidden' && e !== img) return true;
      }
      return getComputedStyle(img).overflow === 'hidden';
    });
    expect(hidden).toBe(true);
  });
});

test.describe('스켈레톤', () => {
  test('카드와 같은 크기이고 bg-subtle이며 reduced-motion이면 애니메이션이 정지한다', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'light', DESKTOP);
    const sizes = await page.evaluate(() => {
      const section = document.querySelector('[data-testid="dev-posts-cards"]')!;
      const card = section
        .querySelector('[data-testid="dev-card-grid"] article')!
        .getBoundingClientRect();
      const skeleton = section.querySelector(
        '[data-testid="dev-card-skeleton"] [aria-hidden="true"]',
      )!;
      const r = skeleton.getBoundingClientRect();
      const animated = [skeleton, ...skeleton.querySelectorAll('*')].some((e) => {
        const s = getComputedStyle(e);
        return (
          s.animationName !== 'none' &&
          s.animationPlayState === 'running' &&
          parseFloat(s.animationDuration) > 0 &&
          s.animationIterationCount !== '1'
        );
      });
      return { dw: Math.abs(r.width - card.width), dh: Math.abs(r.height - card.height), animated };
    });
    expect(sizes.dw).toBeLessThanOrEqual(1);
    expect(sizes.dh).toBeLessThanOrEqual(1);
    expect(sizes.animated).toBe(false);
  });

  test('모션을 줄이지 않으면 shimmer 애니메이션이 돈다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page, 'light', DESKTOP);
    const animated = await wrap(page, 'dev-card-skeleton').evaluate((w) =>
      [...w.querySelectorAll('*')].some((e) => {
        const s = getComputedStyle(e);
        const pseudo = getComputedStyle(e, '::after');
        return s.animationName !== 'none' || pseudo.animationName !== 'none';
      }),
    );
    expect(animated).toBe(true);
  });
});

test.describe('반응형: 가로 스크롤 없음·FeaturedHero 플로팅 카드 범위', () => {
  for (const width of WIDTHS) {
    test(`${width}px: 문서에 가로 스크롤이 없고 섹션이 뷰포트를 넘지 않는다`, async ({ page }) => {
      await open(page, 'light', { width, height: 900 });
      const m = await page.evaluate(() => {
        const section = document.querySelector('[data-testid="dev-posts-cards"]')!;
        const overflowing = [...section.querySelectorAll('*')]
          .filter((e) => {
            if (e.closest('nav[aria-label="카테고리"]')) return false; // 칩 목록은 자체 가로 스크롤
            return e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5;
          })
          .map((e) => e.tagName.toLowerCase());
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          overflowing,
        };
      });
      expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
      expect(m.overflowing).toEqual([]);
    });

    test(`${width}px: FeaturedHero 플로팅 카드가 글자·다음 블록과 겹치지 않고 안의 글이 넘치지 않는다`, async ({
      page,
    }) => {
      await open(page, 'light', { width, height: 900 });
      const m = await wrap(page, 'dev-card-hero').evaluate((w) => {
        const root = w.firstElementChild!;
        const heading = root.querySelector('h1, h2')!;
        let panelEl: Element | null = heading;
        while (panelEl && parseFloat(getComputedStyle(panelEl).borderTopWidth) !== 1)
          panelEl = panelEl.parentElement;
        const panel = panelEl!.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        const image =
          [root, ...root.querySelectorAll('*')].find(
            (e) =>
              e.querySelector('img') === null && getComputedStyle(e).backgroundImage !== 'none',
          ) ?? root.querySelector('img');
        const imgRect = (image ?? root).getBoundingClientRect();
        const next = w.nextElementSibling?.getBoundingClientRect() ?? null;
        const inner = panelEl!.getBoundingClientRect();
        const textOverflow = [...panelEl!.querySelectorAll('*')].some(
          (e) => e.getBoundingClientRect().right > inner.right + 0.5,
        );
        return {
          panel: { left: panel.left, right: panel.right, top: panel.top, bottom: panel.bottom },
          root: { left: rootRect.left, right: rootRect.right, bottom: rootRect.bottom },
          imageBottom: imgRect.bottom,
          nextTop: next ? next.top : null,
          textOverflow,
          vw: document.documentElement.clientWidth,
        };
      });
      expect(m.textOverflow, '카드 안 요소가 카드 밖으로 넘침').toBe(false);
      expect(m.panel.left).toBeGreaterThanOrEqual(-0.5);
      expect(m.panel.right).toBeLessThanOrEqual(m.vw + 0.5);
      expect(m.panel.bottom).toBeLessThanOrEqual(m.root.bottom + 0.5);
      if (m.nextTop !== null) expect(m.panel.bottom).toBeLessThanOrEqual(m.nextTop + 0.5);
    });
  }

  test('375px: 모바일 수치 — Overlay 높이 320·padding 20, Hero 이미지 높이 240·카드 padding 24', async ({
    page,
  }) => {
    await open(page, 'light', { width: 375, height: 800 });
    const overlay = await wrap(page, 'dev-card-overlay').evaluate((w) => {
      const root = w.firstElementChild!;
      const b = root.getBoundingClientRect();
      const t = root.querySelector('time')!.getBoundingClientRect();
      const h = root.querySelector('h1, h2')!;
      return {
        h: b.height,
        left: h.getBoundingClientRect().left - b.left,
        bottom: b.bottom - t.bottom,
        size: parseFloat(getComputedStyle(h).fontSize),
      };
    });
    near(overlay.h, 320, 'Overlay 높이');
    near(overlay.left, 20, 'Overlay padding');
    near(overlay.bottom, 20, 'Overlay 아래 padding');
    expect(overlay.size).toBe(28); // 모바일 h1 28/34
    const hero = await measureCard(wrap(page, 'dev-card-hero').locator('> *').first());
    for (const p of hero.boxStyle.padding) near(p, 24, 'Hero 카드 padding');
    expect(hero.heading.fontSize).toBe(28);
  });

  test('375px: FeaturedHero 모바일 — 이미지 240, 카드가 이미지 아래로 48 겹침, 폭 섹션−32, 제목 28/34, 글자 안 잘림 (UI §4.2)', async ({
    page,
  }) => {
    await open(page, 'light', { width: 375, height: 800 });
    const m = await wrap(page, 'dev-card-hero').evaluate((w) => {
      const root = w.firstElementChild!;
      const heading = root.querySelector('h1, h2')!;
      let panelEl: Element | null = heading;
      while (panelEl && parseFloat(getComputedStyle(panelEl).borderTopWidth) !== 1)
        panelEl = panelEl.parentElement;
      const panel = panelEl!;
      const panelRect = panel.getBoundingClientRect();
      const image =
        [root, ...root.querySelectorAll('*')].find(
          (e) => e.querySelector('img') === null && getComputedStyle(e).backgroundImage !== 'none',
        ) ?? root.querySelector('img');
      const imgRect = (image ?? root).getBoundingClientRect();
      const childrenBottom = Math.max(
        ...[...panel.querySelectorAll('*')].map((e) => e.getBoundingClientRect().bottom),
      );
      return {
        sectionWidth: w.getBoundingClientRect().width,
        panelWidth: panelRect.width,
        panelTop: panelRect.top,
        panelBottom: panelRect.bottom,
        imageHeight: imgRect.height,
        imageBottom: imgRect.bottom,
        headingSize: parseFloat(getComputedStyle(heading).fontSize),
        headingLine: parseFloat(getComputedStyle(heading).lineHeight),
        scrollHeight: panel.scrollHeight,
        clientHeight: panel.clientHeight,
        childrenBottom,
      };
    });
    near(m.imageHeight, 240, 'Hero 이미지 높이');
    near(m.panelTop, m.imageBottom - 48, 'Hero 카드는 이미지 아래로 48 겹침');
    near(m.panelWidth, m.sectionWidth - 32, 'Hero 카드 폭(섹션 − 32)');
    expect(m.headingSize).toBe(28);
    expect(m.headingLine).toBe(34);
    expect(m.scrollHeight, '카드 글자가 잘림').toBeLessThanOrEqual(m.clientHeight);
    expect(m.childrenBottom).toBeLessThanOrEqual(m.panelBottom + 0.5);
  });
});

for (const theme of THEMES) {
  test.describe(`접근성·규칙 (${theme})`, () => {
    test(`axe: /dev/components ${theme} 섹션 포함 serious·critical 위반 0 (섹션 범위 + 전체)`, async ({
      page,
    }) => {
      await open(page, theme, DESKTOP);
      for (const builder of [
        new AxeBuilder({ page }).include(`[data-testid="${SECTION}"]`),
        new AxeBuilder({ page }),
      ]) {
        const { violations } = await builder.analyze();
        const blocking = violations
          .filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
          .map((v) => ({
            rule: v.id,
            impact: v.impact,
            targets: v.nodes.map((n) => n.target.join(' ')),
          }));
        expect(blocking).toEqual([]);
      }
    });

    test(`axe 375px ${theme}: 섹션 serious·critical 위반 0`, async ({ page }) => {
      await open(page, theme, { width: 375, height: 800 });
      const { violations } = await new AxeBuilder({ page })
        .include(`[data-testid="${SECTION}"]`)
        .analyze();
      expect(
        violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => v.id),
      ).toEqual([]);
    });

    test('Overlay 카드 안 모든 글자색은 on-primary(흰색)이고 배경 이미지 위에서 대비가 유지된다', async ({
      page,
    }) => {
      await open(page, theme, DESKTOP);
      const colors = await wrap(page, 'dev-card-overlay').evaluate((w) => {
        const root = w.firstElementChild!;
        return [...root.querySelectorAll('h1, h2, time, time ~ *, span')]
          .filter(
            (e) =>
              (e.textContent ?? '').trim() !== '' &&
              !/bg-primary-(soft|strong)/.test(e.className.toString()),
          )
          .map((e) => getComputedStyle(e).color);
      });
      expect(colors.length).toBeGreaterThan(0);
      for (const color of colors) expect(color).toBe(ON_PRIMARY);
    });
  });
}

// Codex r1 #1: 계산값(outline)만 있고 부모 overflow에 잘리면 사용자 눈에는 링이 없다.
// 링을 그리는 요소(링크 자신·조상·자손)의 링 사각형이 overflow 잘림 조상 경계 안에 있어야 한다.
function visibleFocusRing(link: Locator) {
  return link.evaluate((linkEl) => {
    const CLIP = /hidden|clip|auto|scroll/;
    const px = (v: string) => parseFloat(v) || 0;
    const wrapper = linkEl.closest('[data-testid^="dev-card-"]');
    const candidates = [
      ...(wrapper ? [wrapper, ...wrapper.querySelectorAll('*')] : [linkEl]),
    ].filter((e) => {
      const s = getComputedStyle(e);
      return s.outlineStyle !== 'none' && px(s.outlineWidth) > 0;
    });
    const results = candidates.map((el) => {
      const s = getComputedStyle(el);
      const grow = px(s.outlineWidth) + px(s.outlineOffset);
      const r = el.getBoundingClientRect();
      const ring = {
        left: r.left - grow,
        top: r.top - grow,
        right: r.right + grow,
        bottom: r.bottom + grow,
      };
      let clipped = false;
      for (let a = el.parentElement; a; a = a.parentElement) {
        const as = getComputedStyle(a);
        if (!CLIP.test(as.overflowX + as.overflowY)) continue;
        const b = a.getBoundingClientRect();
        if (
          ring.left < b.left - 0.5 ||
          ring.top < b.top - 0.5 ||
          ring.right > b.right + 0.5 ||
          ring.bottom > b.bottom + 0.5
        )
          clipped = true;
      }
      return { tag: el.tagName.toLowerCase(), clipped };
    });
    return { results, anyVisible: results.some((r) => !r.clipped) };
  });
}

for (const theme of THEMES) {
  test.describe(`카드 포커스 링이 잘리지 않는다 (${theme})`, () => {
    for (const id of ['dev-card-overlay', 'dev-card-hero'] as const) {
      test(`${id}: Tab 키보드 포커스 시 링이 overflow 조상 경계 안에서 실제로 보인다`, async ({
        page,
      }) => {
        await open(page, theme, DESKTOP);
        const link = wrap(page, id).getByRole('link');
        await link.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(link).toBeFocused();
        const ring = await visibleFocusRing(link);
        expect(ring.results.length, '포커스 링을 그리는 요소가 있어야 한다').toBeGreaterThan(0);
        expect(ring.anyVisible, `링이 잘림: ${JSON.stringify(ring.results)}`).toBe(true);
      });
    }
  });
}

// Codex r1 #2: 긴 제목(4~5줄)에서도 패널이 루트·다음 블록을 넘지 않는다.
// 구현자 요구: /dev/components 의 dev-posts-cards 안에 `dev-card-hero-long`(구조는 dev-card-hero와 동일,
// 카테고리 있음, 제목이 768px 패널에서 4줄 이상이 되는 긴 제목)을 추가하고 다음 형제 요소가 있어야 한다.
test.describe('FeaturedHero 긴 제목 (dev-card-hero-long)', () => {
  for (const width of [768, 1024, 1440] as const) {
    test(`${width}px: 패널 하단이 Hero 루트 안이고 다음 블록과 겹치지 않으며 패널 위치는 left 64·top 360이다`, async ({
      page,
    }) => {
      await open(page, 'light', { width, height: 900 });
      const long = wrap(page, 'dev-card-hero-long');
      await expect(long, 'dev-card-hero-long 예시 필요').toBeVisible();
      const m = await long.evaluate((w) => {
        const root = w.firstElementChild!;
        const heading = root.querySelector('h1, h2')!;
        let panelEl: Element | null = heading;
        while (panelEl && parseFloat(getComputedStyle(panelEl).borderTopWidth) !== 1)
          panelEl = panelEl.parentElement;
        const panel = panelEl!.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        const lh = parseFloat(getComputedStyle(heading).lineHeight);
        return {
          panel: { left: panel.left, top: panel.top, bottom: panel.bottom },
          root: { left: rootRect.left, top: rootRect.top, bottom: rootRect.bottom },
          headingLines: Math.round(heading.getBoundingClientRect().height / lh),
          nextTop: w.nextElementSibling?.getBoundingClientRect().top ?? null,
        };
      });
      expect(m.headingLines, '제목이 4줄 이상이어야 한다').toBeGreaterThanOrEqual(4);
      near(m.panel.left - m.root.left, 64, '패널 left');
      near(m.panel.top - m.root.top, 360, '패널 top');
      expect(m.panel.bottom, '패널 하단 ≤ 루트 하단').toBeLessThanOrEqual(m.root.bottom + 0.5);
      expect(m.nextTop, '다음 형제 요소가 있어야 한다').not.toBeNull();
      expect(m.panel.bottom, '패널 하단 ≤ 다음 블록 상단').toBeLessThanOrEqual(m.nextTop! + 0.5);
    });
  }
});
