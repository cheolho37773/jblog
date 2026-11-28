import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { SEARCH_CALLS_PATH } from '../fixtures/server';

// M2-09 `/search`·Home E2E 공용 도구. 구현자가 지킬 DOM 계약은 지시서 인계 노트 "① 테스트 선작성"에 있다.

export const FIXTURE_API = 'http://localhost:4100';
export const SEARCH_GRID_SELECTOR = 'ul[aria-label="검색 결과"]';
export const HOME_GRID_SELECTOR = 'ul[aria-label="최신 글"]';
export const SHORT_QUERY_GUIDE = '검색어를 2자 이상 입력해 주세요.';
export const OVERFLOW_NOTICE = '상위 50개만 보여 줍니다. 검색어를 더 구체적으로 입력해 보세요.';
export const SERVER_ERROR_TEXT = '문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
export const SEARCH_LIMIT = 50;
export const HOME_LATEST_COUNT = 6;

export const noResultText = (q: string) => `'${q}'에 대한 검색 결과가 없습니다.`;
export const resultCountText = (count: number) => `검색 결과 ${count}개`;
export const searchPath = (q: string) => `/search?q=${encodeURIComponent(q)}`;

export const searchGridCards = (page: Page): Locator =>
  page.locator(`${SEARCH_GRID_SELECTOR} > li`);
export const homeGridCards = (page: Page): Locator => page.locator(`${HOME_GRID_SELECTOR} > li`);

async function hrefsOf(cards: Locator): Promise<string[]> {
  return cards
    .locator('a')
    .evaluateAll((links) => links.map((a) => (a.getAttribute('href') ?? '').replace('/blog/', '')));
}
export const searchSlugs = (page: Page) => hrefsOf(searchGridCards(page));
export const homeSlugs = (page: Page) => hrefsOf(homeGridCards(page));

/** 픽스처 서버가 센 검색 API 호출 수(서버 컴포넌트가 직접 부르므로 브라우저에서는 보이지 않는다). */
export async function searchCallsFor(request: APIRequestContext, q: string): Promise<number> {
  const response = await request.get(
    `${FIXTURE_API}${SEARCH_CALLS_PATH}?q=${encodeURIComponent(q)}`,
  );
  return ((await response.json()) as { count: number }).count;
}

/** 앞뒤 공백을 뺀 길이가 2 미만인 검색어로 들어온 호출 수. */
export async function rejectedSearchCalls(request: APIRequestContext): Promise<number> {
  const response = await request.get(`${FIXTURE_API}${SEARCH_CALLS_PATH}`);
  return ((await response.json()) as { rejected: number }).rejected;
}

export async function overflowOf(page: Page) {
  return page.evaluate(() => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.documentElement.clientWidth,
  }));
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await overflowOf(page);
  expect(overflow.page).toBeLessThanOrEqual(0);
  expect(overflow.body).toBeLessThanOrEqual(0);
}

/** 그리드 아이템의 열 수와 열·행 간격. */
export async function gridLayoutOf(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const items = [...document.querySelectorAll(`${sel} > li`)].map((li) => {
      const r = li.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    });
    const first = items[0];
    if (!first) return { count: 0, columns: 0, columnGap: NaN, rowGap: NaN };
    const columns = items.filter((item) => Math.abs(item.top - first.top) < 1).length;
    const second = items[1];
    const nextRow = items[columns];
    return {
      count: items.length,
      columns,
      columnGap: columns > 1 && second ? second.left - first.right : NaN,
      rowGap: nextRow ? nextRow.top - first.bottom : NaN,
    };
  }, selector);
}
