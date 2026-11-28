import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, openBlog } from './helpers/blog';
import { FULL_SLUG, postBody, postBySlug, readJsonLd, readMeta, articleRoot } from './helpers/post';
import { THEMES } from './helpers/theme';
import {
  MOD,
  SENTINEL,
  blockingViolations,
  denyClipboardWrites,
  dragAcross,
  dragstartPrevented,
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
} from './helpers/protection';

// M2-10 ① 필수 검증: 실제 (site) 페이지(prod 빌드 + 픽스처). 04 §2.5. 상세 글은 코드 블록·이미지가 있는 픽스처 글이다.
const post = postBySlug(FULL_SLUG);
const GREET_CODE = 'export function greet(name: string): string {\n  return `Hello, ${name}`;\n}';
const copyButton = (page: Page) => page.getByRole('button', { name: '코드 복사' }).first();
const searchBox = (page: Page) => page.getByRole('banner').getByRole('searchbox').first();

async function openDetail(page: Page, theme?: 'light' | 'dark') {
  await grantClipboard(page);
  await openBlog(page, `/blog/${FULL_SLUG}`, { theme, size: DESKTOP });
  await recordEvents(page);
}

test.describe('선택 차단', () => {
  test('상세 본문 트리플클릭 후 선택 문자열이 비어 있다', async ({ page }) => {
    await openDetail(page);
    await postBody(page).locator('p').first().click({ clickCount: 3 });
    expect(await selectionText(page)).toBe('');
  });

  test('상세 본문·제목 드래그 후 선택 문자열이 비어 있다', async ({ page }) => {
    await openDetail(page);
    await dragAcross(page, postBody(page).locator('p').first());
    expect(await selectionText(page)).toBe('');
    await dragAcross(page, articleRoot(page).locator('h1'));
    expect(await selectionText(page)).toBe('');
  });

  test('코드 블록 텍스트도 드래그로 선택되지 않는다', async ({ page }) => {
    await openDetail(page);
    await dragAcross(page, postBody(page).locator('pre').first());
    expect(await selectionText(page)).toBe('');
  });

  test('본문은 user-select:none, 검색창은 user-select:text이다', async ({ page }) => {
    await openDetail(page);
    const body = await postBody(page).evaluate((el) => getComputedStyle(el).userSelect);
    const input = await searchBox(page).evaluate((el) => getComputedStyle(el).userSelect);
    expect(body).toBe('none');
    expect(input).toBe('text');
  });

  test('Home·블로그 목록(카드 텍스트)에서도 드래그 선택이 안 된다', async ({ page }) => {
    await grantClipboard(page);
    for (const path of ['/', '/blog']) {
      await openBlog(page, path, { size: DESKTOP });
      await dragAcross(page, page.locator('main h2, main h3').first());
      expect(await selectionText(page), path).toBe('');
    }
  });
});

