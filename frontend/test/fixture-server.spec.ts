// @vitest-environment node
import type { AddressInfo } from 'node:net';
import type http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { components } from '../src/generated/api-types';
import {
  CACHE_CONTROL,
  COVER_FILES,
  FEATURED_SLUG,
  MISSING_SLUG,
  OLD_SLUG,
  OLD_SLUG_TARGET,
  CALLS_PATH,
  CALL_PROBE_PREFIX,
  DETAIL_ONLY_POSTS,
  LONG_SLUG,
  NO_COVER_SLUG,
  NO_HEADINGS_SLUG,
  SERVER_ERROR_POST_SLUG,
  UNAUTHORIZED_POST_SLUG,
  SLOW_CATEGORIES,
  BULK_SEARCH_COUNT,
  BULK_SEARCH_QUERY,
  EXCERPT_ONLY_QUERY,
  EXCERPT_ONLY_SLUG,
  EXCERPT_ONLY_TITLE,
  INTERNAL_POSTS,
  NO_RESULT_QUERY,
  SEARCH_CALLS_PATH,
  SEARCH_ERROR_QUERY,
  createFixtureServer,
  validatorLength,
} from '../e2e/fixtures/server';

// 픽스처 API 서버 자체 테스트 (M2-E 동작 규약 1). E2E의 데이터 원천이 계약(백엔드 §4.1·§4.2·§4.5·§5.7-①)과 어긋나지 않는지 본다.
// 더미 키. 비밀이 아니다.
const KEY = 'unit-test-internal-key-not-secret';
const MIN_PUBLISHED_POSTS = 12;
const MIN_CATEGORIES = 6;

type Schemas = components['schemas'];

let server: http.Server;
let base: string;

beforeAll(async () => {
  server = createFixtureServer(KEY);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const get = (path: string, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { headers, redirect: 'manual' });

async function getJson<T>(path: string, headers: Record<string, string> = {}) {
  const res = await get(path, headers);
  return { res, body: (await res.json()) as T };
}

describe('GET /api/posts', () => {
  it('목록 형식(items·page·size·totalItems·totalPages)과 공용 캐시 헤더를 준다', async () => {
    const { res, body } = await getJson<Schemas['PostListResponseDto']>('/api/posts');

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=60, stale-while-revalidate=300');
    expect(body.page).toBe(1);
    expect(body.size).toBe(9);
    expect(body.items).toHaveLength(9);
    expect(body.totalItems).toBeGreaterThanOrEqual(MIN_PUBLISHED_POSTS);
    expect(body.totalPages).toBe(Math.ceil(body.totalItems / 9));
  });

  it('발행 글은 12개 이상이고 최신순이다. 목록에는 원문과 버전이 없다', async () => {
    const { body } = await getJson<Schemas['PostListResponseDto']>('/api/posts?size=50');

    expect(body.items.length).toBeGreaterThanOrEqual(MIN_PUBLISHED_POSTS);
    const dates = body.items.map((item) => item.publishedAt);
    expect(dates).toEqual([...dates].sort().reverse());
    for (const item of body.items) {
      expect(item).not.toHaveProperty('contentMd');
      expect(item).not.toHaveProperty('version');
    }
  });

  it('page·size로 나눈 페이지가 서로 겹치지 않고 합치면 전체가 된다', async () => {
    const all = await getJson<Schemas['PostListResponseDto']>('/api/posts?size=50');
    const first = await getJson<Schemas['PostListResponseDto']>('/api/posts?page=1&size=5');
    const second = await getJson<Schemas['PostListResponseDto']>('/api/posts?page=2&size=5');
    const last = await getJson<Schemas['PostListResponseDto']>(
      `/api/posts?page=${first.body.totalPages}&size=5`,
    );

    expect(first.body.items).toHaveLength(5);
    expect(second.body.page).toBe(2);
    const slugs = [...first.body.items, ...second.body.items].map((item) => item.slug);
    expect(new Set(slugs).size).toBe(10);
    expect(slugs).toEqual(all.body.items.slice(0, 10).map((item) => item.slug));
    expect(last.body.items.length).toBe(all.body.totalItems - 5 * (first.body.totalPages - 1));
  });

  it('범위를 넘는 page는 빈 items이고 totalItems는 그대로다', async () => {
    const { res, body } = await getJson<Schemas['PostListResponseDto']>('/api/posts?page=99');

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.totalItems).toBeGreaterThanOrEqual(MIN_PUBLISHED_POSTS);
  });

  it('category 필터는 그 카테고리 글만 돌려주고 총 개수는 카테고리의 postCount와 같다', async () => {
    const categories = (await getJson<Schemas['CategoryWithCountDto'][]>('/api/categories')).body;
    const backend = categories.find((c) => c.slug === 'backend');

    const { body } = await getJson<Schemas['PostListResponseDto']>(
      '/api/posts?category=backend&size=50',
    );

    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((item) => item.category?.slug === 'backend')).toBe(true);
    expect(body.totalItems).toBe(backend?.postCount);
  });

  it('tag 필터는 그 태그가 달린 글만 돌려준다', async () => {
    const tags = (await getJson<Schemas['TagWithCountDto'][]>('/api/tags')).body;
    const nextjs = tags.find((t) => t.slug === 'nextjs');

    const { body } = await getJson<Schemas['PostListResponseDto']>('/api/posts?tag=nextjs&size=50');

    expect(body.totalItems).toBe(nextjs?.postCount);
    expect(body.totalItems).toBeGreaterThan(0);
  });

  it('featured=true는 featured 글 1개만 돌려준다', async () => {
    const { body } = await getJson<Schemas['PostListResponseDto']>('/api/posts?featured=true');

    expect(body.items.map((item) => item.slug)).toEqual([FEATURED_SLUG]);
  });

  it('없는 카테고리 필터는 빈 목록이다(404가 아니다)', async () => {
    const { res, body } = await getJson<Schemas['PostListResponseDto']>('/api/posts?category=nope');

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.totalItems).toBe(0);
  });

  it.each(['page=0', 'page=abc', 'size=0', 'size=51', 'featured=maybe'])(
    '잘못된 쿼리 %s는 400 VALIDATION_FAILED(공통 에러 형식)이다',
    async (query) => {
      const { res, body } = await getJson<Schemas['ErrorResponseDto']>(`/api/posts?${query}`);

      expect(res.status).toBe(400);
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.statusCode).toBe(400);
      expect(body.path).toBe('/api/posts');
      expect(typeof body.timestamp).toBe('string');
    },
  );
});

