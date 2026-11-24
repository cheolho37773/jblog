import { expect, test } from '@playwright/test';
import { copyrightLocator } from '../helpers/visual';

// M1-05 Codex r1 #2: 시각 회귀는 저작권 문구(연도)를 mask로 가린다. 컨테이너에서 시계를 바꿀 수 없으므로
// 마스크 선택자가 모든 Footer의 저작권 문구 상자를 정확히 덮는지로 연도 변경에도 통과함을 확인한다.

const FOOTERS_PER_ROUTE = [
  { route: '/', footers: 1 },
  { route: '/dev/components', footers: 2 },
] as const;

for (const { route, footers } of FOOTERS_PER_ROUTE) {
  test(`${route}의 Footer ${footers}개마다 저작권 문구 하나가 마스크 대상이다`, async ({
    page,
  }) => {
    await page.goto(route);
    const masks = copyrightLocator(page);
    await expect(masks).toHaveCount(footers);

    for (let index = 0; index < footers; index += 1) {
      const mask = masks.nth(index);
      await expect(mask).toContainText(`© ${new Date().getFullYear()} jblog`);
      const footer = page.locator('footer').nth(index);
      const maskBox = await mask.boundingBox();
      const footerBox = await footer.boundingBox();
      expect(maskBox).not.toBeNull();
      expect(footerBox).not.toBeNull();
      // 마스크 상자는 해당 Footer 안에 있고, 연도 글자를 담을 만큼 폭·높이가 있다.
      expect(maskBox!.y).toBeGreaterThanOrEqual(footerBox!.y);
      expect(maskBox!.y + maskBox!.height).toBeLessThanOrEqual(footerBox!.y + footerBox!.height);
      expect(maskBox!.width).toBeGreaterThan(100);
      expect(maskBox!.height).toBeGreaterThan(10);
    }
  });
}
