import { expect, type Page } from '@playwright/test';
import { pinTheme, waitForFonts, type Theme } from './theme';

// M1-05 규약 6: 시각 회귀 캡처 폭. UI §11 1번(1920 / 1440 / 1024 / 768 / 375).
export const VISUAL_WIDTHS = [1920, 1440, 1024, 768, 375] as const;
export const MOBILE_WIDTH = 375;
const VIEWPORT_HEIGHT = 900;

/** 폭·테마를 고정해 페이지를 열고 웹폰트까지 기다린다. 캡처 직전 상태가 항상 같아야 흔들리지 않는다. */
export async function openForCapture(
  page: Page,
  route: string,
  view: { width: number; theme: Theme },
): Promise<void> {
  const { width, theme } = view;
  await pinTheme(page, theme);
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.goto(route);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await waitForFonts(page);
}
