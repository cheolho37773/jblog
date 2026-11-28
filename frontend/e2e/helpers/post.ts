import { expect, type Locator, type Page } from '@playwright/test';
import { DETAIL_ONLY_POSTS, INTERNAL_POSTS } from '../fixtures/server';
import { openBlog } from './blog';
import type { Theme } from './theme';

// M2-08 `/blog/[slug]` E2E 공용 도구. 구현자가 지킬 DOM 계약은 지시서 인계 노트 "① 테스트 선작성"에 있다.

export const FIXTURE_API_ORIGIN = 'http://localhost:4100';
export const NOT_FOUND_TEXT = '페이지를 찾을 수 없습니다';
export const TOLERANCE = 1;

/** 목록 글 + 상세 전용 글. */
export const ALL_POSTS = [...INTERNAL_POSTS, ...DETAIL_ONLY_POSTS];
export const postBySlug = (slug: string) => {
  const post = ALL_POSTS.find((candidate) => candidate.slug === slug);
  if (!post) throw new Error(`픽스처에 없는 slug: ${slug}`);
  return post;
};

// 모든 요소(prev·next·태그·카테고리·커버)가 있는 글. 이웃 2개, 관련 글 2개.
export const FULL_SLUG = 'tailwind-design-tokens';
// 가장 최신 글(next 없음), 가장 오래된 글(prev 없음·카테고리 없음·태그 없음·관련 글 0개).
export const NEWEST_SLUG = INTERNAL_POSTS[0]?.slug ?? '';
export const OLDEST_SLUG = INTERNAL_POSTS[INTERNAL_POSTS.length - 1]?.slug ?? '';

export const articleRoot = (page: Page): Locator => page.locator('main article').first();
export const postBody = (page: Page): Locator => page.getByTestId('post-body');
export const postCover = (page: Page): Locator => page.getByTestId('post-cover');
export const postMeta = (page: Page): Locator => page.getByTestId('post-meta');
export const relatedSection = (page: Page): Locator => page.getByTestId('related-posts');
export const tagNav = (page: Page): Locator => page.getByRole('navigation', { name: '태그' });
export const postNav = (page: Page): Locator =>
  page.getByRole('navigation', { name: '이전·다음 글' });
export const tocNav = (page: Page): Locator => page.getByRole('navigation', { name: '목차' });

export const openPost = (
  page: Page,
  slug: string,
  view: { theme?: Theme; size?: { width: number; height: number } } = {},
) => openBlog(page, `/blog/${slug}`, view);

export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

export async function boxOf(locator: Locator): Promise<Box> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: r.top + window.scrollY,
      bottom: r.bottom + window.scrollY,
      left: r.left,
      right: r.right,
      width: r.width,
      height: r.height,
    };
  });
}

/** 보이는 영역 기준 사각형(스크롤 보정 없음). */
export async function viewportBoxOf(locator: Locator): Promise<Box> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      width: r.width,
      height: r.height,
    };
  });
}

export const viewportWidth = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.clientWidth);

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(overflow.page).toBeLessThanOrEqual(0);
  expect(overflow.body).toBeLessThanOrEqual(0);
}

export interface Meta {
  title: string;
  description: string | null;
  canonical: string | null;
  property: Record<string, string[]>;
  name: Record<string, string[]>;
}

/** head의 title·description·canonical·og:*·article:*·twitter:*를 읽는다. */
export async function readMeta(page: Page): Promise<Meta> {
  return page.evaluate(() => {
    const collect = (attr: 'property' | 'name') => {
      const out: Record<string, string[]> = {};
      for (const el of document.head.querySelectorAll(`meta[${attr}]`)) {
        const key = el.getAttribute(attr) ?? '';
        (out[key] ??= []).push(el.getAttribute('content') ?? '');
      }
      return out;
    };
    return {
      title: document.title,
      description:
        document.head.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
      canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
      property: collect('property'),
      name: collect('name'),
    };
  });
}

type JsonObject = Record<string, unknown>;

/** `<script type="application/ld+json">`를 모두 파싱해 객체 목록으로 편다(배열·@graph 포함). */
export async function readJsonLd(page: Page): Promise<JsonObject[]> {
  const texts = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((els) => els.map((el) => el.textContent ?? ''));
  const flat: JsonObject[] = [];
  for (const text of texts) {
    const parsed = JSON.parse(text) as unknown;
    for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
      const object = item as JsonObject;
      const graph = object['@graph'];
      if (Array.isArray(graph)) flat.push(...(graph as JsonObject[]));
      else flat.push(object);
    }
  }
  return flat;
}

export const jsonLdOfType = (items: JsonObject[], type: string) =>
  items.find((item) => item['@type'] === type);
