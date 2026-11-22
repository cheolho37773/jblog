import { expect, test } from '@playwright/test';
import { THEMES } from '../helpers/theme';
import { openForCapture, VISUAL_WIDTHS } from '../helpers/visual';

// M1-05 규약 6: /dev/components(컴포넌트 전체 예시) 전체 페이지. 섹션 하나가 바뀌면 이 이미지에서 드러난다.

for (const theme of THEMES) {
  for (const width of VISUAL_WIDTHS) {
    test(`/dev/components ${width}px ${theme} 전체 페이지가 기준 이미지와 같다`, async ({
      page,
    }) => {
      await openForCapture(page, '/dev/components', { width, theme });
      await expect(page).toHaveScreenshot(`components-${width}-${theme}.png`, { fullPage: true });
    });
  }
}
