import { expect, test, type Page } from '@playwright/test';
import {
  CALLS_PATH,
  CALL_PROBE_PREFIX,
  DEFAULT_FIXTURE_INTERNAL_KEY,
  ERROR_TAG,
  LONG_SLUG,
  MISSING_SLUG,
  NO_COVER_SLUG,
  NO_HEADINGS_SLUG,
  OLD_SLUG,
  OLD_SLUG_TARGET,
  SCRIPT_TITLE_SLUG,
  SERVER_ERROR_POST_SLUG,
  UNAUTHORIZED_POST_SLUG,
} from './fixtures/server';
import { DESKTOP, MOBILE, WIDTHS, blockingViolations } from './helpers/blog';
import {
  FIXTURE_API_ORIGIN,
  FULL_SLUG,
  NOT_FOUND_TEXT,
  OLDEST_SLUG,
  expectNoHorizontalScroll,
  openPost,
  viewportBoxOf,
  viewportWidth,
} from './helpers/post';
import { THEMES, pinTheme, waitForFonts } from './helpers/theme';

// M2-08 ① 필수 검증(거부·회귀): 영구 이동 308, 404 화면, 5xx·401은 404가 아님, 내부 API 1회, /internal 비노출, 가로 스크롤, 접근성.

const NOT_FOUND_STATUS = 404;
const COMMON_ERROR_TEXT = '문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const LIST_ERROR_TEXT = '글 목록을 불러오지 못했습니다';

/** 화면이 실제로 그려졌는지(상세 h1 또는 404 문구) 확인한다. 빈 화면·기본 404에서 우연히 통과하지 않게 한다. */
async function expectRendered(page: Page, path: string) {
  const marker =
    path === '/nope'
      ? page.locator('main').getByText(`${NOT_FOUND_TEXT}.`)
      : page.locator('main article h1');
  await expect(marker).toBeVisible();
}

test.describe('이전 slug는 308로 영구 이동', () => {
  test(`/blog/${OLD_SLUG} → 308 + Location: /blog/${OLD_SLUG_TARGET}`, async ({ request }) => {
    const response = await request.get(`/blog/${OLD_SLUG}`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    const location = response.headers()['location'] ?? '';
    expect(new URL(location, 'http://localhost').pathname).toBe(`/blog/${OLD_SLUG_TARGET}`);
  });

  test('브라우저는 새 주소로 도착해 그 글이 보인다', async ({ page }) => {
    const response = await page.goto(`/blog/${OLD_SLUG}`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`/blog/${OLD_SLUG_TARGET}$`));
    await expect(page.locator('h1')).toHaveText('NestJS 내부 API 가드 만들기');
  });

  test('현재 slug는 이동하지 않고 200이다(대조)', async ({ request }) => {
    const response = await request.get(`/blog/${OLD_SLUG_TARGET}`, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });
});

test.describe('404 화면 (UI §7.7)', () => {
  const MISSING_PATHS = [`/blog/${MISSING_SLUG}`, '/nope', '/blog/nope/deeper'];

  for (const path of MISSING_PATHS) {
    test(`${path} → 상태 404와 같은 404 화면`, async ({ page, request }) => {
      // 대조: 있는 글은 200이어야 한다(라우트가 없어서 나오는 404와 구분).
      expect((await request.get(`/blog/${FULL_SLUG}`)).status()).toBe(200);
      expect((await request.get(path)).status()).toBe(NOT_FOUND_STATUS);

      const response = await page.goto(path);
      expect(response?.status()).toBe(NOT_FOUND_STATUS);
      await waitForFonts(page);

      const main = page.locator('main');
      await expect(main.getByText('404', { exact: true })).toBeVisible();
      await expect(main.getByText(`${NOT_FOUND_TEXT}.`)).toBeVisible();
      const home = main.getByRole('link', { name: 'Home' });
      await expect(home).toHaveAttribute('href', '/');
      // 사이트 화면 안에 그린다: Navbar·Footer가 있다.
      await expect(page.locator('header').first()).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();
      expect(await page.title()).toContain(NOT_FOUND_TEXT);
      // Next 기본 404 화면이 아니다.
      await expect(page.getByText('This page could not be found')).toHaveCount(0);
    });
  }

  test('404 숫자는 그라디언트 글자이고 설명·버튼과 함께 가운데 정렬이다', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/nope');
    await waitForFonts(page);
    const digits = page.locator('main').getByText('404', { exact: true });
    const style = await digits.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        fontSize: s.fontSize,
        backgroundImage: s.backgroundImage,
        color: s.color,
        clip: s.getPropertyValue('-webkit-background-clip') || s.backgroundClip,
      };
    });
    expect(style.fontSize).toBe('56px');
    expect(style.backgroundImage).toContain('linear-gradient');
    expect(style.color).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(style.clip).toBe('text');

    const width = await viewportWidth(page);
    for (const locator of [
      digits,
      page.locator('main').getByText(`${NOT_FOUND_TEXT}.`),
      page.locator('main').getByRole('link', { name: 'Home' }),
    ]) {
      const box = await viewportBoxOf(locator);
      expect(Math.abs(box.left + box.width / 2 - width / 2)).toBeLessThanOrEqual(1);
    }
  });

  test('375px에서 404 숫자는 36px이다', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/nope');
    const fontSize = await page
      .locator('main')
      .getByText('404', { exact: true })
      .evaluate((el) => getComputedStyle(el).fontSize);
    expect(fontSize).toBe('36px');
  });

  test('Home 버튼을 누르면 홈(200)으로 간다', async ({ page }) => {
    await page.goto('/nope');
    await page.locator('main').getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('footer')).toBeVisible();
  });
});

