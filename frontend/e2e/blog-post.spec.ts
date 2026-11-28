import { expect, test, type Page } from '@playwright/test';
import {
  DEFAULT_FIXTURE_INTERNAL_KEY,
  INTERNAL_POSTS,
  LONG_SLUG,
  NO_COVER_SLUG,
  NO_HEADINGS_SLUG,
  SCRIPT_TITLE,
  SCRIPT_TITLE_SLUG,
} from './fixtures/server';
import { DESKTOP, MOBILE } from './helpers/blog';
import {
  FULL_SLUG,
  NEWEST_SLUG,
  OLDEST_SLUG,
  TOLERANCE,
  articleRoot,
  boxOf,
  openPost,
  postBody,
  postBySlug,
  postCover,
  postMeta,
  postNav,
  readJsonLd,
  relatedSection,
  tagNav,
  tocNav,
  viewportBoxOf,
  viewportWidth,
} from './helpers/post';

// M2-08 ① 필수 검증(성공): `/blog/[slug]` 상세. 실제 빌드(prod) + 픽스처 서버 기준이다(UI §7.3, 지시서 "화면 구성").
// 간격은 요소 사각형(getBoundingClientRect) 기준 ±1px. 측정 대상은 지시서 인계 노트의 data-testid 계약을 따른다.

const full = postBySlug(FULL_SLUG);
const near = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected), `${actual} vs ${expected}`).toBeLessThanOrEqual(TOLERANCE);

const indexOfSlug = (slug: string) => INTERNAL_POSTS.findIndex((post) => post.slug === slug);

