import { describe, expect, it } from 'vitest';

/**
 * M2-07 ① 단계: `/blog` 쿼리 정규화 순수 함수 계약 (구현 전 작성, 동적 import).
 * 구현자가 만들 모듈: `features/posts/lib/blog-list-query.ts`
 *   parseBlogQuery(searchParams) -> { category?: string; tag?: string; page: number }
 *   clampPage(page, totalPages) -> number
 */

type RawValue = string | string[] | undefined;
type RawQuery = { category?: RawValue; tag?: RawValue; page?: RawValue };
type Parsed = { category?: string; tag?: string; page: number };

async function load() {
  const path = './blog-list-query';
  return (await import(/* @vite-ignore */ path)) as {
    parseBlogQuery: (raw: RawQuery) => Parsed;
    clampPage: (page: number, totalPages: number) => number;
  };
}

describe('parseBlogQuery: category·tag', () => {
  it('쿼리가 없으면 필터 없이 1페이지다', async () => {
    const { parseBlogQuery } = await load();
    const result = parseBlogQuery({});
    expect(result.page).toBe(1);
    expect(result.category).toBeUndefined();
    expect(result.tag).toBeUndefined();
  });

  it('category만 오면 category를 쓴다', async () => {
    const { parseBlogQuery } = await load();
    expect(parseBlogQuery({ category: 'backend' })).toMatchObject({ category: 'backend', page: 1 });
  });

  it('tag만 오면 tag를 쓴다', async () => {
    const { parseBlogQuery } = await load();
    const result = parseBlogQuery({ tag: 'nextjs' });
    expect(result).toMatchObject({ tag: 'nextjs', page: 1 });
    expect(result.category).toBeUndefined();
  });

  it('category와 tag가 함께 오면 tag가 우선하고 category는 무시한다', async () => {
    const { parseBlogQuery } = await load();
    const result = parseBlogQuery({ category: 'backend', tag: 'nextjs' });
    expect(result.tag).toBe('nextjs');
    expect(result.category).toBeUndefined();
  });

  it('빈 문자열 tag는 없는 것으로 보고 category를 쓴다', async () => {
    const { parseBlogQuery } = await load();
    const result = parseBlogQuery({ category: 'backend', tag: '' });
    expect(result.category).toBe('backend');
    expect(result.tag).toBeUndefined();
  });

  it('빈 문자열 category는 없는 것으로 본다', async () => {
    const { parseBlogQuery } = await load();
    expect(parseBlogQuery({ category: '' }).category).toBeUndefined();
  });

  it('같은 키가 여러 번 오면(배열) 첫 값을 쓴다', async () => {
    const { parseBlogQuery } = await load();
    expect(parseBlogQuery({ category: ['backend', 'frontend'], page: ['2', '3'] })).toMatchObject({
      category: 'backend',
      page: 2,
    });
  });
});

describe('parseBlogQuery: page 보정', () => {
  const cases: [string, RawValue, number][] = [
    ['없으면', undefined, 1],
    ['"1"', '1', 1],
    ['"2"', '2', 2],
    ['"99"는 그대로(상한 보정은 clampPage가 한다)', '99', 99],
    ['"0"은 1로', '0', 1],
    ['"-1"은 1로', '-1', 1],
    ['"abc"는 1로', 'abc', 1],
    ['"2.5"는 1로', '2.5', 1],
    ['"1e2"는 1로', '1e2', 1],
    ['빈 문자열은 1로', '', 1],
    ['"2abc"는 1로', '2abc', 1],
  ];
  for (const [label, raw, expected] of cases) {
    it(`page가 ${label} → ${expected}`, async () => {
      const { parseBlogQuery } = await load();
      expect(parseBlogQuery({ page: raw }).page).toBe(expected);
    });
  }
});

describe('clampPage', () => {
  const cases: [number, number, number][] = [
    [1, 2, 1],
    [2, 2, 2],
    [3, 2, 2],
    [99, 2, 2],
    [5, 0, 1],
    [1, 0, 1],
    [99, 1, 1],
  ];
  for (const [page, totalPages, expected] of cases) {
    it(`page ${page}, totalPages ${totalPages} → ${expected} (글이 0개면 1)`, async () => {
      const { clampPage } = await load();
      expect(clampPage(page, totalPages)).toBe(expected);
    });
  }
});
