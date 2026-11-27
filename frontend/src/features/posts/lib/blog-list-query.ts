type RawValue = string | string[] | undefined;

type RawBlogQuery = { category?: RawValue; tag?: RawValue; page?: RawValue };

export type BlogQuery = { category?: string; tag?: string; page: number };

const FIRST_PAGE = 1;
const POSITIVE_INTEGER = /^\d+$/;

// 같은 키가 여러 번 오면 첫 값만 쓰고, 빈 문자열은 값이 없는 것으로 본다.
function firstValue(raw: RawValue): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? value : undefined;
}

function parsePage(raw: RawValue): number {
  const value = firstValue(raw);
  if (value === undefined || !POSITIVE_INTEGER.test(value)) return FIRST_PAGE;
  return Math.max(Number(value), FIRST_PAGE);
}

/** `/blog` 쿼리를 정규화한다. `tag`가 있으면 `category`는 버린다(필터는 하나만). */
export function parseBlogQuery(raw: RawBlogQuery): BlogQuery {
  const page = parsePage(raw.page);
  const tag = firstValue(raw.tag);
  if (tag) return { tag, page };

  const category = firstValue(raw.category);
  return category ? { category, page } : { page };
}

/** 마지막 페이지를 넘는 값은 마지막으로 줄인다. 글이 0개여도 1페이지다. */
export function clampPage(page: number, totalPages: number): number {
  return Math.min(page, Math.max(totalPages, FIRST_PAGE));
}

const BLOG_PATH = '/blog';

/**
 * 목록 canonical 경로. 필터(tag 또는 category)만 남기고 page는 뺀다: 같은 목록의 n페이지를 별도 문서로 보지 않게 한다.
 */
export function blogCanonicalPath({ tag, category }: BlogQuery): string {
  if (tag) return `${BLOG_PATH}?${new URLSearchParams({ tag })}`;
  if (category) return `${BLOG_PATH}?${new URLSearchParams({ category })}`;
  return BLOG_PATH;
}
