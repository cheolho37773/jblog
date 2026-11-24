import { expect, type Locator, type Page } from '@playwright/test';
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
  await waitForTransitionsToSettle(page, theme);
}

/**
 * ThemeToggle 노브는 마운트 뒤에 다크 위치로 200ms 전환한다. 느린(에뮬레이션) 환경에서는 그 전환이
 * 캡처와 겹쳐 약 2000픽셀이 흔들리므로, 스위치 상태가 테마를 따라온 뒤 진행 중인 전환이 끝날 때까지 기다린다.
 */
async function waitForTransitionsToSettle(page: Page, theme: Theme): Promise<void> {
  const expectedChecked = theme === 'dark' ? 'true' : 'false';
  for (const toggle of await page.getByRole('switch', { name: '다크 모드' }).all()) {
    await expect(toggle).toHaveAttribute('aria-checked', expectedChecked);
  }
  await page.evaluate(() =>
    Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

/**
 * 저작권 문구(`© {올해} jblog…`)는 서버가 렌더링한 현재 연도를 담아 해마다 바뀐다.
 * 브라우저 시계만 고정해서는 서버 렌더링 결과를 막을 수 없으므로 비교에서 뺀다.
 * 문구의 위치·배치는 spec-values*.spec.ts가 DOM 수치로 검증한다.
 */
export function copyrightLocator(page: Page): Locator {
  return page.locator('footer p', { hasText: '©' });
}

// 마스크는 테스트 코드 안의 캡처 처리다(디자인 토큰 대상 아님). 고정 색이라 캡처마다 같다.
const MASK_COLOR = '#ff00ff';

/** 모든 시각 회귀 캡처에 공통으로 쓰는 옵션: 연도가 들어간 저작권 문구를 가린다. */
export function captureOptions(page: Page, options: { fullPage?: boolean } = {}) {
  return { ...options, mask: [copyrightLocator(page)], maskColor: MASK_COLOR };
}
