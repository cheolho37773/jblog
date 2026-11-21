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
