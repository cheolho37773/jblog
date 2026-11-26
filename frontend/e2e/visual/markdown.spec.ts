import { expect, test } from '@playwright/test';
import { THEMES } from '../helpers/theme';
import { captureOptions, openForCapture, VISUAL_WIDTHS } from '../helpers/visual';

// M2-05 ①: /dev/markdown(본문 렌더 미리보기) 전체 페이지. 기준 이미지는 ③ 단계(구현 후)에서 만든다.
// 코드 블록·콜아웃·표·이미지 캡션 등 본문 스타일이 바뀌면 이 이미지에서 드러난다.

for (const theme of THEMES) {
  for (const width of VISUAL_WIDTHS) {
    test(`/dev/markdown ${width}px ${theme} 전체 페이지가 기준 이미지와 같다`, async ({ page }) => {
      await openForCapture(page, '/dev/markdown', { width, theme });
      await expect(page).toHaveScreenshot(
        `markdown-${width}-${theme}.png`,
        captureOptions(page, { fullPage: true }),
      );
    });
  }
}