describe('GET /api/posts/{slug}', () => {
  it('메타데이터와 prev·next·related(최대 3)를 주고 contentMd·version은 없다', async () => {
    const { res, body } = await getJson<Schemas['PostDetailResponseDto']>(
      `/api/posts/${FEATURED_SLUG}`,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(CACHE_CONTROL.public);
    expect(body.post.slug).toBe(FEATURED_SLUG);
    expect(body.post.isFeatured).toBe(true);
    expect(body.post.tags.length).toBeGreaterThan(0);
    expect(body.post).not.toHaveProperty('contentMd');
    expect(body.post).not.toHaveProperty('version');
    expect(body.related.length).toBeLessThanOrEqual(3);
    expect(body.related.every((r) => r.slug !== FEATURED_SLUG)).toBe(true);
  });

  it('prev는 더 오래된 글, next는 더 최근 글이다. 가장자리 글은 null이다', async () => {
    const all = (await getJson<Schemas['PostListResponseDto']>('/api/posts?size=50')).body.items;
    const middle = all[3]!;
    const newest = all[0]!;
    const oldest = all[all.length - 1]!;

    const mid = (await getJson<Schemas['PostDetailResponseDto']>(`/api/posts/${middle.slug}`)).body;
    const top = (await getJson<Schemas['PostDetailResponseDto']>(`/api/posts/${newest.slug}`)).body;
    const bottom = (await getJson<Schemas['PostDetailResponseDto']>(`/api/posts/${oldest.slug}`))
      .body;

    expect(mid.next?.slug).toBe(all[2]!.slug);
    expect(mid.prev?.slug).toBe(all[4]!.slug);
    expect(top.next).toBeNull();
    expect(bottom.prev).toBeNull();
  });

  it('이전 slug는 301과 새 slug의 Location을 준다', async () => {
    const res = await get(`/api/posts/${OLD_SLUG}`);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(`/api/posts/${OLD_SLUG_TARGET}`);
  });

  it('없는 slug는 404 POST_NOT_FOUND이다', async () => {
    const { res, body } = await getJson<Schemas['ErrorResponseDto']>(`/api/posts/${MISSING_SLUG}`);

    expect(res.status).toBe(404);
    expect(body.code).toBe('POST_NOT_FOUND');
  });
});

describe('GET /api/categories · /api/tags', () => {
  it('카테고리는 6개 이상이고 각 글 수의 합은 분류된 글 수와 같다', async () => {
    const { res, body } = await getJson<Schemas['CategoryWithCountDto'][]>('/api/categories');
    const all = (await getJson<Schemas['PostListResponseDto']>('/api/posts?size=50')).body.items;

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(CACHE_CONTROL.public);
    // 지연 카테고리(칩 전환 중 스켈레톤 시험용, postCount 1)는 실제 글에 연결돼 있지 않아 글 수 규칙에서 따로 본다.
    const slowSlugs = SLOW_CATEGORIES.map((c) => c.slug);
    const real = body.filter((c) => !slowSlugs.includes(c.slug));
    expect(body.filter((c) => slowSlugs.includes(c.slug)).map((c) => c.slug)).toEqual(slowSlugs);
    expect(real.length).toBeGreaterThanOrEqual(MIN_CATEGORIES);
    expect(real.reduce((sum, c) => sum + c.postCount, 0)).toBe(
      all.filter((p) => p.category).length,
    );
  });

  it('태그는 여러 개이고 postCount가 모두 1 이상이다', async () => {
    const { res, body } = await getJson<Schemas['TagWithCountDto'][]>('/api/tags');

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(CACHE_CONTROL.public);
    expect(body.length).toBeGreaterThanOrEqual(3);
    expect(body.every((t) => t.postCount >= 1)).toBe(true);
  });
});

describe('GET /api/search', () => {
  it('검색은 짧은 캐시 헤더(public, max-age=30)로 목록 형식을 준다', async () => {
    const { res, body } = await getJson<Schemas['PostListResponseDto']>('/api/search?q=Next.js');

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=30');
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.totalItems).toBeGreaterThan(0);
  });

  it('제목이 일치하는 글이 먼저 나온다', async () => {
    const { body } = await getJson<Schemas['PostListResponseDto']>(
      `/api/search?q=${encodeURIComponent('Docker')}`,
    );

    expect(body.items[0]?.title).toContain('Docker');
  });

  it('일치하는 글이 없으면 빈 목록이다', async () => {
    const { res, body } = await getJson<Schemas['PostListResponseDto']>('/api/search?q=zzzzzz');

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
  });

  it.each(['', '?q=', '?q=a'])('q가 2자 미만(%j)이면 400 VALIDATION_FAILED이다', async (query) => {
    const { res, body } = await getJson<Schemas['ErrorResponseDto']>(`/api/search${query}`);

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });
});

