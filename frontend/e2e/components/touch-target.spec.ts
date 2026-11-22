import { expect, test, type Locator, type Page } from '@playwright/test';

// Codex M1-03 r1 #2: 모바일(375px)에서 SearchInput과 Badge 링크는 시각 크기와 별개로
// 요소 중심에서 위·아래·좌·우 22px(= 44x44 영역) 지점을 실제로 눌러도 반응해야 한다 (UI §4.2).

const PAGE_PATH = '/dev/components';
const MOBILE_VIEWPORT = { width: 375, height: 800 };
const MIN_TARGET = 44;
const HALF = MIN_TARGET / 2;
// 경계에 걸쳐 오차가 나지 않도록 44px 영역의 가장자리에서 1px 안쪽을 누른다.
const EDGE_INSET = 1;
const OUTSIDE_OFFSET = 30; // 44px 영역(22px) 바깥
const NAVIGATION_SETTLE_MS = 500;

test.use({ viewport: MOBILE_VIEWPORT });

/** 요소를 화면 가운데로 옮긴 뒤 중심 좌표를 돌려준다. */
async function centerOf(target: Locator) {
  await target.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const box = await target.boundingBox();
  if (!box) throw new Error('요소가 보이지 않는다');
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    width: box.width,
    height: box.height,
  };
}

/** 44x44 영역의 네 방향 가장자리 지점. 요소가 이미 44px 이상인 축은 건너뛴다. */
function probePoints(center: { x: number; y: number; width: number; height: number }) {
  const offset = HALF - EDGE_INSET;
  const points: { name: string; x: number; y: number }[] = [];
  if (center.height < MIN_TARGET) {
    points.push({ name: '위', x: center.x, y: center.y - offset });
    points.push({ name: '아래', x: center.x, y: center.y + offset });
  }
  if (center.width < MIN_TARGET) {
    points.push({ name: '왼쪽', x: center.x - offset, y: center.y });
    points.push({ name: '오른쪽', x: center.x + offset, y: center.y });
  }
  return points;
}

interface HitAreaCheck {
  locate: () => Locator;
  /** 클릭 뒤 요소가 반응했는지(포커스·이동) */
  reacted: () => Promise<boolean>;
  /** 다음 지점을 누르기 전에 반응 상태를 되돌린다 */
  reset: () => Promise<void>;
}

async function expectHitArea(page: Page, { locate, reacted, reset }: HitAreaCheck) {
  const target = locate();
  const size = await target.boundingBox();
  expect(size, '요소 크기').not.toBeNull();

  // 시각 크기가 이미 44 이상이면 확장할 필요가 없다. 부족한 축만 점검한다.
  const center = await centerOf(target);
  const points = probePoints(center);
  for (const point of points) {
    await reset();
    const fresh = await centerOf(locate()); // 스크롤이 바뀌었을 수 있어 좌표를 다시 얻는다
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    await page.mouse.click(fresh.x + dx, fresh.y + dy);
    // 같은 문서 안 해시 이동은 next/link가 비동기로 반영하므로 잠시 기다려 확인한다.
    await expect
      .poll(reacted, {
        message: `${point.name} 가장자리(${HALF - EDGE_INSET}px)를 눌러도 반응해야 한다`,
      })
      .toBe(true);
  }
}

test('SearchInput은 시각 높이와 별개로 44px 높이 영역 어디를 눌러도 입력에 포커스된다', async ({
  page,
}) => {
  await page.goto(PAGE_PATH);
  const searchbox = () => page.getByTestId('dev-searchinput').getByRole('searchbox').first();
  await expect(searchbox()).toBeVisible();

  await expectHitArea(page, {
    locate: searchbox,
    reacted: () => searchbox().evaluate((element) => element === document.activeElement),
    reset: () => searchbox().evaluate((element) => (element as HTMLElement).blur()),
  });
});

test('Badge 링크는 시각 크기와 별개로 44x44 영역 어디를 눌러도 이동한다', async ({ page }) => {
  await page.goto(PAGE_PATH);
  const link = () => page.getByTestId('dev-badge').getByRole('link').first();
  await expect(link()).toBeVisible();
  const href = (await link().getAttribute('href')) as string;
  expect(href).toMatch(/^#/); // dev 페이지의 앵커 링크라 이동 여부를 hash로 본다

  await expectHitArea(page, {
    locate: link,
    reacted: () => page.evaluate(() => location.hash).then((hash) => hash === href),
    reset: () => page.evaluate(() => history.replaceState(null, '', location.pathname)),
  });
});

test('Badge 링크는 44x44 영역 밖(중심에서 위로 30px)을 누르면 이동하지 않는다 (대조)', async ({
  page,
}) => {
  await page.goto(PAGE_PATH);
  const link = page.getByTestId('dev-badge').getByRole('link').first();
  await expect(link).toBeVisible();

  const center = await centerOf(link);
  await page.mouse.click(center.x, center.y - OUTSIDE_OFFSET);
  // 이동이 늦게 반영될 수 있으므로 같은 시간만큼 기다린 뒤 해시가 그대로인지 본다.
  await page.waitForTimeout(NAVIGATION_SETTLE_MS);

  expect(await page.evaluate(() => location.hash)).toBe('');
});
