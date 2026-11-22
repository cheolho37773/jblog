import { expect, test, type Page } from '@playwright/test';

// Codex M1-04 r1 #1: 연속한 Section 사이 간격은 데스크톱에서 정확히 80px이다 (UI §4.1).
// 위·아래 패딩이 합쳐져 160px이 되는 회귀를 막는다.
// 측정: "콘텐츠" = Section의 자식 요소 경계. 앞 Section은 마지막 자식 하단, 뒤 Section은 첫 자식 상단을 쓰므로
// Section 자신의 패딩·마진은 거리에 포함된다(= 사용자가 보는 콘텐츠 사이 간격).

const PAGE_PATH = '/dev/components';
const SECTION_GAP = 80;
const TOLERANCE = 0.5;
const VIEWPORT_HEIGHT = 900;
const DESKTOP_WIDTHS = [1280, 1024, 768];
const MOBILE_WIDTH = 375;

async function contentGap(page: Page): Promise<number> {
  await expect(page.getByTestId('dev-layout-sections')).toBeVisible(); // 없으면 30초 대기 대신 바로 실패한다
  return page.getByTestId('dev-layout-sections').evaluate((root) => {
    const a = root.querySelector('[data-example="section-a"]');
    const b = root.querySelector('[data-example="section-b"]');
    if (!a || !b) throw new Error('section-a·section-b 예제가 없다');
    const childBottom = (section: Element) =>
      Math.max(
        ...Array.from(section.children).map((child) => child.getBoundingClientRect().bottom),
      );
    const childTop = (section: Element) =>
      Math.min(...Array.from(section.children).map((child) => child.getBoundingClientRect().top));
    return childTop(b) - childBottom(a);
  });
}

for (const width of DESKTOP_WIDTHS) {
  test(`${width}px: 연속한 Section의 콘텐츠 사이 간격은 ${SECTION_GAP}px이다`, async ({ page }) => {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto(PAGE_PATH);

    const gap = await contentGap(page);

    expect(Math.abs(gap - SECTION_GAP), `실제 간격 ${gap}px`).toBeLessThanOrEqual(TOLERANCE);
  });
}

test(`${MOBILE_WIDTH}px: 연속한 Section의 콘텐츠 사이 간격은 0보다 크고 ${SECTION_GAP}px 이하이다 (모바일은 축소)`, async ({
  page,
}) => {
  await page.setViewportSize({ width: MOBILE_WIDTH, height: VIEWPORT_HEIGHT });
  await page.goto(PAGE_PATH);

  const gap = await contentGap(page);

  expect(gap).toBeGreaterThan(0);
  expect(gap).toBeLessThanOrEqual(SECTION_GAP);
});
