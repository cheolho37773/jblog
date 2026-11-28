import { expect, test, type Page } from '@playwright/test';
import { pinTheme, THEMES, waitForFonts } from '../helpers/theme';
import {
  MOD,
  SENTINEL,
  blockingViolations,
  dragAcross,
  expectPrintBlocked,
  grantClipboard,
  lastEvent,
  primeClipboard,
  printState,
  readClipboard,
  recordEvents,
  selectionText,
  toast,
  writeClipboard,
} from '../helpers/protection';

// M2-10 ① /dev/protection (components 빌드). 연락처 예외·주소 복사·걸친 선택·검색 입력·코드 블록을 본다.
// 페이지 계약(data-testid): protection-body(본문 p) · protection-contact(.allow-select 컨테이너) ·
// protection-contact-email(그 안의 p, 텍스트 hello@example.com) · protection-mixed(p) 안의
// protection-mixed-contact(span.allow-select)와 protection-mixed-body(span, 허용 밖) · protection-search(input) ·
// protection-code(CodeBlock 래퍼). Footer 예시는 contact.email = hello@example.com 이다.

const EMAIL = 'hello@example.com';
const t = (page: Page, id: string) => page.getByTestId(id);

async function open(page: Page, theme?: 'light' | 'dark') {
  await grantClipboard(page);
  if (theme) await pinTheme(page, theme);
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto('/dev/protection');
  expect(response?.status()).toBe(200);
  await waitForFonts(page);
  await recordEvents(page);
}

test('/dev/protection은 보호 래퍼 한 겹을 쓰고 본문 선택이 막힌다', async ({ page }) => {
  await open(page);
  await expect(page.locator('.content-protected')).toHaveCount(1);
  await t(page, 'protection-body').click({ clickCount: 3 });
  expect(await selectionText(page)).toBe('');
  await dragAcross(page, t(page, 'protection-body'));
  expect(await selectionText(page)).toBe('');
});

test('본문 Cmd/Ctrl+C는 막히고 토스트가 뜬다', async ({ page }) => {
  await open(page);
  await primeClipboard(page);
  await t(page, 'protection-body').evaluate((el) => window.getSelection()?.selectAllChildren(el));
  await page.keyboard.press(`${MOD}+c`);
  await expect(toast(page)).toHaveCount(1);
  expect(await readClipboard(page)).toBe(SENTINEL);
});

test.describe('연락처(.allow-select) 예외', () => {
  test('이메일 텍스트를 드래그해 선택하고 Cmd/Ctrl+C로 복사된다', async ({ page }) => {
    await open(page);
    await primeClipboard(page);
    await dragAcross(page, t(page, 'protection-contact-email'));
    expect(await selectionText(page)).toContain(EMAIL);
    await page.keyboard.press(`${MOD}+c`);
    expect(await readClipboard(page)).toContain(EMAIL);
    expect((await lastEvent(page, 'keydown'))?.prevented).toBe(false);
    await expect(toast(page)).toHaveCount(0);
  });

  test('우클릭 메뉴가 막히지 않는다(연락처), 본문은 막힌다', async ({ page }) => {
    await open(page);
    await t(page, 'protection-contact-email').click({ button: 'right' });
    expect((await lastEvent(page, 'contextmenu'))?.prevented).toBe(false);
    await t(page, 'protection-body').click({ button: 'right' });
    expect((await lastEvent(page, 'contextmenu'))?.prevented).toBe(true);
  });

  test('연락처에서 본문까지 걸친 선택은 복사가 막힌다', async ({ page }) => {
    await open(page);
    await primeClipboard(page);
    await page.evaluate(() => {
      const contact = document.querySelector(
        '[data-testid="protection-mixed-contact"]',
      )!.firstChild!;
      const body = document.querySelector('[data-testid="protection-mixed-body"]')!.firstChild!;
      window.getSelection()?.setBaseAndExtent(contact, 0, body, 3);
    });
    await page.keyboard.press(`${MOD}+c`);
    expect(await readClipboard(page)).toBe(SENTINEL);
    expect((await lastEvent(page, 'keydown'))?.prevented).toBe(true);
    await expect(toast(page)).toHaveCount(1);
  });

  test('연락처에서 시작해 본문 쪽으로 끌어도 본문 글자는 복사되지 않는다', async ({ page }) => {
    await open(page);
    await primeClipboard(page);
    await dragAcross(page, t(page, 'protection-mixed'));
    await page.keyboard.press(`${MOD}+c`);
    const bodyText = (await t(page, 'protection-mixed-body').textContent()) ?? '';
    expect(await readClipboard(page)).not.toContain(bodyText.trim());
  });

  test('주소 복사 버튼: 이메일 주소만 복사하고 성공 안내를 보인다', async ({ page }) => {
    await open(page);
    const button = page.getByRole('contentinfo').getByRole('button', { name: '주소 복사' });
    await button.click();
    expect(await readClipboard(page)).toBe(EMAIL);
    await expect(page.getByRole('status').filter({ hasText: /복사(했습니다|됨)/ })).toHaveCount(1);
    await expect(button).toHaveAttribute('data-copy-state', 'copied');
    await expect(toast(page)).toHaveCount(0);
  });
});

