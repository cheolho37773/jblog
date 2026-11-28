import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

// M2-10 복사 방지 E2E 공용 도구. data-testid 계약은 지시서 인계 노트 "① 테스트 선작성"에 있다.

export const TOAST_TEXT = '콘텐츠 복사가 제한되어 있습니다';
export const PRINT_NOTICE = '이 콘텐츠는 인쇄할 수 없습니다.';
export const SENTINEL = 'jblog-clipboard-sentinel';
export const MOD = 'ControlOrMeta';

export const toast = (page: Page): Locator =>
  page.getByRole('status').filter({ hasText: TOAST_TEXT });

export async function grantClipboard(page: Page): Promise<void> {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
}

export const readClipboard = (page: Page): Promise<string> =>
  page.evaluate(() => navigator.clipboard.readText());
export const writeClipboard = (page: Page, text: string): Promise<void> =>
  page.evaluate((value) => navigator.clipboard.writeText(value), text);

/** 클립보드에 표식을 넣어 둔다. 복사가 막히면 표식이 그대로 남는다. */
export const primeClipboard = (page: Page) => writeClipboard(page, SENTINEL);

/** window 버블 단계에서 keydown·contextmenu·dragstart의 defaultPrevented를 기록한다(CopyGuard는 document에서 먼저 처리). */
export async function recordEvents(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __events: { type: string; key?: string; prevented: boolean }[];
    };
    w.__events = [];
    for (const type of ['keydown', 'contextmenu', 'dragstart', 'copy', 'cut']) {
      window.addEventListener(type, (e) => {
        w.__events.push({ type, key: (e as KeyboardEvent).key, prevented: e.defaultPrevented });
      });
    }
  });
}

export async function lastEvent(page: Page, type: string) {
  return page.evaluate(
    (t) =>
      [...(window as unknown as { __events: { type: string; prevented: boolean }[] }).__events]
        .reverse()
        .find((e) => e.type === t),
    type,
  );
}

export const selectionText = (page: Page): Promise<string> =>
  page.evaluate(() => window.getSelection()?.toString() ?? '');

export async function dragAcross(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('드래그 대상의 위치를 알 수 없다');
  const y = box.y + Math.min(box.height / 2, 12);
  await page.mouse.move(box.x + 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, y, { steps: 8 });
  await page.mouse.up();
}

/** dragstart를 직접 보내 CopyGuard가 막는지 본다. */
export const dragstartPrevented = (target: Locator): Promise<boolean> =>
  target.evaluate((el) => {
    const event = new Event('dragstart', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  });

/** 클립보드 쓰기가 항상 거부되는 환경(권한 거부·비보안 문맥)을 만든다. 페이지를 열기 전에 호출한다. */
export async function denyClipboardWrites(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
      configurable: true,
    });
  });
}

const BLOCKING_IMPACTS = ['serious', 'critical'];
export async function blockingViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ''))
    .map((v) => ({
      rule: v.id,
      impact: v.impact,
      targets: v.nodes.map((n) => n.target.join(' ')),
    }));
}

/** 인쇄 미디어로 바꾼 뒤 보호 래퍼의 main 표시와 ::after 안내 문구를 읽는다. */
export async function printState(page: Page) {
  await page.emulateMedia({ media: 'print' });
  return page.evaluate(() => {
    const root = document.querySelector('.content-protected');
    const main = root?.querySelector('main');
    const after = root ? getComputedStyle(root, '::after') : null;
    return {
      hasRoot: Boolean(root),
      mainDisplay: main ? getComputedStyle(main).display : null,
      afterContent: after?.content ?? '',
      afterDisplay: after?.display ?? '',
    };
  });
}

export function expectPrintBlocked(state: Awaited<ReturnType<typeof printState>>): void {
  expect(state.hasRoot).toBe(true);
  expect(state.mainDisplay).toBe('none');
  expect(state.afterContent).toContain(PRINT_NOTICE);
  expect(state.afterDisplay).toBe('block');
}