test.describe('401·5xx는 404로 바꾸지 않고 오류로 끝난다', () => {
  for (const slug of [SERVER_ERROR_POST_SLUG, UNAUTHORIZED_POST_SLUG]) {
    test(`/blog/${slug}는 404가 아니다`, async ({ page, request }) => {
      expect((await request.get(`/blog/${slug}`)).status()).not.toBe(NOT_FOUND_STATUS);

      const response = await page.goto(`/blog/${slug}`);
      const status = response?.status() ?? 0;
      expect(status).not.toBe(NOT_FOUND_STATUS);
      await expect(page.getByText(`${NOT_FOUND_TEXT}.`)).toHaveCount(0);
      // 상태가 5xx든 스트리밍으로 200이 굳었든, 화면은 사이트 공통 오류 화면이어야 한다(목록 전용 오류 화면이 아니다).
      // Next의 경로 안내 요소(route announcer)도 role="alert"라 문구로 좁힌다.
      const alert = page.getByRole('alert').filter({ hasText: COMMON_ERROR_TEXT });
      await expect(alert).toBeVisible();
      await expect(alert.getByRole('button', { name: '다시 시도' })).toBeVisible();
      await expect(alert.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
      await expect(page.getByText(LIST_ERROR_TEXT)).toHaveCount(0);
      await expect(page.getByTestId('blog-error')).toHaveCount(0);
      await expect(page.locator('article h1')).toHaveCount(0);
    });
  }

  test('목록 서버 오류(/blog?tag=fixture-error)는 목록 전용 오류 화면(blog-error)이다', async ({
    page,
  }) => {
    await page.goto(`/blog?tag=${ERROR_TAG.slug}`);
    const boundary = page.getByTestId('blog-error');
    await expect(boundary).toBeVisible();
    await expect(boundary).toHaveAttribute('role', 'alert');
    await expect(boundary).toContainText(LIST_ERROR_TEXT);
    await expect(boundary.getByRole('button', { name: '다시 시도' })).toBeVisible();
    await expect(page.getByText(COMMON_ERROR_TEXT)).toHaveCount(0);
  });
});

test.describe('내부 API는 한 번의 페이지 요청에 1번', () => {
  test('generateMetadata와 페이지가 합쳐 내부 API를 1번만 부른다', async ({
    page,
    request,
  }, testInfo) => {
    // 서버 fetch 캐시가 같은 주소를 재사용하므로 재시도·반복마다 새 slug를 쓴다(픽스처가 접두사로 연다).
    const slug = `${CALL_PROBE_PREFIX}${testInfo.workerIndex}-${testInfo.retry}-${Date.now()}`;
    const callsOf = async () =>
      (
        (await (await request.get(`${FIXTURE_API_ORIGIN}${CALLS_PATH}?slug=${slug}`)).json()) as {
          count: number;
        }
      ).count;

    expect(await callsOf()).toBe(0);
    const response = await page.goto(`/blog/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('article h1')).toBeVisible();
    expect(await callsOf()).toBe(1);
  });

  test('호출 수 확인 수단이 동작한다(없는 slug도 세어진다)', async ({ page, request }) => {
    const slug = `no-such-${Date.now()}`;
    await page.goto(`/blog/${slug}`);
    const body = (await (
      await request.get(`${FIXTURE_API_ORIGIN}${CALLS_PATH}?slug=${slug}`)
    ).json()) as { count: number };
    expect(body.count).toBe(1);
  });
});

test.describe('/internal 비노출', () => {
  async function collect(page: Page) {
    const urls: string[] = [];
    const keyed: string[] = [];
    const bundles: string[] = [];
    page.on('request', (request) => {
      urls.push(request.url());
      if ('x-internal-key' in request.headers()) keyed.push(request.url());
    });
    page.on('response', async (response) => {
      if (response.request().resourceType() !== 'script') return;
      bundles.push(await response.text().catch(() => ''));
    });
    return { urls, keyed, bundles };
  }

  test('상세를 열고 스크롤·링크 이동하는 동안 브라우저는 /internal/*·원문 API를 부르지 않는다', async ({
    page,
  }) => {
    const seen = await collect(page);
    await openPost(page, LONG_SLUG, { size: DESKTOP });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState('networkidle');

    const paths = seen.urls.map((url) => new URL(url).pathname);
    expect(paths.filter((p) => p.startsWith('/internal'))).toEqual([]);
    // 상세는 서버가 내부 API 하나로 만든다. 브라우저는 공개 글 API(/api/posts/*)도 부르지 않는다.
    expect(paths.filter((p) => p.startsWith('/api/posts'))).toEqual([]);
    expect(seen.urls.filter((url) => url.includes(':4100'))).toEqual([]);
    expect(seen.keyed).toEqual([]);
  });

  test('받은 스크립트(번들)에 내부 키·/internal/ 경로·원문 필드가 없다', async ({ page }) => {
    const seen = await collect(page);
    await openPost(page, LONG_SLUG, { size: DESKTOP });
    await page.waitForLoadState('networkidle');

    expect(seen.bundles.length).toBeGreaterThan(0);
    for (const code of seen.bundles) {
      expect(code).not.toContain(DEFAULT_FIXTURE_INTERNAL_KEY);
      expect(code.toLowerCase()).not.toContain('x-internal-key');
      expect(code).not.toContain('/internal/posts');
      expect(code).not.toContain('긴 글 섹션 1의 1번째 문단'); // 원문 본문 조각
    }
  });

  test('HTML·RSC에 내부 키가 없다', async ({ request }) => {
    const html = await (await request.get(`/blog/${FULL_SLUG}`)).text();
    expect(html, '상세가 그려진 응답').toContain('<h1');
    expect(html).not.toContain(DEFAULT_FIXTURE_INTERNAL_KEY);
    expect(html.toLowerCase()).not.toContain('x-internal-key');
  });

  test('프록시를 거친 /internal/posts/{slug}는 브라우저 경로로 열리지 않는다(404)', async ({
    request,
  }) => {
    expect((await request.get(`/internal/posts/${FULL_SLUG}`)).status()).toBe(NOT_FOUND_STATUS);
  });
});

test.describe('가로 스크롤 없음', () => {
  const PATHS = [`/blog/${FULL_SLUG}`, `/blog/${LONG_SLUG}`, `/blog/${NO_COVER_SLUG}`, '/nope'];
  for (const width of WIDTHS) {
    for (const path of PATHS) {
      test(`${width}px ${path}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await waitForFonts(page);
        await expectRendered(page, path);
        await expectNoHorizontalScroll(page);
      });
    }
  }
});

test.describe('접근성 axe (serious·critical 0)', () => {
  const STATES = [
    ['상세(전체 요소)', `/blog/${FULL_SLUG}`],
    ['상세(헤딩 없음·카테고리 없음)', `/blog/${NO_HEADINGS_SLUG}`],
    ['상세(커버 없음)', `/blog/${NO_COVER_SLUG}`],
    ['상세(가장 오래된 글)', `/blog/${OLDEST_SLUG}`],
    ['상세(긴 글·TOC)', `/blog/${LONG_SLUG}`],
    ['상세(제목에 스크립트 문자열)', `/blog/${SCRIPT_TITLE_SLUG}`],
    ['404', '/nope'],
  ] as const;
  for (const theme of THEMES) {
    for (const [label, path] of STATES) {
      for (const size of [DESKTOP, MOBILE]) {
        test(`${label} ${size.width}px ${theme}`, async ({ page }) => {
          await pinTheme(page, theme);
          await page.setViewportSize(size);
          await page.goto(path);
          await waitForFonts(page);
          await expectRendered(page, path);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          expect(await blockingViolations(page)).toEqual([]);
        });
      }
    }
  }
});
