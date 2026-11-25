import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { pinTheme, THEMES, waitForFonts, type Theme } from '../helpers/theme';

// M2-05 ① 필수 검증: /dev/markdown(본문 렌더 미리보기). 지시서 "동작 규약 4·6·7·8", UI 기획서 §7.3·§9.
// 수치는 UI §7.3 표 그대로이며 원본 1440px 프레임에서 계산값(getComputedStyle)으로 비교한다.
//
// 미리보기 예시 본문에 필요한 요소(구현자가 /dev/markdown 예시에 담아야 하는 것, 규약 8 "문법을 모두 담은 예시"):
//   h2·h3, 문단 2개 이상 연속, 일반 인용문(blockquote), 콜아웃 5종, 표, 목록, 인라인 코드, 내부·외부 링크,
//   캡션 있는 이미지(figure), 제목(title="…") 있는 코드 블록 1개와 언어만 있는 코드 블록 1개.
// 코드 블록의 border·radius·padding·배경은 `pre` 요소 자체의 계산값으로 비교한다(해석: 테스트 관점의 "코드 블록" = pre).

const PATH = '/dev/markdown';
const FRAME = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 800 };
const TOLERANCE = 0.5;

// 토큰 값은 globals.css(UI §3.3) 계산값 표기다. rule-compliance 검사가 토큰 밖 색을 따로 막으므로 여기서는 기대 용도 매핑만 본다.
const COLORS = {
  light: {
    body: 'rgb(59, 60, 74)',
    strong: 'rgb(24, 26, 42)',
    muted: 'rgb(105, 106, 117)',
    border: 'rgb(232, 232, 234)',
    subtle: 'rgb(246, 246, 247)',
    codeBg: 'rgb(246, 246, 247)',
    primaryText: 'rgb(67, 97, 238)',
    danger: 'rgb(200, 30, 30)',
  },
  dark: {
    body: 'rgb(186, 186, 191)',
    strong: 'rgb(255, 255, 255)',
    muted: 'rgb(151, 152, 159)',
    border: 'rgb(36, 37, 53)',
    subtle: 'rgb(36, 37, 53)',
    codeBg: 'rgb(20, 22, 36)',
    primaryText: 'rgb(123, 147, 255)',
    danger: 'rgb(248, 113, 113)',
  },
} as const;
const PRIMARY = 'rgb(75, 107, 251)';
const PRIMARY_SOFT = 'rgba(75, 107, 251, 0.05)';

// 지시서 "문법 확정": 콜아웃 종류 → 한국어 이름, 강조선 색 구분(규약 6)
const CALLOUTS = [
  { name: '참고', accent: 'primary' },
  { name: '팁', accent: 'primary' },
  { name: '중요', accent: 'primary' },
  { name: '주의', accent: 'danger' },
  { name: '경고', accent: 'danger' },
] as const;

const preview = (page: Page) => page.getByTestId('markdown-preview');
const style = (target: Locator, property: string) =>
  target.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property);

async function open(page: Page, theme: Theme, size = FRAME) {
  await pinTheme(page, theme);
  await page.setViewportSize(size);
  await page.goto(PATH);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  // 404 페이지에서 "요소가 없음"·axe 0건이 우연히 통과하지 않게, 미리보기가 실제로 떠 있어야 한다.
  await expect(preview(page)).toBeVisible();
  await waitForFonts(page);
}

