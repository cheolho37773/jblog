import { expect, test, type Locator, type Page } from '@playwright/test';

// 토큰 교체(M1-08) 후 실제 렌더링된 색의 대비를 계산 색으로 확인한다 (UI §9).
// 클래스 이름이 아니라 computed 색을 보므로, 토큰이 틀리거나 다시 임시 색으로 돌아가면 실패한다.

const PAGE_PATH = '/dev/components';
const THEMES = ['light', 'dark'] as const;
const AA_TEXT = 4.5;
const AA_NON_TEXT = 3; // 아이콘은 비텍스트 기준(WCAG 1.4.11)

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** 브라우저 안에서 요소의 글자색과, 조상까지 합성한 실제 배경색의 대비를 계산한다. */
async function contrastOf(target: Locator): Promise<number> {
  return target.evaluate((element) => {
    const parse = (value: string): Rgba => {
      const match = /rgba?\(([^)]+)\)/.exec(value);
      if (!match) throw new Error(`색을 읽을 수 없다: ${value}`);
      const parts = (match[1] as string)
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number);
      return {
        r: parts[0] as number,
        g: parts[1] as number,
        b: parts[2] as number,
        a: parts[3] ?? 1,
      };
    };
    const over = (top: Rgba, below: Rgba): Rgba => {
      const a = top.a + below.a * (1 - top.a);
      // 둘 다 투명이면 합성할 색이 없다(0으로 나누기 방지).
      if (a === 0) return top;
      const mix = (t: number, b: number) => (t * top.a + b * below.a * (1 - top.a)) / a;
      return { r: mix(top.r, below.r), g: mix(top.g, below.g), b: mix(top.b, below.b), a };
    };
    const luminance = ({ r, g, b }: Rgba) => {
      const [lr, lg, lb] = [r, g, b].map((channel) => {
        const ratio = channel / 255;
        return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    };

    // 불투명해질 때까지 조상 배경을 아래에 깐다.
    let background: Rgba = { r: 0, g: 0, b: 0, a: 0 };
    for (let node: Element | null = element; node && background.a < 1; node = node.parentElement) {
      background = over(background, parse(getComputedStyle(node).backgroundColor));
    }
    const foreground = over(parse(getComputedStyle(element).color), background);
    const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
      (x, y) => y - x,
    ) as [number, number];
    return (lighter + 0.05) / (darker + 0.05);
  });
}

const section = (page: Page, id: string) => page.getByTestId(id);

for (const theme of THEMES) {
  test.describe(`${theme} 테마 대비`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(PAGE_PATH);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    });

    const textCases: [name: string, locate: (page: Page) => Locator][] = [
      [
        'Button primary 글자',
        (page) =>
          section(page, 'dev-button').getByRole('button', { name: 'primary', exact: true }).first(),
      ],
      [
        'Button pillSolid 글자',
        (page) => section(page, 'dev-button').getByRole('button', { name: 'pillSolid' }),
      ],
      ['Badge solid 글자', (page) => section(page, 'dev-badge').getByText('solid md')],
      ['Badge soft 글자', (page) => section(page, 'dev-badge').getByText('soft md')],
      [
        'Input 오류 문구',
        (page) => section(page, 'dev-input').getByText('올바른 이메일을 입력하세요'),
      ],
      ['Avatar 이니셜', (page) => section(page, 'dev-avatar').getByText('J').first()],
    ];

    for (const [name, locate] of textCases) {
      test(`${name}은 배경 대비 ${AA_TEXT}:1 이상`, async ({ page }) => {
        const target = locate(page);
        await expect(target).toBeVisible();
        expect(await contrastOf(target)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }

    test(`Button icon의 아이콘은 배경 대비 ${AA_NON_TEXT}:1 이상 (실제 5:1 안팎)`, async ({
      page,
    }) => {
      const icon = section(page, 'dev-button').getByRole('button', { name: 'GitHub' });
      await expect(icon).toBeVisible();
      expect(await contrastOf(icon)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });
  });
}