describe('GET /internal/posts/{slug}', () => {
  const withKey = { 'X-Internal-Key': KEY };

  it('키가 맞으면 메타와 원문·버전을 한 응답으로 주고 private, no-store이다', async () => {
    const { res, body } = await getJson<Schemas['InternalPostResponseDto']>(
      `/internal/posts/${FEATURED_SLUG}`,
      withKey,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(body.post.slug).toBe(FEATURED_SLUG);
    expect(typeof body.post.version).toBe('number');
    expect(body.related.length).toBeLessThanOrEqual(3);
  });

  it('본문에 h2·h3, 코드 블록, 콜아웃, 이미지 캡션이 있다', async () => {
    const { body } = await getJson<Schemas['InternalPostResponseDto']>(
      `/internal/posts/${FEATURED_SLUG}`,
      withKey,
    );
    const md = body.post.contentMd;

    expect(md).toMatch(/^## /m);
    expect(md).toMatch(/^### /m);
    expect(md).toContain('```');
    expect(md).toContain('[!NOTE]');
    expect(md).toMatch(/!\[[^\]]*\]\([^)]+ "[^"]+"\)/);
  });

  it.each([
    ['키가 없으면', {}],
    ['키가 틀리면', { 'X-Internal-Key': 'wrong-key-dummy' }],
    ['키가 빈 값이면', { 'X-Internal-Key': '' }],
  ])('%s 401 UNAUTHORIZED이고 본문에 키 값이 없다', async (_name, headers) => {
    const res = await get(`/internal/posts/${FEATURED_SLUG}`, headers);
    const text = await res.text();

    expect(res.status).toBe(401);
    expect(JSON.parse(text).code).toBe('UNAUTHORIZED');
    expect(text).not.toContain(KEY);
  });

  it('키가 틀리면 이전 slug·없는 slug도 401이다(존재 여부를 알려주지 않는다)', async () => {
    const wrong = { 'X-Internal-Key': 'wrong-key-dummy' };

    expect((await get(`/internal/posts/${OLD_SLUG}`, wrong)).status).toBe(401);
    expect((await get(`/internal/posts/${MISSING_SLUG}`, wrong)).status).toBe(401);
  });

  it('이전 slug면 200과 { redirectTo }(새 slug)를 준다', async () => {
    const { res, body } = await getJson<Schemas['InternalPostRedirectDto']>(
      `/internal/posts/${OLD_SLUG}`,
      withKey,
    );

    expect(res.status).toBe(200);
    expect(body).toEqual({ redirectTo: OLD_SLUG_TARGET });
  });

  it('없는 slug는 404 POST_NOT_FOUND이다', async () => {
    const { res, body } = await getJson<Schemas['ErrorResponseDto']>(
      `/internal/posts/${MISSING_SLUG}`,
      withKey,
    );

    expect(res.status).toBe(404);
    expect(body.code).toBe('POST_NOT_FOUND');
  });

  it('/api/internal/* 경로는 없다(404)', async () => {
    const res = await get(`/api/internal/posts/${FEATURED_SLUG}`, withKey);

    expect(res.status).toBe(404);
  });
});

describe('/uploads/*', () => {
  it.each(COVER_FILES)('커버 이미지 %s는 PNG이고 불변 캐시 헤더로 나간다', async (file) => {
    const res = await get(`/uploads/fixtures/${file}`);
    const bytes = new Uint8Array(await res.arrayBuffer());

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect([...bytes.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]); // "PNG"
  });

  it('모든 글의 coverImageUrl이 실제로 열린다', async () => {
    const all = (await getJson<Schemas['PostListResponseDto']>('/api/posts?size=50')).body.items;

    for (const item of all) {
      expect(item.coverImageUrl).toMatch(/^\/uploads\//);
      expect((await get(item.coverImageUrl as string)).status).toBe(200);
    }
  });

  it.each([
    '/uploads/fixtures/none.png',
    '/uploads/fixtures/../server.ts',
    '/uploads/fixtures/%2e%2e%2fserver.ts',
  ])('없는 파일·상위 경로(%s)는 404이다', async (path) => {
    expect((await get(path)).status).toBe(404);
  });
});

describe('그 밖의 요청', () => {
  it('GET이 아니면 405이다', async () => {
    const res = await fetch(`${base}/api/posts`, { method: 'POST' });

    expect(res.status).toBe(405);
  });

  it('흉내 내지 않는 경로는 공통 에러 형식의 404이다', async () => {
    const { res, body } = await getJson<Schemas['ErrorResponseDto']>('/api/unknown');

    expect(res.status).toBe(404);
    expect(body.statusCode).toBe(404);
  });

  it('상태 확인 경로 /__fixture/health가 200이다', async () => {
    expect((await get('/__fixture/health')).status).toBe(200);
  });
});

describe('잘못된 URL 인코딩', () => {
  const MALFORMED_PATHS = ['/api/posts/%', '/internal/posts/%'];

  it.each(MALFORMED_PATHS)('%s는 공통 에러 형식의 400이다', async (path) => {
    const { res, body } = await getJson<Schemas['ErrorResponseDto']>(path, {
      'x-internal-key': KEY,
    });

    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      path,
    });
    expect(typeof body.message).toBe('string');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it('잘못된 인코딩 요청 뒤에도 서버가 살아 있어 정상 요청이 200이다', async () => {
    for (const path of MALFORMED_PATHS) await get(path, { 'x-internal-key': KEY });

    expect((await get('/api/posts')).status).toBe(200);
    expect((await get(`/api/posts/${FEATURED_SLUG}`)).status).toBe(200);
  });
});

describe('상세 전용 글·호출 수 기록 (M2-08)', () => {
  const withKey = { 'X-Internal-Key': KEY };
  const internal = (slug: string) =>
    getJson<Schemas['InternalPostResponseDto']>(`/internal/posts/${slug}`, withKey);

  it('상세 전용 글은 내부 API로 열리고 목록·공개 API에는 없다', async () => {
    for (const post of DETAIL_ONLY_POSTS) {
      const { res, body } = await internal(post.slug);
      expect(res.status).toBe(200);
      expect(body.post.slug).toBe(post.slug);
      expect((await get(`/api/posts/${post.slug}`)).status).toBe(404);
    }
    const list = await getJson<Schemas['PostListResponseDto']>('/api/posts?size=50');
    const listed = list.body.items.map((item) => item.slug);
    expect(DETAIL_ONLY_POSTS.some((post) => listed.includes(post.slug))).toBe(false);
  });

  it('커버 없는 글은 커버·이웃이 없고 같은 카테고리 관련 글이 3개다', async () => {
    const { body } = await internal(NO_COVER_SLUG);
    expect(body.post.coverImageUrl).toBeNull();
    expect(body.prev).toBeNull();
    expect(body.next).toBeNull();
    expect(body.related).toHaveLength(3);
  });

  it('헤딩 없는 글은 본문에 헤딩이 없고, 긴 글은 h2 5개·h3 1개다', async () => {
    const plain = (await internal(NO_HEADINGS_SLUG)).body.post;
    expect(plain.contentMd).not.toMatch(/^#/m);
    expect(plain.category).toBeNull();
    expect(plain.tags).toEqual([]);
    const long = (await internal(LONG_SLUG)).body.post.contentMd;
    expect(long.match(/^## /gm)).toHaveLength(5);
    expect(long.match(/^### /gm)).toHaveLength(1);
  });

  it('접두사 slug는 어떤 값이든 열리고, 오류 시험용 slug는 500·401이다', async () => {
    expect((await internal(`${CALL_PROBE_PREFIX}abc`)).body.post.slug).toBe(
      `${CALL_PROBE_PREFIX}abc`,
    );
    expect((await get(`/internal/posts/${SERVER_ERROR_POST_SLUG}`, withKey)).status).toBe(500);
    expect((await get(`/internal/posts/${UNAUTHORIZED_POST_SLUG}`, withKey)).status).toBe(401);
  });

  it('내부 API 호출 수를 slug별로 센다(공개 API는 세지 않는다)', async () => {
    const slug = `${CALL_PROBE_PREFIX}count`;
    const countOf = async () =>
      (await getJson<{ count: number }>(`${CALLS_PATH}?slug=${slug}`)).body.count;
    expect(await countOf()).toBe(0);
    await internal(slug);
    await internal(slug);
    await get('/api/posts');
    expect(await countOf()).toBe(2);
  });
});

describe('검색 시험 사례·seoTitle (M2-09)', () => {
  type SearchList = Schemas['PostListResponseDto'];
  const search = (q: string, extra = '') =>
    getJson<SearchList>(`/api/search?q=${encodeURIComponent(q)}${extra}`);

  it('seoTitle에는 사이트 이름(`| jblog`)이 없다 — title 템플릿이 한 번만 붙인다', async () => {
    const withSeo = INTERNAL_POSTS.filter((post) => post.seoTitle !== null);
    expect(withSeo.length).toBeGreaterThan(0);
    for (const post of withSeo) expect(post.seoTitle).not.toContain('jblog');
  });

  it('제목 일치 글이 앞, 발췌문만 일치하는 글이 뒤다', async () => {
    const { body } = await search(EXCERPT_ONLY_QUERY);
    expect(body.items.map((item) => item.slug)).toEqual([FEATURED_SLUG, EXCERPT_ONLY_SLUG]);
    expect(body.items[1]?.title).toBe(EXCERPT_ONLY_TITLE);
    expect(body.totalItems).toBe(2);
  });

  it('검색 전용 글은 목록·카테고리 수에 나오지 않는다', async () => {
    const list = await getJson<SearchList>('/api/posts?size=50');
    expect(list.body.totalItems).toBe(INTERNAL_POSTS.length);
    expect(list.body.items.some((item) => item.slug === EXCERPT_ONLY_SLUG)).toBe(false);
    expect(list.body.items.every((item) => !item.slug.startsWith('fixture-search-'))).toBe(true);
  });

  it('50개를 넘는 검색어는 totalItems가 55이고 size=50이면 50개, 2페이지에 5개다', async () => {
    const first = await search(BULK_SEARCH_QUERY, '&size=50');
    expect(first.body.totalItems).toBe(BULK_SEARCH_COUNT);
    expect(first.body.items).toHaveLength(50);
    const second = await search(BULK_SEARCH_QUERY, '&size=50&page=2');
    expect(second.body.items).toHaveLength(BULK_SEARCH_COUNT - 50);
  });

  it('결과 없음 검색어는 빈 목록이다', async () => {
    const { res, body } = await search(NO_RESULT_QUERY);
    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.totalItems).toBe(0);
  });

  it('오류 시험 검색어는 500 INTERNAL_ERROR다', async () => {
    const { res, body } = await getJson<Schemas['ErrorResponseDto']>(
      `/api/search?q=${SEARCH_ERROR_QUERY}`,
    );
    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  it('검색 호출 수를 q별로 세고, 앞뒤 공백 뺀 길이 2 미만 호출은 rejected로 센다', async () => {
    const probe = `fixture-count-probe-${Date.now()}`;
    const read = async () =>
      (await getJson<{ total: number; rejected: number }>(SEARCH_CALLS_PATH)).body;
    const before = await read();
    expect((await getJson<{ count: number }>(`${SEARCH_CALLS_PATH}?q=${probe}`)).body.count).toBe(
      0,
    );

    await search(probe);
    await search(probe);
    await get('/api/search');
    await get('/api/search?q=a');
    await get(`/api/search?q=${encodeURIComponent('   ')}`);

    expect((await getJson<{ count: number }>(`${SEARCH_CALLS_PATH}?q=${probe}`)).body.count).toBe(
      2,
    );
    const after = await read();
    expect(after.total - before.total).toBe(5);
    expect(after.rejected - before.rejected).toBe(3);
  });
});

describe('검색 400 판정은 백엔드 minLength(2)와 같은 길이 계산이다 (Codex r1)', () => {
  // 기대값은 `backend/`의 class-validator `minLength(입력, 2)` 결과와 같다.
  const table: [string, boolean][] = [
    ['😀', false],
    ['❤️', false],
    ['a', false],
    ['😀😀', true],
    ['❤️❤️', true],
    ['가나', true],
    ['ab', true],
  ];
  for (const [q, accepted] of table) {
    it(`${JSON.stringify(q)} → ${accepted ? '200' : '400 VALIDATION_FAILED'}`, async () => {
      const res = await get(`/api/search?q=${encodeURIComponent(q)}`);
      expect(res.status).toBe(accepted ? 200 : 400);
    });
  }

  it('호출 수의 rejected도 같은 계산으로 센다(이모지 1자는 rejected, 2자는 아니다)', async () => {
    const read = async () => (await getJson<{ rejected: number }>(SEARCH_CALLS_PATH)).body.rejected;
    const before = await read();
    await get(`/api/search?q=${encodeURIComponent('😀')}`);
    expect((await read()) - before).toBe(1);
    await get(`/api/search?q=${encodeURIComponent('😀😀')}`);
    expect((await read()) - before).toBe(1);
  });
});

// 백엔드 class-validator `minLength(입력, 2)`와 같은 결과를 내는 표(대조: `backend/`에서 `node -e "console.log(require('class-validator').minLength(입력, 2))"`).
// 변형 선택자는 앞 글자와 붙은 시퀀스만 길이에서 빼므로 연속·단독 변형 선택자는 모두 빼지 않는다(Codex r2).
const VS = '\uFE0F';
const VS_TEXT = '\uFE0E';
export const MIN_LENGTH_TABLE: [string, string, boolean][] = [
  ['이모지 1자', '😀', false],
  ['변형 선택자 붙은 1자', '❤️', false],
  ['변형 선택자 2개 붙은 영문 1자', `a${VS}${VS}`, true],
  ['단독 변형 선택자', VS, false],
  ['변형 선택자 2개', `${VS}${VS}`, true],
  ['변형 선택자 붙은 2자 반복', '❤️❤️', true],
  ['영문 + 변형 선택자', `a${VS}`, false],
  ['변형 선택자 2개 + 영문', `${VS}${VS}a`, true],
  ['영문 2자 + 변형 선택자', `ab${VS}`, true],
  ['텍스트형 변형 선택자 2개 붙은 영문', `a${VS_TEXT}${VS_TEXT}`, true],
  ['변형 선택자 + 영문', `${VS}a`, true],
  ['한글 2자', '가나', true],
];

describe('픽스처 validatorLength는 백엔드 minLength(2)와 같다 (Codex r2)', () => {
  for (const [name, text, expected] of MIN_LENGTH_TABLE) {
    it(`${name} ${JSON.stringify(text)} → ${expected ? '200' : '400'}`, async () => {
      expect(validatorLength(text) >= 2).toBe(expected);
      const res = await get(`/api/search?q=${encodeURIComponent(text)}`);
      expect(res.status).toBe(expected ? 200 : 400);
    });
  }
});