test.describe('복사 차단과 안내 토스트', () => {
  test('본문에서 Cmd/Ctrl+C: 클립보드에 본문이 들어가지 않고 안내 토스트가 뜬다', async ({
    page,
  }) => {
    await openDetail(page);
    await primeClipboard(page);
    await postBody(page).locator('p').first().click({ clickCount: 3 });
    await page.keyboard.press(`${MOD}+c`);
    await expect(toast(page)).toHaveCount(1);
    expect(await readClipboard(page)).toBe(SENTINEL);
    expect((await lastEvent(page, 'keydown'))?.prevented).toBe(true);
  });

  test('프로그램으로 만든 본문 선택도 Cmd/Ctrl+C·X가 막힌다', async ({ page }) => {
    await openDetail(page);
    await primeClipboard(page);
    await postBody(page)
      .locator('p')
      .first()
      .evaluate((el) => window.getSelection()?.selectAllChildren(el));
    await page.keyboard.press(`${MOD}+c`);
    await page.keyboard.press(`${MOD}+x`);
    expect(await readClipboard(page)).toBe(SENTINEL);
  });

  test('3초 안에 두 번 막아도 토스트는 1개이고, 3초 뒤 사라진다', async ({ page }) => {
    await openDetail(page);
    await page.keyboard.press(`${MOD}+c`);
    await page.keyboard.press(`${MOD}+c`);
    await expect(toast(page)).toHaveCount(1);
    await page.keyboard.press(`${MOD}+p`);
    await expect(toast(page)).toHaveCount(1);
    await expect(toast(page)).toHaveCount(0, { timeout: 5000 });
  });

  test('토스트는 role=status·aria-live=polite이고 화면 아래 가운데에 있다', async ({ page }) => {
    await openDetail(page);
    await page.keyboard.press(`${MOD}+c`);
    const region = toast(page);
    await expect(region).toHaveCount(1);
    await expect(region).toHaveAttribute('aria-live', 'polite');
    const box = await region.boundingBox();
    expect(box).not.toBeNull();
    const center = box!.x + box!.width / 2;
    expect(Math.abs(center - DESKTOP.width / 2)).toBeLessThanOrEqual(24);
    expect(box!.y + box!.height / 2).toBeGreaterThan(DESKTOP.height / 2);
  });

  test('Cmd/Ctrl+S·P는 기본 동작이 막힌다(P는 같은 토스트)', async ({ page }) => {
    await openDetail(page);
    await page.keyboard.press(`${MOD}+s`);
    expect((await lastEvent(page, 'keydown'))?.prevented).toBe(true);
    await page.keyboard.press(`${MOD}+p`);
    expect((await lastEvent(page, 'keydown'))?.prevented).toBe(true);
    await expect(toast(page)).toHaveCount(1);
  });

  test('Cmd/Ctrl+F는 막지 않고, Cmd/Ctrl+A는 입력 요소 밖에서 막는다', async ({ page }) => {
    await openDetail(page);
    await page.keyboard.press(`${MOD}+f`);
    expect((await lastEvent(page, 'keydown'))?.prevented).toBe(false);
    await page.keyboard.press(`${MOD}+a`);
    expect((await lastEvent(page, 'keydown'))?.prevented).toBe(true);
    expect(await selectionText(page)).toBe('');
  });

  test('우클릭: 본문·이미지는 메뉴가 막힌다', async ({ page }) => {
    await openDetail(page);
    await postBody(page).locator('p').first().click({ button: 'right' });
    expect((await lastEvent(page, 'contextmenu'))?.prevented).toBe(true);
    await postBody(page).locator('img').first().click({ button: 'right' });
    expect((await lastEvent(page, 'contextmenu'))?.prevented).toBe(true);
  });
});

test.describe('검색창 예외', () => {
  async function openWithInput(page: Page) {
    await openDetail(page);
    const input = searchBox(page);
    await input.fill('abcdef');
    return input;
  }

  test('입력·일부 선택 후 Cmd/Ctrl+C가 정상이고 토스트가 없다', async ({ page }) => {
    const input = await openWithInput(page);
    await primeClipboard(page);
    await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(1, 4));
    await page.keyboard.press(`${MOD}+c`);
    expect(await readClipboard(page)).toBe('bcd');
    expect((await lastEvent(page, 'keydown'))?.prevented).toBe(false);
    await expect(toast(page)).toHaveCount(0);
  });

  test('잘라내기(Cmd/Ctrl+X)가 정상이다', async ({ page }) => {
    const input = await openWithInput(page);
    await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(0, 2));
    await page.keyboard.press(`${MOD}+x`);
    expect(await readClipboard(page)).toBe('ab');
    await expect(input).toHaveValue('cdef');
  });

  test('붙여넣기와 전체 선택(Cmd/Ctrl+A)이 입력 요소 안에서는 정상이다', async ({ page }) => {
    const input = await openWithInput(page);
    await page.keyboard.press(`${MOD}+a`);
    expect((await lastEvent(page, 'keydown'))?.prevented).toBe(false);
    await writeClipboard(page, 'pasted');
    await page.keyboard.press(`${MOD}+v`);
    await expect(input).toHaveValue('pasted');
  });

  test('입력창 안 드래그 선택과 우클릭 메뉴가 막히지 않는다', async ({ page }) => {
    const input = await openWithInput(page);
    await input.dblclick();
    expect(
      await input.evaluate((el: HTMLInputElement) => el.selectionEnd! - el.selectionStart!),
    ).toBeGreaterThan(0);
    await input.click({ button: 'right' });
    expect((await lastEvent(page, 'contextmenu'))?.prevented).toBe(false);
  });

  test('Cmd/Ctrl+S·P는 입력창에서도 막힌다', async ({ page }) => {
    await openWithInput(page);
    await page.keyboard.press(`${MOD}+s`);
    expect((await lastEvent(page, 'keydown'))?.prevented).toBe(true);
  });
});