test.describe('레이아웃: 순서·간격·폭 (UI §7.3)', () => {
  for (const size of [DESKTOP, MOBILE]) {
    test(`${size.width}px 블록 순서와 간격(32·16·20·32·32·32·32·32)`, async ({ page }) => {
      await openPost(page, FULL_SLUG, { size });
      const root = articleRoot(page);
      const header = page.locator('header').first();
      const badge = root.locator('a[href^="/blog?category="]').first();
      const h1 = root.locator('h1');
      const [navbar, badgeBox, h1Box, meta, cover, body, tags, nav, related] = await Promise.all([
        boxOf(header),
        boxOf(badge),
        boxOf(h1),
        boxOf(postMeta(page)),
        boxOf(postCover(page)),
        boxOf(postBody(page)),
        boxOf(tagNav(page)),
        boxOf(postNav(page)),
        boxOf(relatedSection(page).locator('h2')),
      ]);

      near(badgeBox.top - navbar.bottom, 32);
      near(h1Box.top - badgeBox.bottom, 16);
      near(meta.top - h1Box.bottom, 20);
      near(cover.top - meta.bottom, 32);
      near(body.top - cover.bottom, 32);
      near(tags.top - body.bottom, 32);
      near(nav.top - tags.bottom, 32);
      near(related.top - nav.bottom, 32);
    });
  }

  test('1440: 본문 열 폭 800이고 화면 가운데에 있다', async ({ page }) => {
    await openPost(page, FULL_SLUG, { size: DESKTOP });
    const [h1, cover, body, width] = await Promise.all([
      boxOf(articleRoot(page).locator('h1')),
      boxOf(postCover(page)),
      boxOf(postBody(page)),
      viewportWidth(page),
    ]);
    for (const box of [h1, cover, body]) {
      near(box.left, (width - 800) / 2);
    }
    near(cover.width, 800);
    near(body.width, 800);
  });

  for (const [width, expected] of [
    [1024, 800],
    [768, 720],
    [375, 343],
  ] as const) {
    test(`${width}px 본문 열 폭 ${expected}(좁으면 화면 폭 − 좌우 gutter, UI §4.2)`, async ({
      page,
    }) => {
      await openPost(page, FULL_SLUG, { size: { width, height: 900 } });
      const cover = await boxOf(postCover(page));
      near(cover.width, expected);
      near(cover.left, (width - expected) / 2);
    });
  }

  test('제목 h1: 1440은 36/40, 375는 28/34', async ({ page }) => {
    for (const [size, fontSize, lineHeight] of [
      [DESKTOP, '36px', '40px'],
      [MOBILE, '28px', '34px'],
    ] as const) {
      await openPost(page, FULL_SLUG, { size });
      const style = await articleRoot(page)
        .locator('h1')
        .evaluate((el) => {
          const s = getComputedStyle(el);
          return { fontSize: s.fontSize, lineHeight: s.lineHeight };
        });
      expect(style).toEqual({ fontSize, lineHeight });
    }
  });

  test('루트 article 안에 h1은 정확히 1개이고 글 제목이다', async ({ page }) => {
    await openPost(page, FULL_SLUG);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(articleRoot(page).locator('h1')).toHaveText(full.title);
  });

  for (const size of [DESKTOP, MOBILE]) {
    test(`${size.width}px 커버: 비율 800/462, radius 12, lazy 아님, alt 비어 있음`, async ({
      page,
    }) => {
      await openPost(page, FULL_SLUG, { size });
      const cover = postCover(page);
      await expect(cover).toHaveJSProperty('tagName', 'IMG');
      await expect(cover).toHaveAttribute('alt', '');
      await expect(cover).not.toHaveAttribute('loading', 'lazy');
      const box = await boxOf(cover);
      expect(Math.abs(box.width / box.height - 800 / 462)).toBeLessThan(0.01);
      const radius = await cover.evaluate((el) => getComputedStyle(el).borderRadius);
      expect(radius).toBe('12px');
      await expect
        .poll(() => cover.evaluate((el) => (el as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
    });
  }

  test('AuthorMeta(sm)에 날짜(Asia/Seoul)와 읽는 시간이 있다', async ({ page }) => {
    await openPost(page, FULL_SLUG);
    await expect(postMeta(page)).toContainText('2026.10.12');
    await expect(postMeta(page)).toContainText(`${full.readingMinutes}`);
  });
});

test.describe('본문 렌더', () => {
  test('h2·h3에 id와 앵커 링크가 있다', async ({ page }) => {
    await openPost(page, FULL_SLUG);
    const body = postBody(page);
    await expect(body.locator('h2')).toHaveCount(2);
    await expect(body.locator('h3')).toHaveCount(1);
    const ids = await body.locator('h2, h3').evaluateAll((els) => els.map((el) => el.id));
    expect(ids.every((id) => id !== '')).toBe(true);
    for (const id of ids) {
      await expect(body.locator(`a[href="#${id}"]`)).toHaveCount(1);
    }
  });

  test('코드 블록·콜아웃·이미지 캡션이 렌더된다', async ({ page }) => {
    await openPost(page, FULL_SLUG);
    const body = postBody(page);
    await expect(body.locator('pre')).toHaveCount(1);
    await expect(body.locator('pre')).toContainText('greet');
    await expect(body).toContainText('콜아웃 예시입니다');
    await expect(body.locator('figure figcaption')).toHaveText(
      '그림 1. 직접 만든 그라디언트 이미지',
    );
  });

  test('원문(마크다운 문법·contentMd)이 HTML·RSC 응답에 그대로 실리지 않는다', async ({
    request,
  }) => {
    const html = await (await request.get(`/blog/${FULL_SLUG}`)).text();
    // HTML에는 RSC 페이로드(self.__next_f)도 함께 들어 있다.
    expect(html).toContain('self.__next_f');
    expect(html, '상세가 그려진 응답').toContain(full.title);
    expect(html).toContain('<h1');
    for (const raw of [
      '[!NOTE]',
      '```',
      '![픽스처 이미지]',
      `## ${full.title}을 시작하며`,
      '### 먼저 알아둘 점',
      'contentMd',
    ]) {
      expect(html, `원문 조각: ${raw}`).not.toContain(raw);
    }
  });

  test('RSC 요청(RSC: 1) 응답에도 원문·contentMd가 없다', async ({ request }) => {
    // Next 16은 `RSC: 1`만 보내면 `?_rsc=` 주소로 이동시킨 뒤 RSC 본문을 준다(리다이렉트를 따라간다).
    // Next-Router-State-Tree 헤더는 Next 16이 해석하지 못해 500이므로 보내지 않는다.
    const response = await request.get(`/blog/${FULL_SLUG}`, { headers: { RSC: '1' } });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/x-component');
    const text = await response.text();
    expect(text, '상세가 담긴 RSC 응답').toContain(full.title);
    expect(text).not.toContain('<html');
    for (const raw of [
      '[!NOTE]',
      '```',
      '![픽스처 이미지]',
      'contentMd',
      DEFAULT_FIXTURE_INTERNAL_KEY,
    ]) {
      expect(text, `원문 조각: ${raw}`).not.toContain(raw);
    }
  });
});

test.describe('링크: 카테고리·태그', () => {
  test('카테고리 Badge는 /blog?category={slug} 링크이고 solid다', async ({ page }) => {
    await openPost(page, FULL_SLUG);
    const badge = articleRoot(page).locator('a[href^="/blog?category="]').first();
    await expect(badge).toHaveAttribute('href', `/blog?category=${full.category?.slug}`);
    await expect(badge).toHaveText(full.category?.name ?? '');
    await badge.click();
    await expect(page).toHaveURL(/\/blog\?category=frontend$/);
  });

  test('태그는 nav[aria-label="태그"] 안 soft Badge이고 각각 /blog?tag={slug} 링크다', async ({
    page,
  }) => {
    await openPost(page, 'prisma-transaction-isolation');
    const post = postBySlug('prisma-transaction-isolation');
    const links = tagNav(page).getByRole('link');
    await expect(links).toHaveCount(post.tags.length);
    for (const [index, tag] of post.tags.entries()) {
      await expect(links.nth(index)).toHaveAttribute('href', `/blog?tag=${tag.slug}`);
      await expect(links.nth(index)).toContainText(tag.name);
    }
  });

  test('태그 링크를 누르면 그 태그 목록으로 간다', async ({ page }) => {
    await openPost(page, FULL_SLUG);
    await tagNav(page).getByRole('link').first().click();
    await expect(page).toHaveURL(/\/blog\?tag=nextjs$/);
  });

  test('카테고리가 없는 글은 Badge가 없고 h1이 Navbar 아래 32에서 시작한다', async ({ page }) => {
    await openPost(page, OLDEST_SLUG);
    await expect(articleRoot(page).locator('a[href^="/blog?category="]')).toHaveCount(0);
    const [navbar, h1] = await Promise.all([
      boxOf(page.locator('header').first()),
      boxOf(articleRoot(page).locator('h1')),
    ]);
    near(h1.top - navbar.bottom, 32);
  });

  test('태그가 없는 글은 태그 블록이 없다', async ({ page }) => {
    await openPost(page, OLDEST_SLUG);
    await expect(tagNav(page)).toHaveCount(0);
  });

  test('커버가 없는 글은 커버 블록이 없고 메타 아래에 본문이 32로 이어진다', async ({ page }) => {
    await openPost(page, NO_COVER_SLUG);
    await expect(postCover(page)).toHaveCount(0);
    await expect(articleRoot(page).locator('img[alt=""]').first()).not.toHaveAttribute(
      'data-testid',
      'post-cover',
    );
    const [meta, body] = await Promise.all([boxOf(postMeta(page)), boxOf(postBody(page))]);
    near(body.top - meta.bottom, 32);
  });
});

test.describe('이전/다음 글 (UI §7.3)', () => {
  const link = (page: Page, label: '이전 글' | '다음 글') =>
    postNav(page).getByRole('link', { name: new RegExp(label) });

  test('prev는 더 오래된 글(왼쪽), next는 더 최근 글(오른쪽)이고 카드 전체가 링크다', async ({
    page,
  }) => {
    await openPost(page, FULL_SLUG, { size: DESKTOP });
    const index = indexOfSlug(FULL_SLUG);
    const older = INTERNAL_POSTS[index + 1];
    const newer = INTERNAL_POSTS[index - 1];
    await expect(link(page, '이전 글')).toHaveAttribute('href', `/blog/${older?.slug}`);
    await expect(link(page, '다음 글')).toHaveAttribute('href', `/blog/${newer?.slug}`);
    await expect(link(page, '이전 글')).toContainText(older?.title ?? '');
    await expect(link(page, '다음 글')).toContainText(newer?.title ?? '');

    const [prev, next, nav] = await Promise.all([
      boxOf(link(page, '이전 글')),
      boxOf(link(page, '다음 글')),
      boxOf(postNav(page)),
    ]);
    expect(prev.right).toBeLessThanOrEqual(next.left + TOLERANCE);
    expect(prev.top).toBeLessThanOrEqual(next.top + TOLERANCE);
    near(prev.left, nav.left);
    near(next.right, nav.right);
  });

  test('375px는 1열이라 이전 글 아래에 다음 글이 온다', async ({ page }) => {
    await openPost(page, FULL_SLUG, { size: MOBILE });
    const [prev, next] = await Promise.all([
      boxOf(link(page, '이전 글')),
      boxOf(link(page, '다음 글')),
    ]);
    expect(next.top).toBeGreaterThanOrEqual(prev.bottom - TOLERANCE);
    near(prev.left, next.left);
  });

  test('가장 최신 글은 next가 없어 이전 글만 왼쪽 칸에 있다', async ({ page }) => {
    await openPost(page, NEWEST_SLUG, { size: DESKTOP });
    await expect(link(page, '다음 글')).toHaveCount(0);
    const [prev, nav] = await Promise.all([boxOf(link(page, '이전 글')), boxOf(postNav(page))]);
    near(prev.left, nav.left);
    expect(prev.width).toBeLessThan(nav.width * 0.6);
  });

  test('가장 오래된 글은 prev가 없어 다음 글이 오른쪽 칸에 그대로 있다', async ({ page }) => {
    await openPost(page, OLDEST_SLUG, { size: DESKTOP });
    await expect(link(page, '이전 글')).toHaveCount(0);
    const [next, nav] = await Promise.all([boxOf(link(page, '다음 글')), boxOf(postNav(page))]);
    near(next.right, nav.right);
    expect(next.left).toBeGreaterThanOrEqual(nav.left + nav.width / 2 - TOLERANCE);
  });

  test('둘 다 없는 글은 이전·다음 블록이 없다', async ({ page }) => {
    await openPost(page, NO_COVER_SLUG);
    await expect(postNav(page)).toHaveCount(0);
  });

  test('이전 글 카드를 누르면 그 글로 간다', async ({ page }) => {
    await openPost(page, FULL_SLUG);
    await link(page, '이전 글').click();
    const older = INTERNAL_POSTS[indexOfSlug(FULL_SLUG) + 1];
    await expect(page).toHaveURL(new RegExp(`/blog/${older?.slug}$`));
    await expect(page.locator('h1')).toHaveText(older?.title ?? '');
  });
});

test.describe('관련 글 (0~3개)', () => {
  const cards = (page: Page) => relatedSection(page).locator('a[href^="/blog/"]');

  test('같은 카테고리 글 최대 3개를 제목 "관련 글"(h2) 아래 카드(h3)로 보인다', async ({
    page,
  }) => {
    await openPost(page, NO_COVER_SLUG);
    const frontend = INTERNAL_POSTS.filter((post) => post.category?.slug === 'frontend').slice(
      0,
      3,
    );
    await expect(
      relatedSection(page).getByRole('heading', { level: 2, name: '관련 글' }),
    ).toBeVisible();
    const hrefs = await cards(page).evaluateAll((links) => [
      ...new Set(links.map((a) => a.getAttribute('href'))),
    ]);
    expect(hrefs).toEqual(frontend.map((post) => `/blog/${post.slug}`));
    await expect(relatedSection(page).locator('h3')).toHaveCount(3);
  });

  test('관련 글이 2개면 2개만 보인다', async ({ page }) => {
    await openPost(page, FULL_SLUG);
    await expect(relatedSection(page).locator('h3')).toHaveCount(2);
  });

  test('관련 글이 0개면 블록과 제목이 없다', async ({ page }) => {
    await openPost(page, OLDEST_SLUG);
    await expect(relatedSection(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: '관련 글' })).toHaveCount(0);
  });

  test('관련 글 그리드: 1440은 3열, 375는 1열', async ({ page }) => {
    for (const [size, columns] of [
      [DESKTOP, 3],
      [MOBILE, 1],
    ] as const) {
      await openPost(page, NO_COVER_SLUG, { size });
      const tops = await relatedSection(page)
        .locator('li')
        .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
      const firstRow = tops.filter((top) => top === tops[0]);
      expect(firstRow).toHaveLength(columns);
    }
  });
});

test.describe('목차(TOC)', () => {
  const heading = (page: Page, text: string) => postBody(page).getByRole('heading', { name: text });
  const tocLinks = (page: Page) => tocNav(page).getByRole('link');

  test('1440: 본문 오른쪽에 폭 200 sticky로 있고 본문은 화면 가운데에 그대로다', async ({
    page,
  }) => {
    await openPost(page, LONG_SLUG, { size: DESKTOP });
    await expect(tocNav(page)).toBeVisible();
    const [toc, body, width] = await Promise.all([
      boxOf(tocNav(page)),
      boxOf(postBody(page)),
      viewportWidth(page),
    ]);
    near(toc.width, 200);
    expect(toc.left).toBeGreaterThanOrEqual(body.right - TOLERANCE);
    near(body.left, (width - 800) / 2);
    near(body.width, 800);

    const sticky = await tocNav(page).evaluate((nav) => {
      for (let el: Element | null = nav; el; el = el.parentElement) {
        if (getComputedStyle(el).position === 'sticky') return true;
      }
      return false;
    });
    expect(sticky).toBe(true);
    const fontSize = await tocLinks(page)
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { fontSize: s.fontSize, lineHeight: s.lineHeight };
      });
    expect(fontSize).toEqual({ fontSize: '14px', lineHeight: '20px' });
  });

  test('스크롤해도 TOC가 화면 안에 붙어 따라온다', async ({ page }) => {
    await openPost(page, LONG_SLUG, { size: DESKTOP });
    await page.evaluate(() => window.scrollTo(0, 2500));
    await expect(tocNav(page)).toBeInViewport();
    const box = await viewportBoxOf(tocNav(page));
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.top).toBeLessThan(400);
  });

  test('항목은 본문 h2·h3과 같은 순서의 #id 링크다', async ({ page }) => {
    await openPost(page, LONG_SLUG, { size: DESKTOP });
    const headings = await postBody(page)
      .locator('h2, h3')
      .evaluateAll((els) => els.map((el) => ({ id: el.id, text: el.textContent?.trim() ?? '' })));
    const items = await tocLinks(page).evaluateAll((els) =>
      els.map((el) => ({ href: el.getAttribute('href'), text: el.textContent?.trim() ?? '' })),
    );
    expect(headings).toHaveLength(6);
    expect(items.map((i) => i.href)).toEqual(headings.map((h) => `#${h.id}`));
    expect(items.map((i) => i.text)).toEqual(
      headings.map((h) => h.text.replace(/^#\s*|\s*#$/g, '')),
    );
  });

  test('스크롤하면 현재 항목(aria-current="location")이 바뀌고 한 번에 하나뿐이다', async ({
    page,
  }) => {
    await openPost(page, LONG_SLUG, { size: DESKTOP });
    const current = tocNav(page).locator('[aria-current="location"]');
    const currentHref = async () => current.getAttribute('href');

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(current).toHaveCount(1);
    const first = await currentHref();

    await heading(page, '긴 글 섹션 4').evaluate((el) => el.scrollIntoView());
    await expect(current).toHaveCount(1);
    await expect
      .poll(currentHref)
      .toBe(`#${await heading(page, '긴 글 섹션 4').getAttribute('id')}`);
    expect(await currentHref()).not.toBe(first);

    await heading(page, '긴 글 섹션 2').evaluate((el) => el.scrollIntoView());
    await expect
      .poll(currentHref)
      .toBe(`#${await heading(page, '긴 글 섹션 2').getAttribute('id')}`);
  });

  test('현재 항목은 primary-text 색, 나머지는 muted 색이다', async ({ page }) => {
    await openPost(page, LONG_SLUG, { size: DESKTOP });
    const target = heading(page, '긴 글 섹션 3');
    const id = await target.getAttribute('id');
    await target.evaluate((el) => el.scrollIntoView());
    const current = tocNav(page).locator('[aria-current="location"]');
    // 스크롤 이벤트는 다음 프레임에 오므로 현재 항목이 목표 섹션으로 바뀐 뒤에 색을 읽는다.
    await expect(current).toHaveAttribute('href', `#${id}`);
    await expect(current).toHaveCount(1);
    const others = tocNav(page).locator('a:not([aria-current])');
    const colorOf = (locator: ReturnType<Page['locator']>) =>
      locator.first().evaluate((el) => getComputedStyle(el).color);
    await expect.poll(async () => (await colorOf(current)) !== (await colorOf(others))).toBe(true);
  });

  test('링크를 누르면 해당 헤딩으로 이동하고 주소에 #id가 붙는다', async ({ page }) => {
    await openPost(page, LONG_SLUG, { size: DESKTOP });
    const target = heading(page, '긴 글 섹션 4');
    const id = await target.getAttribute('id');
    await tocLinks(page).filter({ hasText: '긴 글 섹션 4' }).click();
    await expect(page).toHaveURL(new RegExp(`#${encodeURIComponent(id ?? '')}$|#${id}$`));
    await expect(target).toBeInViewport();
    const box = await viewportBoxOf(target);
    expect(box.top).toBeGreaterThanOrEqual(0);
    await expect(tocNav(page).locator('[aria-current="location"]')).toHaveAttribute(
      'href',
      `#${id}`,
    );
  });

  test('1280에는 있고 1279에는 없다(경계)', async ({ page }) => {
    await openPost(page, LONG_SLUG, { size: { width: 1280, height: 900 } });
    await expect(tocNav(page)).toBeVisible();
    await page.setViewportSize({ width: 1279, height: 900 });
    await expect(tocNav(page)).toHaveCount(0);
  });

  for (const width of [1024, 768, 375]) {
    test(`${width}px에는 TOC를 그리지 않는다`, async ({ page }) => {
      await openPost(page, LONG_SLUG, { size: { width, height: 900 } });
      await expect(postBody(page)).toBeVisible();
      await expect(tocNav(page)).toHaveCount(0);
    });
  }

  test('헤딩이 없는 글에는 1440에서도 TOC가 없다', async ({ page }) => {
    await openPost(page, NO_HEADINGS_SLUG, { size: DESKTOP });
    await expect(postBody(page)).toBeVisible();
    await expect(tocNav(page)).toHaveCount(0);
  });
});

test.describe('메타데이터·구조화 데이터', () => {
  // 기대값은 픽스처(글 데이터)와 NEXT_PUBLIC_SITE_URL(= 프록시 주소)에서 만든다.
  const originOf = (page: Page) => new URL(page.url()).origin;
  const sameInstant = (actual: string | undefined, expected: string) =>
    expect(new Date(actual ?? '').getTime()).toBe(new Date(expected).getTime());

  test('title은 seoTitle을 쓰고 템플릿 "%s | jblog"가 붙는다', async ({ page }) => {
    await openPost(page, LONG_SLUG);
    const meta = await page.evaluate(() => document.title);
    expect(meta).toBe('긴 글 SEO 제목 | jblog');
  });

  test('seoTitle·seoDescription이 없으면 title·excerpt를 쓴다', async ({ page }) => {
    await openPost(page, NO_COVER_SLUG);
    const post = postBySlug(NO_COVER_SLUG);
    expect(await page.title()).toBe(`${post.title} | jblog`);
    await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
      'content',
      post.excerpt,
    );
  });

  test('description·canonical은 seoDescription·현재 slug 절대 주소다', async ({ page }) => {
    await openPost(page, LONG_SLUG);
    const post = postBySlug(LONG_SLUG);
    await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
      'content',
      post.seoDescription ?? '',
    );
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${originOf(page)}/blog/${LONG_SLUG}`,
    );
  });

  test('Open Graph: article·발행·수정 시각·url·커버(절대 주소), Twitter summary_large_image', async ({
    page,
  }) => {
    await openPost(page, LONG_SLUG);
    const post = postBySlug(LONG_SLUG);
    const origin = originOf(page);
    const content = (selector: string) =>
      page
        .locator(`head meta[${selector}]`)
        .evaluateAll((els) => els.map((el) => el.getAttribute('content') ?? ''));

    expect(await content('property="og:type"')).toEqual(['article']);
    expect(await content('property="og:url"')).toEqual([`${origin}/blog/${LONG_SLUG}`]);
    expect(await content('property="og:title"')).toEqual(['긴 글 SEO 제목']);
    sameInstant((await content('property="article:published_time"'))[0], post.publishedAt);
    sameInstant((await content('property="article:modified_time"'))[0], post.updatedAt);
    expect(await content('property="og:image"')).toEqual([`${origin}${post.coverImageUrl}`]);
    expect(await content('name="twitter:card"')).toEqual(['summary_large_image']);
    expect(await content('name="twitter:image"')).toEqual([`${origin}${post.coverImageUrl}`]);
  });

  test('커버가 없으면 og:image 없이 Twitter 카드는 summary다', async ({ page }) => {
    await openPost(page, NO_COVER_SLUG);
    await expect(page.locator('head meta[property="og:image"]')).toHaveCount(0);
    await expect(page.locator('head meta[name="twitter:image"]')).toHaveCount(0);
    await expect(page.locator('head meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary',
    );
    await expect(page.locator('head meta[property="og:type"]')).toHaveAttribute(
      'content',
      'article',
    );
  });

  test('JSON-LD BlogPosting: 파싱되고 필수 필드가 있으며 author는 없다', async ({ page }) => {
    await openPost(page, LONG_SLUG);
    const post = postBySlug(LONG_SLUG);
    const origin = originOf(page);
    const url = `${origin}/blog/${LONG_SLUG}`;
    const items = await readJsonLd(page);

    const posting = items.find((item) => item['@type'] === 'BlogPosting');
    expect(posting).toBeDefined();
    expect(posting?.headline).toBe(post.title);
    expect(posting?.description).toBe(post.seoDescription);
    sameInstant(posting?.datePublished as string, post.publishedAt);
    sameInstant(posting?.dateModified as string, post.updatedAt);
    expect([posting?.image].flat()).toEqual([`${origin}${post.coverImageUrl}`]);
    expect(posting?.url).toBe(url);
    const main = posting?.mainEntityOfPage;
    expect(typeof main === 'string' ? main : (main as { '@id': string })['@id']).toBe(url);
    expect('author' in (posting ?? {})).toBe(false);
  });

  test('JSON-LD BreadcrumbList: Home → Blog → 글 제목', async ({ page }) => {
    await openPost(page, LONG_SLUG);
    const post = postBySlug(LONG_SLUG);
    const origin = originOf(page);
    const url = `${origin}/blog/${LONG_SLUG}`;
    const items = await readJsonLd(page);
    const crumbs = items.find((item) => item['@type'] === 'BreadcrumbList');
    const list = (crumbs?.itemListElement ?? []) as Array<Record<string, unknown>>;
    expect(list.map((c) => c.position)).toEqual([1, 2, 3]);
    expect(list.map((c) => c.name)).toEqual(['Home', 'Blog', post.title]);
    expect(list.map((c) => c.item)).toEqual([`${origin}/`, `${origin}/blog`, url]);
  });

  test('커버가 없는 글의 BlogPosting에는 image가 없다', async ({ page }) => {
    await openPost(page, NO_COVER_SLUG);
    const text = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((els) => els.map((el) => el.textContent ?? '').join('\n'));
    expect(text).toContain('BlogPosting');
    expect(text).not.toContain('"image"');
  });

  test('제목에 </script>가 있어도 스크립트를 탈출하지 않고 제목은 글자 그대로 보인다', async ({
    page,
    request,
  }) => {
    const html = await (await request.get(`/blog/${SCRIPT_TITLE_SLUG}`)).text();
    expect(html).not.toContain('<script>window.__pwned');
    expect(html).not.toContain(SCRIPT_TITLE);

    await openPost(page, SCRIPT_TITLE_SLUG);
    expect(
      await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned),
    ).toBeUndefined();
    await expect(page.locator('h1')).toHaveText(SCRIPT_TITLE);
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).not.toContain('<');
    expect(JSON.stringify(JSON.parse(ld ?? 'null'))).toContain('window.__pwned');
  });

  test('루트 title 기본값은 jblog이고 목록 title에도 템플릿이 적용된다', async ({ page }) => {
    await page.goto('/');
    expect(await page.title()).toBe('jblog');
    await page.goto('/blog');
    expect(await page.title()).toMatch(/ \| jblog$/);
  });
});

test.describe('목록 canonical (page 제외)', () => {
  const cases: Array<[string, string]> = [
    ['/blog', '/blog'],
    ['/blog?page=2', '/blog'],
    ['/blog?category=backend', '/blog?category=backend'],
    ['/blog?category=backend&page=2', '/blog?category=backend'],
    ['/blog?tag=nextjs', '/blog?tag=nextjs'],
    ['/blog?tag=nextjs&page=2', '/blog?tag=nextjs'],
  ];
  for (const [path, canonical] of cases) {
    test(`${path} → ${canonical}`, async ({ page }) => {
      await page.goto(path);
      const origin = new URL(page.url()).origin;
      await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${origin}${canonical}`,
      );
    });
  }
});
