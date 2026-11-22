import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { pinTheme, THEMES, waitForFonts, type Theme } from '../helpers/theme';

// M1-05 규약 9 (UI §11 4번 B 기준): 렌더 결과의 색·폰트가 모두 §3 토큰에서 나왔는지 계산값으로 확인한다.
// 허용 목록은 하드코딩하지 않고 globals.css에서 읽는다. 토큰이 바뀌면 허용 목록도 따라간다.
// 허용: 해당 테마 팔레트 · 양 테마 공통 색 · 투명 · 폰트 토큰(글꼴 목록). currentColor는 계산값이 글자색이라 글자색 검사로 덮인다.
// 간격·높이 규칙은 spec-values*.spec.ts가 맡는다.

const GLOBALS_CSS = path.resolve(process.cwd(), 'src/app/globals.css');
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const COLOR_PROPERTIES = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
] as const;
const PSEUDO_ELEMENTS = ['::before', '::after', '::marker', '::placeholder'] as const;
const FOCUS_TAB_PRESSES = 40;
const FRAME = { width: 1440, height: 900 };
const MOBILE_FRAME = { width: 375, height: 800 };

const css = fs.readFileSync(GLOBALS_CSS, 'utf8');

/** `#rrggbb`·`rgba(r, g, b, a)` 토큰 값을 브라우저 계산값 표기(`rgb(r, g, b)`·`rgba(r, g, b, a)`)로 바꾼다. */
function toComputedNotation(value: string): string {
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex?.[1]) {
    const n = parseInt(hex[1], 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  }
  const rgba = value.trim().match(/^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/);
  if (rgba) return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${rgba[4]})`;
  throw new Error(`알 수 없는 색 표기: ${value}`);
}

function literalColorsIn(block: string, namePattern: RegExp): string[] {
  const colors: string[] = [];
  for (const match of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    const name = match[1] ?? '';
    const value = match[2] ?? '';
    if (!namePattern.test(name) || value.includes('var(')) continue;
    colors.push(toComputedNotation(value));
  }
  return colors;
}

function themeBlock(selector: RegExp): string {
  const match = css.match(selector);
  if (!match) throw new Error(`globals.css에서 테마 블록을 찾지 못했다: ${selector}`);
  return match[1] ?? '';
}

/** `@theme { --color-primary: #… }`처럼 양 테마에서 값이 같은 색 (var()를 쓰지 않는 --color-*) */
function commonColors(): string[] {
  return literalColorsIn(css, /^color-/);
}

function paletteOf(theme: Theme): Set<string> {
  const selector =
    theme === 'light'
      ? /:root,\s*\[data-theme='light'\]\s*\{([^}]*)\}/
      : /\[data-theme='dark'\]\s*\{([^}]*)\}/;
  const colors = literalColorsIn(themeBlock(selector), /.*/);
  return new Set([TRANSPARENT, ...colors, ...commonColors()]);
}

/** globals.css의 `--font-*: …;` 목록(폰트 토큰)을 그대로 모은다. 브라우저 계산값과 비교하려고 페이지 안에서 풀어 쓴다. */
function fontTokenDeclarations(): string[] {
  return [...css.matchAll(/--font-(?:sans|serif|jakarta|display|mono):\s*([^;]+);/g)].map((match) =>
    (match[1] ?? '').trim(),
  );
}

interface Finding {
  where: string;
  property: string;
  value: string;
}

async function collectFindings(
  page: Page,
  palette: string[],
  fontDeclarations: string[],
): Promise<Finding[]> {
  return page.evaluate(
    ({ palette, fontDeclarations, colorProps, pseudos }) => {
      const allowedColors = new Set(palette);
      const probe = document.createElement('span');
      document.body.appendChild(probe);
      const allowedFonts = new Set(
        fontDeclarations.map((declaration) => {
          probe.style.fontFamily = declaration;
          return getComputedStyle(probe).fontFamily;
        }),
      );
      probe.remove();

      const describe = (element: Element) => {
        const id = element.id ? `#${element.id}` : '';
        const testId = element.closest('[data-testid]')?.getAttribute('data-testid') ?? '';
        return `${element.tagName.toLowerCase()}${id}.${String(element.getAttribute('class') ?? '')
          .split(/\s+/)
          .slice(0, 4)
          .join('.')} @${testId}`;
      };

      const findings: Finding[] = [];
      const seen = new Set<string>();
      const record = (
        element: Element,
        label: string,
        found: { property: string; value: string },
      ) => {
        const { property, value } = found;
        const key = `${property}|${value}|${label}`;
        if (seen.has(key)) return;
        seen.add(key);
        findings.push({ where: `${describe(element)}${label}`, property, value });
      };

      const check = (element: Element, pseudo: string | null) => {
        const style = getComputedStyle(element, pseudo);
        const label = pseudo ?? '';
        for (const property of colorProps) {
          const value = style.getPropertyValue(property);
          if (!allowedColors.has(value)) record(element, label, { property, value });
        }
        const family = style.fontFamily;
        if (!allowedFonts.has(family))
          record(element, label, { property: 'font-family', value: family });
      };

      const skipped = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'META', 'LINK']);
      // body 자체(와 의사 요소)도 수집한다. querySelectorAll('*')은 body의 자손만 돌려준다.
      for (const element of [
        document.documentElement,
        document.body,
        ...document.body.querySelectorAll('*'),
      ]) {
        if (skipped.has(element.tagName)) continue;
        check(element, null);
        for (const pseudo of pseudos) {
          if (pseudo === '::placeholder' && !['INPUT', 'TEXTAREA'].includes(element.tagName))
            continue;
          check(element, pseudo);
        }
      }
      return findings;
    },
    {
      palette,
      fontDeclarations,
      colorProps: [...COLOR_PROPERTIES],
      pseudos: [...PSEUDO_ELEMENTS],
    },
  );
}