test.describe('코드 복사·링크 복사', () => {
  test('코드 복사 버튼: 클립보드 = 코드 원문, 복사됨 안내, 2초 뒤 복귀', async ({ page }) => {
    await openDetail(page);
    const button = copyButton(page);
    const rendered = await page
      .locator('pre')
      .first()
      .evaluate((el) => el.textContent ?? '');
    await button.click();
    const copied = await readClipboard(page);
    expect(copied).toBe(rendered);
    expect(copied.trimEnd()).toBe(GREET_CODE);
    await expect(page.getByRole('status').filter({ hasText: '복사됨' })).toHaveCount(1);
    await expect(button).toHaveAttribute('data-copy-state', 'copied');
    await page.waitForTimeout(1000);
    await expect(button).toHaveAttribute('data-copy-state', 'copied');
    await expect(button).toHaveAttribute('data-copy-state', 'idle', { timeout: 2500 });
    await expect(page.getByText('복사됨')).toHaveCount(0);
  });

  test('코드 복사 버튼은 CopyGuard의 토스트를 띄우지 않는다', async ({ page }) => {
    await openDetail(page);
    await copyButton(page).click();
    await expect(toast(page)).toHaveCount(0);
  });

  test('링크 복사: 클립보드 = 상세 canonical 절대 주소', async ({ page }) => {
    await openDetail(page);
    const button = articleRoot(page).getByRole('button', { name: '링크 복사' });
    await button.click();
    const { canonical } = await readMeta(page);
    const copied = await readClipboard(page);
    expect(copied).toBe(canonical);
    expect(copied).toBe(`${new URL(page.url()).origin}/blog/${post.slug}`);
    await expect(page.getByRole('status').filter({ hasText: '링크를 복사했습니다' })).toHaveCount(
      1,
    );
  });

  test('클립보드 쓰기가 거부되면 두 버튼 모두 "복사하지 못했습니다"를 보인다', async ({ page }) => {
    await denyClipboardWrites(page);
    await openBlog(page, `/blog/${FULL_SLUG}`, { size: DESKTOP });
    await copyButton(page).click();
    await expect(page.getByRole('status').filter({ hasText: '복사하지 못했습니다' })).toHaveCount(
      1,
    );
    await expect(copyButton(page)).toHaveAttribute('data-copy-state', 'failed');
    await articleRoot(page).getByRole('button', { name: '링크 복사' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: '복사하지 못했습니다' }).first(),
    ).toBeVisible();
  });
});

