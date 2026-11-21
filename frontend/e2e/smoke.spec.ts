import { expect, test } from '@playwright/test';

// 처음 상태는 시스템 설정을 따르므로, 라이트로 고정해 결과를 결정적으로 만든다.
test.use({ colorScheme: 'light' });

const TOGGLE_NAME = '다크 모드';

test('첫 화면에서 테마를 전환하고 새로고침 후에도 선택이 유지된다', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  await expect(page.getByRole('heading', { name: 'jblog' })).toBeVisible();

  const html = page.locator('html');
  const toggle = page.getByRole('switch', { name: TOGGLE_NAME });
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('switch', { name: TOGGLE_NAME })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  await page.getByRole('switch', { name: TOGGLE_NAME }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('switch', { name: TOGGLE_NAME })).toHaveAttribute(
    'aria-checked',
    'false',
  );
});

test('첫 화면과 테마 전환 중 콘솔 오류(하이드레이션 경고 포함)가 없다', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('switch', { name: TOGGLE_NAME }).click();
  await page.reload();
  await expect(page.getByRole('switch', { name: TOGGLE_NAME })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  expect(consoleErrors).toEqual([]);
});

test('첫 응답 HTML은 lang="ko"이고 서버 전용 API 주소를 담지 않는다', async ({ request }) => {
  const html = await (await request.get('/')).text();

  expect(html).toContain('lang="ko"');
  expect(html).not.toContain('localhost:4999');
});
