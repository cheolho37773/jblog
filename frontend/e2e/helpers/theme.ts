import type { Page } from '@playwright/test';

export type Theme = 'light' | 'dark';
export const THEMES: readonly Theme[] = ['light', 'dark'];

// next-themes 저장 키 (기본값). 저장값과 OS 설정을 같이 맞춰 첫 페인트부터 테마가 고정되게 한다 (깜빡임·시스템 설정 의존 방지).
const THEME_STORAGE_KEY = 'theme';

/** 페이지를 열기 전에 호출한다. 테마를 저장값과 prefers-color-scheme 양쪽으로 고정한다. */
export async function pinTheme(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript((saved) => window.localStorage.setItem(saved.key, saved.value), {
    key: THEME_STORAGE_KEY,
    value: theme,
  });
}

/** 웹폰트 로딩이 끝날 때까지 기다린다 (캡처·측정 흔들림 방지). */
export async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}
