import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinTheme, THEMES, waitForFonts } from '../helpers/theme';

// M1-05 규약 8: /dev/components(컴포넌트 전체 예시) 접근성(axe). serious·critical 위반 0.
// 규칙을 끄거나 대상에서 빼지 않는다.

const BLOCKING_IMPACTS = ['serious', 'critical'];
const SIZES = [
  { label: '1440', width: 1440, height: 900 },
  { label: '375', width: 375, height: 800 },
];

for (const theme of THEMES) {
  for (const size of SIZES) {
    test(`axe: /dev/components ${size.label}px ${theme} — serious·critical 위반 0`, async ({
      page,
    }) => {
      await pinTheme(page, theme);
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/dev/components');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await waitForFonts(page);

      const { violations } = await new AxeBuilder({ page }).analyze();
      const blocking = violations
        .filter((violation) => BLOCKING_IMPACTS.includes(violation.impact ?? ''))
        .map((violation) => ({
          rule: violation.id,
          impact: violation.impact,
          targets: violation.nodes.map((node) => node.target.join(' ')),
        }));
      expect(blocking).toEqual([]);
    });
  }
}
