import { expect, test, type Page } from '@playwright/test';

// 디자인 토큰이 실제 빌드 결과에서 계산되는지 확인한다 (M1-02 ④). 색은 기획서 §3.3의 (확정) 값이다.
test.use({ colorScheme: 'light' });

const LIGHT_BG = 'rgb(255, 255, 255)';
const DARK_BG = 'rgb(24, 26, 42)'; // #181A2A
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 375, height: 800 };
const TOGGLE_NAME = '다크 모드';

/** 루트 요소의 계산된 CSS 변수(공백 제거) */
async function rootVariable(page: Page, name: string) {
  return page.evaluate(
    (variable) => getComputedStyle(document.documentElement).getPropertyValue(variable).trim(),
    name,
  );
}

function colorScheme(page: Page) {
  return page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
}

test('Light에서 배경 토큰과 color-scheme: light가 적용된다', async ({ page }) => {
  await page.goto('/');

  const body = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(body).toBe(LIGHT_BG);
  // next-themes가 <html>에 현재 테마의 color-scheme을 인라인으로 넣어 CSS의 `light dark`를 덮는다.
  expect(await colorScheme(page)).toBe('light');
});

test('테마를 Dark로 전환하면 배경색이 바뀐다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('switch', { name: TOGGLE_NAME }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // 배경색은 200ms에 걸쳐 전환되므로 최종 값을 기다린다.
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe(DARK_BG);
  expect(await colorScheme(page)).toBe('dark');
});

test('한글 fallback 폰트(Pretendard) 변수가 <html>에 연결되어 있다', async ({ page }) => {
  await page.goto('/');
  // 클래스 이름은 해시라서 변수가 실제로 정의됐는지로 확인한다.
  for (const variable of ['--font-pretendard', '--font-work-sans', '--font-source-serif']) {
    expect(await rootVariable(page, variable), variable).not.toBe('');
  }
});

test('Pretendard 폰트 파일과 OFL 라이선스가 정적 경로로 제공된다', async ({ request }) => {
  const license = await request.get('/fonts/Pretendard-OFL-LICENSE.txt');
  expect(license.status()).toBe(200);
  expect(await license.text()).toContain('SIL Open Font License');

  const font = await request.get('/fonts/PretendardVariable.woff2');
  expect(font.status()).toBe(200);
  expect((await font.body()).subarray(0, 4).toString('ascii')).toBe('wOF2');
});

test.describe('반응형 타이포 (--text-h1)', () => {
  test('데스크톱에서는 36px', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await expect.poll(() => rootVariable(page, '--text-h1')).toBe('36px');
  });

  test('모바일(375px)에서는 28px', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await expect.poll(() => rootVariable(page, '--text-h1')).toBe('28px');
  });
});