test.describe('검색 입력과 코드 블록', () => {
  test('검색 입력: 일부 선택 복사·잘라내기·붙여넣기·우클릭이 정상이다', async ({ page }) => {
    await open(page);
    const input = t(page, 'protection-search');
    await input.fill('abcdef');
    await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(1, 4));
    await page.keyboard.press(`${MOD}+c`);
    expect(await readClipboard(page)).toBe('bcd');
    await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(0, 2));
    await page.keyboard.press(`${MOD}+x`);
    await expect(input).toHaveValue('cdef');
    await writeClipboard(page, 'zz');
    await page.keyboard.press(`${MOD}+v`);
    await expect(input).toHaveValue('zzcdef');
    await input.click({ button: 'right' });
    expect((await lastEvent(page, 'contextmenu'))?.prevented).toBe(false);
    await expect(toast(page)).toHaveCount(0);
  });

  test('코드 복사 버튼: 클립보드 = pre 원문(여러 줄)', async ({ page }) => {
    await open(page);
    const code = t(page, 'protection-code');
    const rendered = await code.locator('pre').evaluate((el) => el.textContent ?? '');
    expect(rendered).toContain('\n');
    await code.getByRole('button', { name: '코드 복사' }).click();
    expect(await readClipboard(page)).toBe(rendered);
    await dragAcross(page, code.locator('pre'));
    expect(await selectionText(page)).toBe('');
  });
});

test('Cmd/Ctrl+F는 막지 않고, +A는 입력 밖에서 막고 안에서 허용하며, +S·P는 막는다', async ({
  page,
}) => {
  await open(page);
  await page.keyboard.press(`${MOD}+f`);
  expect((await lastEvent(page, 'keydown'))?.prevented).toBe(false);
  await page.keyboard.press(`${MOD}+a`);
  expect((await lastEvent(page, 'keydown'))?.prevented).toBe(true);
  await t(page, 'protection-search').fill('x');
  await page.keyboard.press(`${MOD}+a`);
  expect((await lastEvent(page, 'keydown'))?.prevented).toBe(false);
  await page.keyboard.press(`${MOD}+s`);
  expect((await lastEvent(page, 'keydown'))?.prevented).toBe(true);
  await page.keyboard.press(`${MOD}+p`);
  expect((await lastEvent(page, 'keydown'))?.prevented).toBe(true);
});

test('인쇄 미디어에서 main이 숨고 안내 문구가 보인다', async ({ page }) => {
  await open(page);
  expectPrintBlocked(await printState(page));
});

test.describe('(site) 밖 개발 페이지에는 보호가 없다', () => {
  for (const path of ['/dev/components', '/dev/markdown']) {
    test(`${path}: 래퍼 없음, 선택·단축키·우클릭 정상`, async ({ page }) => {
      await grantClipboard(page);
      await page.goto(path);
      await recordEvents(page);
      await expect(page.locator('.content-protected')).toHaveCount(0);
      const text = page.locator('main p').first();
      await text.click({ clickCount: 3 });
      expect((await selectionText(page)).length).toBeGreaterThan(0);
      await page.keyboard.press(`${MOD}+c`);
      expect((await lastEvent(page, 'keydown'))?.prevented).toBe(false);
      await text.click({ button: 'right' });
      expect((await lastEvent(page, 'contextmenu'))?.prevented).toBe(false);
      await expect(toast(page)).toHaveCount(0);
    });
  }
});

for (const theme of THEMES) {
  test(`axe: /dev/protection ${theme} — serious·critical 0`, async ({ page }) => {
    await open(page, theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(await blockingViolations(page)).toEqual([]);
  });

  test(`axe: /dev/protection 토스트·복사 안내 표시 상태 ${theme} — serious·critical 0`, async ({
    page,
  }) => {
    await open(page, theme);
    await page.keyboard.press(`${MOD}+c`);
    await expect(toast(page)).toHaveCount(1);
    expect(await blockingViolations(page)).toEqual([]);
    await page.getByRole('contentinfo').getByRole('button', { name: '주소 복사' }).click();
    await expect(page.getByRole('contentinfo').getByRole('status')).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);
  });
}
