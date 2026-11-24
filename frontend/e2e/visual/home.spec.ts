import { expect, test } from '@playwright/test';
import { THEMES } from '../helpers/theme';
import { captureOptions, openForCapture, VISUAL_WIDTHS } from '../helpers/visual';

// M1-05 규약 6: `/`(Navbar + 본문 + Footer) 전체 페이지. 기준 이미지는 Linux 컨테이너에서만 만든다(pnpm test:visual).

for (const theme of THEMES) {
  for (const width of VISUAL_WIDTHS) {
    test(`/ ${width}px ${theme} 전체 페이지가 기준 이미지와 같다`, async ({ page }) => {
      await openForCapture(page, '/', { width, theme });
      await expect(page).toHaveScreenshot(
        `home-${width}-${theme}.png`,
        captureOptions(page, { fullPage: true }),
      );
    });
  }
}