test.describe('인쇄·이미지', () => {
  test('인쇄 미디어에서 main이 숨고 안내 문구가 보인다', async ({ page }) => {
    await openDetail(page);
    expectPrintBlocked(await printState(page));
    await expect(page.locator('main')).toBeHidden();
  });

  test('Home에서도 인쇄가 막힌다', async ({ page }) => {
    await openBlog(page, '/', { size: DESKTOP });
    expectPrintBlocked(await printState(page));
  });

  test('이미지는 draggable=false이고 dragstart가 막힌다(상세 커버·본문, 목록 카드)', async ({
    page,
  }) => {
    await openDetail(page);
    for (const img of [page.getByTestId('post-cover'), postBody(page).locator('img').first()]) {
      await expect(img).toHaveAttribute('draggable', 'false');
      expect(await dragstartPrevented(img)).toBe(true);
    }
    await openBlog(page, '/blog', { size: DESKTOP });
    const images = page.locator('main img');
    expect(await images.count()).toBeGreaterThan(0);
    for (const draggable of await images.evaluateAll((els) =>
      els.map((el) => el.getAttribute('draggable')),
    )) {
      expect(draggable).toBe('false');
    }
  });

  test('루트 not-found(같은 (site) 틀)에도 보호 래퍼가 있다', async ({ page }) => {
    await page.goto('/no-such-route-m2-10');
    await expect(page.locator('.content-protected')).toHaveCount(1);
  });

  test('보호 래퍼는 한 겹이고 상세·Home에 모두 있다', async ({ page }) => {
    for (const path of [`/blog/${FULL_SLUG}`, '/']) {
      await page.goto(path);
      await expect(page.locator('.content-protected'), path).toHaveCount(1);
    }
  });
});

test.describe('원문 노출 회귀', () => {
  test('상세 HTML·RSC 응답에 Markdown 원문이 없다', async ({ request }) => {
    const sources = ['```', '[!NOTE]', '## 정리'];
    const html = await (await request.get(`/blog/${FULL_SLUG}`)).text();
    const rsc = await (await request.get(`/blog/${FULL_SLUG}`, { headers: { RSC: '1' } })).text();
    for (const marker of sources) {
      expect(html, `html ${marker}`).not.toContain(marker);
      expect(rsc, `rsc ${marker}`).not.toContain(marker);
    }
    expect(html).not.toContain('contentMd');
    expect(rsc).not.toContain('contentMd');
  });

  test('공개 API 응답에 contentMd가 없다', async ({ request }) => {
    const body = await (await request.get(`/api/posts/${FULL_SLUG}`)).text();
    expect(body).not.toContain('contentMd');
  });

  test('JSON-LD BlogPosting에 articleBody가 없다', async ({ page }) => {
    await page.goto(`/blog/${FULL_SLUG}`);
    const items = await readJsonLd(page);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item).not.toHaveProperty('articleBody');
  });
});

test.describe('회귀: 키보드·링크·검색 이동', () => {
  test('Tab 첫 포커스는 건너뛰기 링크이고 Enter로 본문으로 이동한다', async ({ page }) => {
    await openDetail(page);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: '본문으로 건너뛰기' })).toBeFocused();
  });

  test('Navbar 링크 클릭 이동이 정상이다', async ({ page }) => {
    await openDetail(page);
    await page.getByRole('banner').getByRole('link', { name: 'Blog', exact: true }).first().click();
    await expect(page).toHaveURL(/\/blog$/);
  });

  test('Navbar 검색: 입력 후 Enter로 /search로 이동한다', async ({ page }) => {
    await openDetail(page);
    const input = searchBox(page);
    await input.fill('캐시');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/search\?q=/);
  });

  test('본문 안 링크 클릭이 정상이다(태그 또는 이전·다음 글)', async ({ page }) => {
    await openDetail(page);
    await page.getByRole('navigation', { name: '이전·다음 글' }).getByRole('link').first().click();
    await expect(page).toHaveURL(/\/blog\/[^/]+$/);
  });
});

for (const theme of THEMES) {
  test.describe(`접근성 axe ${theme}`, () => {
    test(`상세 — serious·critical 0`, async ({ page }) => {
      await openDetail(page, theme);
      expect(await blockingViolations(page)).toEqual([]);
    });

    test(`상세 토스트 표시 상태 — serious·critical 0`, async ({ page }) => {
      await openDetail(page, theme);
      await page.keyboard.press(`${MOD}+c`);
      await expect(toast(page)).toHaveCount(1);
      expect(await blockingViolations(page)).toEqual([]);
    });

    test(`상세 복사됨 안내 표시 상태 — serious·critical 0`, async ({ page }) => {
      await openDetail(page, theme);
      await copyButton(page).click();
      await expect(page.getByText('복사됨')).toBeVisible();
      expect(await blockingViolations(page)).toEqual([]);
    });
  });
}
