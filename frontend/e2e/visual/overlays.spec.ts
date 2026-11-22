import { expect, test } from '@playwright/test';
import { THEMES } from '../helpers/theme';
import { MOBILE_WIDTH, openForCapture } from '../helpers/visual';

// M1-05 규약 6: 모바일 메뉴·검색 오버레이가 열린 화면(375px만). 네이티브 <dialog>라 뷰포트 크기로 캡처한다.

for (const theme of THEMES) {
  test(`모바일 메뉴가 열린 화면 ${MOBILE_WIDTH}px ${theme}이 기준 이미지와 같다`, async ({
    page,
  }) => {
    await openForCapture(page, '/', { width: MOBILE_WIDTH, theme });
    await page.getByRole('banner').getByRole('button', { name: '메뉴 열기' }).click();
    await expect(page.getByRole('dialog', { name: '메뉴' })).toBeVisible();
    await expect(page).toHaveScreenshot(`menu-open-${MOBILE_WIDTH}-${theme}.png`);
  });

  test(`검색 오버레이가 열린 화면 ${MOBILE_WIDTH}px ${theme}이 기준 이미지와 같다`, async ({
    page,
  }) => {
    await openForCapture(page, '/', { width: MOBILE_WIDTH, theme });
    await page.getByRole('banner').getByRole('button', { name: '검색 열기' }).click();
    await expect(page.getByRole('dialog', { name: '검색' })).toBeVisible();
    await expect(page).toHaveScreenshot(`search-open-${MOBILE_WIDTH}-${theme}.png`);
  });
}