/** Tab으로 포커스를 옮겨 가며 포커스 링(outline-color)도 모은다. 포커스 상태는 평소 계산값에 없다. */
async function collectFocusRingColors(page: Page, palette: Set<string>): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (let press = 0; press < FOCUS_TAB_PRESSES; press += 1) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      return {
        where: `${element.tagName.toLowerCase()}[${element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 20) ?? ''}]`,
        outline: style.outlineColor,
        outlineStyle: style.outlineStyle,
      };
    });
    if (state && state.outlineStyle !== 'none' && !palette.has(state.outline)) {
      findings.push({
        where: `포커스 ${state.where}`,
        property: 'outline-color',
        value: state.outline,
      });
    }
  }
  return findings;
}

async function open(page: Page, route: string, view: { theme: Theme; size: typeof FRAME }) {
  const { theme, size } = view;
  await pinTheme(page, theme);
  await page.setViewportSize(size);
  await page.goto(route);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await waitForFonts(page);
}

for (const theme of THEMES) {
  const palette = paletteOf(theme);

  test.describe(`B 규칙 준수: ${theme}`, () => {
    test('globals.css에서 읽은 팔레트가 비어 있지 않다 (파싱 자체 점검)', () => {
      expect(palette.size).toBeGreaterThan(10);
      expect(fontTokenDeclarations()).toHaveLength(5);
    });

    test('대조: 토큰 밖 색·폰트를 넣으면 검사가 위반으로 잡는다', async ({ page }) => {
      await open(page, '/dev/components', { theme, size: FRAME });
      await page.evaluate(() => {
        const intruder = document.createElement('p');
        intruder.textContent = 'intruder';
        intruder.style.color = '#123456';
        intruder.style.fontFamily = 'Courier New';
        document.body.appendChild(intruder);
      });

      const properties = (await collectFindings(page, [...palette], fontTokenDeclarations())).map(
        (finding) => finding.property,
      );
      expect(properties).toContain('color');
      expect(properties).toContain('font-family');
    });

    test('대조: body 배경색에 토큰 밖 색을 주면 body가 위반으로 나온다', async ({ page }) => {
      await open(page, '/dev/components', { theme, size: FRAME });
      // body에 배경색 전환(transition)이 걸려 있어 바로 읽으면 이전 색이 나온다. 전환을 끄고 주입한다.
      await page.addStyleTag({
        content: 'body { background-color: #123456 !important; transition: none !important; }',
      });
      const findings = await collectFindings(page, [...palette], fontTokenDeclarations());
      expect(
        findings.some((f) => f.where.startsWith('body') && f.property === 'background-color'),
      ).toBe(true);
    });

    test('대조: body 의사 요소(::before)에 토큰 밖 색을 주면 body가 위반으로 나온다', async ({
      page,
    }) => {
      await open(page, '/dev/components', { theme, size: FRAME });
      await page.addStyleTag({ content: "body::before { content: ''; color: #123456; }" });

      const findings = await collectFindings(page, [...palette], fontTokenDeclarations());
      expect(
        findings.some(
          (f) =>
            f.where.startsWith('body') && f.where.endsWith('::before') && f.property === 'color',
        ),
      ).toBe(true);
    });

    for (const route of ['/', '/dev/components']) {
      test(`${route} 1440px: color·background·border·outline·font-family는 토큰·투명·폰트 토큰뿐이다`, async ({
        page,
      }) => {
        await open(page, route, { theme, size: FRAME });
        expect(await collectFindings(page, [...palette], fontTokenDeclarations())).toEqual([]);
      });

      test(`${route} 375px: 모바일 배치에서도 토큰·투명·폰트 토큰뿐이다`, async ({ page }) => {
        await open(page, route, { theme, size: MOBILE_FRAME });
        expect(await collectFindings(page, [...palette], fontTokenDeclarations())).toEqual([]);
      });
    }

    test('/ 키보드 포커스 링(outline-color)은 토큰 색이다', async ({ page }) => {
      await open(page, '/', { theme, size: FRAME });
      expect(await collectFocusRingColors(page, palette)).toEqual([]);
    });

    test('/dev/components 키보드 포커스 링(outline-color)은 토큰 색이다', async ({ page }) => {
      await open(page, '/dev/components', { theme, size: FRAME });
      expect(await collectFocusRingColors(page, palette)).toEqual([]);
    });
  });
}