test.describe('미리보기 페이지 (규약 8)', () => {
  test('본문 래퍼 markdown-preview가 .prose-jblog 클래스를 가진다', async ({ page }) => {
    await open(page, 'light');
    await expect(preview(page)).toBeVisible();
    await expect(preview(page)).toHaveClass(/prose-jblog/);
  });

  test('noindex 메타를 가진다', async ({ page }) => {
    await open(page, 'light');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('예시에 콜아웃 5종이 역할(note)과 한국어 이름으로 모두 있다', async ({ page }) => {
    await open(page, 'light');
    for (const { name } of CALLOUTS) {
      await expect(preview(page).getByRole('note', { name }), name).toHaveCount(1);
    }
  });

  test('예시에 담긴 XSS 시도 문자열은 실행되지 않고 위험 요소도 없다', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    await open(page, 'light');
    const dangerous = await preview(page)
      .locator('script, iframe, style, [onerror], [onclick], [onload]')
      .count();
    expect(dangerous).toBe(0);
    expect(dialogs).toEqual([]);
    expect(await page.evaluate(() => 'hacked' in window)).toBe(false);
  });
});

for (const theme of THEMES) {
  const color = COLORS[theme];

  test.describe(`.prose-jblog 계산값 (규약 6, UI §7.3) — ${theme} 1440px`, () => {
    test.beforeEach(async ({ page }) => open(page, theme));

    test('본문 p: Source Serif 20/32, text-body, 문단 간격 32', async ({ page }) => {
      const first = preview(page).locator(':scope > p').first();
      expect(await style(first, 'font-size')).toBe('20px');
      expect(await style(first, 'line-height')).toBe('32px');
      expect(await style(first, 'color')).toBe(color.body);
      expect(await style(first, 'font-family')).toContain('Source Serif');

      const pair = preview(page).locator(':scope > p + p').first();
      const previous = preview(page).locator(':scope > p:has(+ p)').first();
      const gap = await pair.evaluate((el) => el.getBoundingClientRect().top);
      const above = await previous.evaluate((el) => el.getBoundingClientRect().bottom);
      expect(Math.abs(gap - above - 32), `문단 간격 ${gap - above}`).toBeLessThanOrEqual(TOLERANCE);
    });

    test('h2: Work Sans 600 24/28 text-strong, 아래 본문과 간격 16', async ({ page }) => {
      const h2 = preview(page).locator(':scope > h2').first();
      expect(await style(h2, 'font-size')).toBe('24px');
      expect(await style(h2, 'line-height')).toBe('28px');
      expect(await style(h2, 'font-weight')).toBe('600');
      expect(await style(h2, 'color')).toBe(color.strong);
      expect(await style(h2, 'font-family')).toContain('Work Sans');

      const gap = await h2.evaluate((el) => {
        const next = el.nextElementSibling;
        if (!next) return Number.NaN;
        return next.getBoundingClientRect().top - el.getBoundingClientRect().bottom;
      });
      expect(Math.abs(gap - 16), `h2 아래 간격 ${gap}`).toBeLessThanOrEqual(TOLERANCE);
    });

    test('h3: Work Sans 600 20/24', async ({ page }) => {
      const h3 = preview(page).locator(':scope > h3').first();
      expect(await style(h3, 'font-size')).toBe('20px');
      expect(await style(h3, 'line-height')).toBe('24px');
      expect(await style(h3, 'font-weight')).toBe('600');
      expect(await style(h3, 'font-family')).toContain('Work Sans');
    });

    test('Quote: bg-subtle, 왼쪽 4px border, padding 32, radius 12, Source Serif 24/32 text-strong', async ({
      page,
    }) => {
      // 콜아웃(aside)이 아닌 일반 인용문
      const quote = preview(page).locator('blockquote').first();
      expect(await style(quote, 'background-color')).toBe(color.subtle);
      expect(await style(quote, 'border-left-width')).toBe('4px');
      expect(await style(quote, 'border-left-color')).toBe(color.border);
      for (const side of ['top', 'right', 'bottom', 'left']) {
        expect(await style(quote, `padding-${side}`), `padding-${side}`).toBe('32px');
      }
      expect(await style(quote, 'border-top-left-radius')).toBe('12px');
      expect(await style(quote, 'font-size')).toBe('24px');
      expect(await style(quote, 'line-height')).toBe('32px');
      expect(await style(quote, 'color')).toBe(color.strong);
      expect(await style(quote, 'font-family')).toContain('Source Serif');
    });

    test('Quote의 한글은 기울이지 않는다 (font-style normal 또는 합성 기울임 금지)', async ({
      page,
    }) => {
      // 해석: Noto Serif KR에는 이탤릭이 없어 브라우저가 가짜 기울임을 만든다. 그 합성을 막았는지를
      // font-style: normal 이거나 font-synthesis-style: none 중 하나로 확인한다(구현 방식은 구현자 판단).
      const quote = preview(page).locator('blockquote').first();
      const fontStyle = await style(quote, 'font-style');
      const synthesis = await style(quote, 'font-synthesis-style');
      expect(fontStyle === 'normal' || synthesis === 'none', `${fontStyle} / ${synthesis}`).toBe(
        true,
      );
    });

    test('본문 이미지: 폭 100%, radius 12, 지연 로딩, 캡션 14/20 text-muted 가운데', async ({
      page,
    }) => {
      const figure = preview(page).locator('figure').first();
      const image = figure.locator('img');
      const caption = figure.locator('figcaption');
      await expect(caption).toBeVisible();

      expect(await style(image, 'border-top-left-radius')).toBe('12px');
      await expect(image).toHaveAttribute('loading', 'lazy');
      const widths = await page.evaluate(() => {
        const fig = document.querySelector('[data-testid="markdown-preview"] figure');
        const img = fig?.querySelector('img');
        return {
          figure: fig?.getBoundingClientRect().width,
          image: img?.getBoundingClientRect().width,
        };
      });
      expect(Math.abs((widths.image ?? 0) - (widths.figure ?? -1))).toBeLessThanOrEqual(TOLERANCE);

      expect(await style(caption, 'font-size')).toBe('14px');
      expect(await style(caption, 'line-height')).toBe('20px');
      expect(await style(caption, 'color')).toBe(color.muted);
      expect(await style(caption, 'text-align')).toBe('center');
    });

    test('인라인 코드: primary-soft 배경, primary-text, padding 2/6, radius 4', async ({
      page,
    }) => {
      const code = preview(page).locator(':not(pre) > code').first();
      expect(await style(code, 'background-color')).toBe(PRIMARY_SOFT);
      expect(await style(code, 'color')).toBe(color.primaryText);
      expect(await style(code, 'padding-top')).toBe('2px');
      expect(await style(code, 'padding-bottom')).toBe('2px');
      expect(await style(code, 'padding-left')).toBe('6px');
      expect(await style(code, 'padding-right')).toBe('6px');
      expect(await style(code, 'border-top-left-radius')).toBe('4px');
      expect(await style(code, 'font-family')).toContain('JetBrains Mono');
    });

    test('링크: primary-text, 밑줄, underline offset 3px', async ({ page }) => {
      const link = preview(page).locator('p a').first();
      expect(await style(link, 'color')).toBe(color.primaryText);
      expect(await style(link, 'text-decoration-line')).toContain('underline');
      expect(await style(link, 'text-underline-offset')).toBe('3px');
    });

    test('외부 링크는 새 탭·noopener, 내부 링크는 target 없음 (렌더 결과)', async ({ page }) => {
      const external = preview(page).locator('a[href^="http"]:not([href*="localhost"])').first();
      await expect(external).toHaveAttribute('target', '_blank');
      expect((await external.getAttribute('rel')) ?? '').toContain('noopener');
      const internal = preview(page).locator('a[href^="/"]').first();
      await expect(internal).not.toHaveAttribute('target', /.+/);
    });

    for (const { name, accent } of CALLOUTS) {
      test(`콜아웃 ${name}: bg-subtle, 왼쪽 4px ${accent} 강조선, 제목 text-strong 600`, async ({
        page,
      }) => {
        const callout = preview(page).getByRole('note', { name });
        expect(await style(callout, 'background-color')).toBe(color.subtle);
        expect(await style(callout, 'border-left-width')).toBe('4px');
        expect(await style(callout, 'border-left-color')).toBe(
          accent === 'primary' ? PRIMARY : color.danger,
        );
        // 해석: 콜아웃의 보이는 제목 글자는 한국어 종류 이름과 같다.
        const title = callout.getByText(name, { exact: true }).first();
        expect(await style(title, 'font-weight')).toBe('600');
        expect(await style(title, 'color')).toBe(color.strong);
      });
    }

    test('코드 블록: code-bg 배경, 1px border, radius 12, padding 20/24, JetBrains Mono 14/22', async ({
      page,
    }) => {
      const block = preview(page).locator('pre').first();
      expect(await style(block, 'background-color')).toBe(color.codeBg);
      expect(await style(block, 'border-top-width')).toBe('1px');
      expect(await style(block, 'border-top-color')).toBe(color.border);
      expect(await style(block, 'border-top-left-radius')).toBe('12px');
      expect(await style(block, 'padding-top')).toBe('20px');
      expect(await style(block, 'padding-bottom')).toBe('20px');
      expect(await style(block, 'padding-left')).toBe('24px');
      expect(await style(block, 'padding-right')).toBe('24px');
      const code = block.locator('code').first();
      expect(await style(code, 'font-size')).toBe('14px');
      expect(await style(code, 'line-height')).toBe('22px');
      expect(await style(code, 'font-family')).toContain('JetBrains Mono');
    });

    test('코드 제목(title) 줄은 해당 블록 위에 있고, 메타 없는 블록에는 없다', async ({ page }) => {
      const titled = preview(page).getByText('example.ts', { exact: true });
      await expect(titled).toHaveCount(1);
      const titleBottom = await titled.evaluate((el) => el.getBoundingClientRect().bottom);
      const blockTop = await titled
        .locator('xpath=following::pre[1]')
        .evaluate((el) => el.getBoundingClientRect().top);
      expect(titleBottom).toBeLessThanOrEqual(blockTop + TOLERANCE);
    });

    test('코드 블록마다 "코드 복사" 버튼이 있고 블록 우측 상단에 놓인다', async ({ page }) => {
      const blocks = preview(page).locator('pre');
      const buttons = preview(page).getByRole('button', { name: '코드 복사' });
      expect(await buttons.count()).toBe(await blocks.count());
      const box = await blocks.first().boundingBox();
      const buttonBox = await buttons.first().boundingBox();
      expect(box && buttonBox).toBeTruthy();
      // 블록의 오른쪽 절반·위쪽 절반에 있다(정확한 오프셋은 구현자 판단).
      expect(buttonBox!.x + buttonBox!.width / 2).toBeGreaterThan(box!.x + box!.width / 2);
      expect(buttonBox!.y + buttonBox!.height / 2).toBeLessThan(box!.y + box!.height / 2);
    });

    test('shiki: 언어 하이라이트로 토큰 색이 2종 이상이다', async ({ page }) => {
      const colors = await preview(page)
        .locator('pre code span')
        .evaluateAll((spans) => new Set(spans.map((s) => getComputedStyle(s).color)).size);
      expect(colors).toBeGreaterThan(1);
    });
  });
}

test.describe('shiki 테마 전환 (규약 4)', () => {
  test('테마 토글 시 새로고침 없이 코드 토큰 색과 블록 배경이 바뀐다', async ({ page }) => {
    await open(page, 'light');
    await page.evaluate(() => {
      (window as unknown as { __noReload: boolean }).__noReload = true;
    });
    const tokenColors = () =>
      preview(page)
        .locator('pre code span')
        .evaluateAll((spans) => spans.map((s) => getComputedStyle(s).color));
    const blockBg = () => style(preview(page).locator('pre').first(), 'background-color');

    const light = await tokenColors();
    expect(await blockBg()).toBe(COLORS.light.codeBg);

    await page.getByRole('switch', { name: '다크 모드' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await expect.poll(blockBg).toBe(COLORS.dark.codeBg);
    const dark = await tokenColors();
    expect(dark.length).toBe(light.length);
    expect(dark, '토큰 색이 Light와 같으면 Dark 테마가 적용되지 않은 것이다').not.toEqual(light);
    // 새로고침이 없었다
    expect(
      await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload),
    ).toBe(true);
  });
});

test.describe('코드 블록 가로 스크롤은 블록 안에서만 (규약 4)', () => {
  test('긴 코드 줄이 있어도 페이지는 가로로 넘치지 않고 pre만 스크롤된다 (375px)', async ({
    page,
  }) => {
    await open(page, 'light', MOBILE);
    // 결정적인 검증을 위해 첫 코드 블록에 매우 긴 한 줄을 붙인다(레이아웃 검사 전용 주입).
    await preview(page)
      .locator('pre code')
      .first()
      .evaluate((code) => {
        const longLine = document.createElement('span');
        longLine.textContent = `\n${'x'.repeat(400)}`;
        code.appendChild(longLine);
      });

    const result = await page.evaluate(() => {
      const pre = document.querySelector('[data-testid="markdown-preview"] pre') as HTMLElement;
      return {
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        preScrolls: pre.scrollWidth > pre.clientWidth,
        overflowX: getComputedStyle(pre).overflowX,
      };
    });
    expect(result.pageOverflow).toBeLessThanOrEqual(0);
    expect(result.preScrolls).toBe(true);
    expect(['auto', 'scroll']).toContain(result.overflowX);
  });
});

test.describe('Noto Serif KR는 글 상세 계열에서만 로드된다 (규약 7, 프론트 §5.1-a)', () => {
  // 판단: 폰트 파일 이름은 next/font가 해시로 바꾸므로 요청 URL로는 구분할 수 없다. 대신 브라우저의
  // document.fonts(FontFaceSet)를 본다. next/font는 family를 `__Noto_Serif_KR_<해시>`로 선언한다.
  // - /dev/markdown: 한글 본문이 그려졌으므로 해당 FontFace가 loaded 상태여야 한다.
  // - /: 루트 layout에 넣지 않았다면 FontFace 선언 자체가 없어야 한다(선언만 있고 미사용인 경우도 허용하지 않는다).
  const notoFaces = (page: Page) =>
    page.evaluate(() =>
      [...document.fonts]
        .filter((face) => /noto[\s_]*serif[\s_]*kr/i.test(face.family))
        .map((face) => ({ family: face.family, status: face.status })),
    );

  test('/dev/markdown에서는 Noto Serif KR이 로드된다', async ({ page }) => {
    await open(page, 'light');
    await expect
      .poll(async () => (await notoFaces(page)).some((f) => f.status === 'loaded'))
      .toBe(true);
  });

  test('/dev/markdown 본문 글꼴 목록에 Noto Serif KR이 한글 fallback으로 들어 있다', async ({
    page,
  }) => {
    await open(page, 'light');
    const family = await style(preview(page).locator(':scope > p').first(), 'font-family');
    expect(family).toMatch(/noto[\s_]*serif[\s_]*kr/i);
  });

  test('/에서는 Noto Serif KR이 선언도 로드도 되지 않는다', async ({ page }) => {
    await pinTheme(page, 'light');
    await page.goto('/');
    await waitForFonts(page);
    expect(await notoFaces(page)).toEqual([]);
  });
});

test.describe('접근성 (axe)', () => {
  for (const theme of THEMES) {
    for (const size of [FRAME, MOBILE]) {
      test(`axe: /dev/markdown ${size.width}px ${theme} — serious·critical 위반 0`, async ({
        page,
      }) => {
        await open(page, theme, size);
        const { violations } = await new AxeBuilder({ page }).analyze();
        const blocking = violations
          .filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
          .map((v) => ({
            rule: v.id,
            impact: v.impact,
            targets: v.nodes.map((node) => node.target.join(' ')),
          }));
        expect(blocking).toEqual([]);
      });
    }
  }
});
