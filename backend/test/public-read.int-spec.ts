import type { INestApplication } from '@nestjs/common';
import { Writable } from 'node:stream';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import { expectErrorShape } from './fixtures/error-body';
import {
  createCategory,
  createOldSlug,
  createPost,
  createTag,
  findInternalOnlyKeys,
  MS_PER_DAY,
} from './fixtures/public-read-data';
import {
  closeIntegrationDatabase,
  createIntegrationEnv,
  type IntegrationDatabase,
  prepareIntegrationDatabase,
  resetDatabase,
} from './support/integration-db';

// 공개 조회 API: 목록·상세·카테고리·태그 (M2-03 동작 규약 1~4, 6, 8의 본문 검사).
// 시드에 기대지 않고 테스트가 직접 넣은 데이터로 검증한다. 검색은 test/public-search.int-spec.ts.

const CACHE_CONTROL_PUBLIC = 'public, max-age=60, stale-while-revalidate=300';
const CACHE_CONTROL_NO_STORE = 'no-store';
const DEFAULT_PAGE_SIZE = 9;
const SUMMARY_KEYS = [
  'category',
  'coverImageUrl',
  'excerpt',
  'likeCount',
  'publishedAt',
  'readingMinutes',
  'slug',
  'title',
  'viewCount',
];
const DETAIL_KEYS = [
  ...SUMMARY_KEYS,
  'isFeatured',
  'seoDescription',
  'seoTitle',
  'tags',
  'updatedAt',
].sort();
const BODY_MARKER = 'SECRET-BODY-MARKER-0001';

function discardLogs(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

interface Summary {
  slug: string;
  title: string;
  excerpt: string;
  category: { name: string; slug: string } | null;
  publishedAt: string;
}
interface ListBody {
  items: Summary[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}
interface DetailBody {
  post: Summary & { tags: { name: string; slug: string }[] };
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
  related: Summary[];
}

const slugsOf = (items: Summary[]): string[] => items.map((item) => item.slug);

describe('공개 조회 API (실제 PostgreSQL)', () => {
  let db: IntegrationDatabase;
  let app: INestApplication;
  const base = Date.now();
  const daysAgo = (days: number): Date => new Date(base - days * MS_PER_DAY);

  const get = (path: string) => request(app.getHttpServer()).get(path);

  beforeAll(async () => {
    db = await prepareIntegrationDatabase();
    app = await createApp(createIntegrationEnv(db.databaseUrl), { logStream: discardLogs() });
    await app.init();
    await resetDatabase(db.prisma);
    await seedDataset();
  });

  afterAll(async () => {
    await app?.close();
    if (db) await closeIntegrationDatabase(db);
  });

  // 발행 12개(오래된 순 p12 < p1 < p2 ... < p11이 아니라 아래 날짜 참고), 초안 2개, 예약 1개.
  // 날짜(며칠 전): p11=1, p10=2, p9=3, p8=4, p7=5, p6=5(p7과 동시각), p5=6, p4=7, p3=8, p2=9, p1=10, p12=11
  // 최신순(publishedAt desc, id desc): p11 p10 p9 p8 p7 p6 p5 p4 p3 | p2 p1 p12
  async function seedDataset(): Promise<void> {
    const { prisma } = db;
    const frontend = await createCategory(prisma, {
      name: 'Frontend',
      slug: 'frontend',
      sortOrder: 0,
    });
    const backend = await createCategory(prisma, {
      name: 'Backend',
      slug: 'backend',
      sortOrder: 1,
    });
    await createCategory(prisma, { name: 'Alpha-Empty', slug: 'alpha-empty', sortOrder: 2 });
    const hidden = await createCategory(prisma, {
      name: 'Beta-Hidden',
      slug: 'beta-hidden',
      sortOrder: 2,
    });
    const solo = await createCategory(prisma, { name: 'Solo', slug: 'solo', sortOrder: 3 });
    const zeta = await createTag(prisma, { name: 'Zeta', slug: 'zeta' });
    const alpha = await createTag(prisma, { name: 'Alpha', slug: 'alpha' });
    const mid = await createTag(prisma, { name: 'Mid', slug: 'mid' });

    // id 순서 = 생성 순서. p6, p7은 같은 publishedAt이라 id가 큰 p7이 먼저 나와야 한다.
    await createPost(prisma, {
      slug: 'p1',
      title: 'P1',
      publishedAt: daysAgo(10),
      categoryId: backend,
      tagIds: [alpha],
      contentMd: BODY_MARKER,
    });
    await createPost(prisma, {
      slug: 'p2',
      title: 'P2',
      publishedAt: daysAgo(9),
      categoryId: backend,
      tagIds: [alpha, mid],
      isFeatured: true,
    });
    await createPost(prisma, {
      slug: 'p3',
      title: 'P3',
      publishedAt: daysAgo(8),
      categoryId: frontend,
    });
    await createPost(prisma, {
      slug: 'p4',
      title: 'P4',
      publishedAt: daysAgo(7),
      categoryId: backend,
      tagIds: [zeta],
    });
    await createPost(prisma, {
      slug: 'p5',
      title: 'P5',
      publishedAt: daysAgo(6),
      categoryId: frontend,
    });
    await createPost(prisma, {
      slug: 'p6',
      title: 'P6',
      publishedAt: daysAgo(5),
      categoryId: frontend,
    });
    await createPost(prisma, {
      slug: 'p7',
      title: 'P7',
      publishedAt: daysAgo(5),
      categoryId: frontend,
    });
    await createPost(prisma, {
      slug: 'p8',
      title: 'P8',
      publishedAt: daysAgo(4),
      categoryId: null,
    });
    await createPost(prisma, {
      slug: 'p9',
      title: 'P9',
      publishedAt: daysAgo(3),
      categoryId: frontend,
    });
    await createPost(prisma, {
      slug: 'p10',
      title: 'P10',
      publishedAt: daysAgo(2),
      categoryId: backend,
    });
    await createPost(prisma, {
      slug: 'p11',
      title: 'P11',
      publishedAt: daysAgo(1),
      categoryId: frontend,
    });
    await createPost(prisma, {
      slug: 'p12',
      title: 'P12',
      publishedAt: daysAgo(11),
      categoryId: solo,
    });

    // 공개되면 안 되는 글. 날짜·카테고리·태그를 일부러 공개 글 사이/같은 곳에 둔다.
    await createPost(prisma, {
      slug: 'draft-between',
      title: 'Draft Between',
      status: 'DRAFT',
      publishedAt: daysAgo(7.5),
      categoryId: backend,
      tagIds: [alpha],
    });
    await createPost(prisma, {
      slug: 'draft-newest',
      title: 'Draft Newest',
      status: 'DRAFT',
      publishedAt: null,
      categoryId: frontend,
      isFeatured: true,
    });
    await createPost(prisma, {
      slug: 'scheduled',
      title: 'Scheduled',
      publishedAt: new Date(base + 30 * MS_PER_DAY),
      categoryId: hidden,
      tagIds: [zeta],
      isFeatured: true,
    });
    await createPost(prisma, {
      slug: 'scheduled-backend',
      title: 'Scheduled Backend',
      publishedAt: new Date(base + 2 * MS_PER_DAY),
      categoryId: backend,
    });

    // 이전 slug: p4의 옛 이름, 초안 글의 옛 이름, 예약 글의 옛 이름, 삭제된 글의 slug
    const p4 = await db.prisma.post.findUniqueOrThrow({
      where: { slug: 'p4' },
      select: { id: true },
    });
    const draft = await db.prisma.post.findUniqueOrThrow({
      where: { slug: 'draft-between' },
      select: { id: true },
    });
    const scheduled = await db.prisma.post.findUniqueOrThrow({
      where: { slug: 'scheduled' },
      select: { id: true },
    });
    await createOldSlug(prisma, 'old-p4', p4.id);
    await createOldSlug(prisma, 'old-draft', draft.id);
    await createOldSlug(prisma, 'old-scheduled', scheduled.id);
    await createOldSlug(prisma, 'deleted-post-slug', null);
  }

  describe('GET /api/posts 목록', () => {
    it('기본값 page 1·size 9로 최신순(publishedAt desc, id desc) 9개를 주고 동시각 글은 id 큰 쪽이 먼저다', async () => {
      const response = await get('/api/posts');

      expect(response.status).toBe(200);
      const body = response.body as ListBody;
      expect(body.page).toBe(1);
      expect(body.size).toBe(DEFAULT_PAGE_SIZE);
      expect(slugsOf(body.items)).toEqual(['p11', 'p10', 'p9', 'p8', 'p7', 'p6', 'p5', 'p4', 'p3']);
    });

    it('totalItems·totalPages 는 공개 글만 센다 (공개 12개 → 2쪽)', async () => {
      const body = (await get('/api/posts')).body as ListBody;

      expect(body.totalItems).toBe(12);
      expect(body.totalPages).toBe(2);
    });

    it('2쪽은 나머지 3개다', async () => {
      const body = (await get('/api/posts?page=2')).body as ListBody;

      expect(body.page).toBe(2);
      expect(slugsOf(body.items)).toEqual(['p2', 'p1', 'p12']);
    });

    it('size 를 지정하면 totalPages = ceil(totalItems/size) 다 (size 5 → 3쪽, 3쪽은 2개)', async () => {
      const body = (await get('/api/posts?page=3&size=5')).body as ListBody;

      expect(body.size).toBe(5);
      expect(body.totalPages).toBe(3);
      expect(slugsOf(body.items)).toEqual(['p1', 'p12']);
    });

    it('범위를 넘는 page 는 빈 items 와 200 이다', async () => {
      const response = await get('/api/posts?page=99');

      expect(response.status).toBe(200);
      const body = response.body as ListBody;
      expect(body.items).toEqual([]);
      expect(body.totalItems).toBe(12);
      expect(body.totalPages).toBe(2);
    });

    // page 는 DTO 에서 Number 로 변환되어 그대로 응답에 실린다 (9007199254740993 은 부동소수점이라 ...992 가 된다)
    it.each([['100000000000000000000'], ['9007199254740993']])(
      '매우 큰 page=%s 도 500 없이 200, 빈 items, 실제 totalItems·totalPages 를 준다',
      async (page) => {
        const response = await get(`/api/posts?page=${page}&size=9`);

        expect(response.status).toBe(200);
        const body = response.body as ListBody;
        expect(body.items).toEqual([]);
        expect(body.page).toBe(Number(page));
        expect(body.totalItems).toBe(12);
        expect(body.totalPages).toBe(2);
      },
    );

    it('항목은 PostSummary 의 필드만 가지며 publishedAt 은 ISO 8601 이다', async () => {
      const response = await get('/api/posts?size=1');

      expect(response.status).toBe(200);
      const item = (response.body as ListBody).items[0] as Summary;
      expect(Object.keys(item).sort()).toEqual(SUMMARY_KEYS);
      expect(item.category).toEqual({ name: 'Frontend', slug: 'frontend' });
      expect(new Date(item.publishedAt).toISOString()).toBe(item.publishedAt);
    });

    it('카테고리가 없는 글의 category 는 null 이다', async () => {
      const body = (await get('/api/posts?size=50')).body as ListBody;

      expect(body.items.find((item) => item.slug === 'p8')?.category).toBeNull();
    });

    it('저장된 excerpt 는 그대로 돌려준다', async () => {
      const body = (await get('/api/posts?size=50')).body as ListBody;

      expect(body.items.find((item) => item.slug === 'p3')?.excerpt).toBe('요약 p3');
    });

    it('category slug 로 거른다', async () => {
      const body = (await get('/api/posts?category=backend')).body as ListBody;

      expect(slugsOf(body.items)).toEqual(['p10', 'p4', 'p2', 'p1']);
      expect(body.totalItems).toBe(4);
      expect(body.totalPages).toBe(1);
    });

    it('tag slug 로 거른다 (초안·예약에만 붙은 태그 연결은 세지 않는다)', async () => {
      const alpha = (await get('/api/posts?tag=alpha')).body as ListBody;
      const zeta = (await get('/api/posts?tag=zeta')).body as ListBody;

      expect(slugsOf(alpha.items)).toEqual(['p2', 'p1']);
      expect(slugsOf(zeta.items)).toEqual(['p4']);
    });

    it('category 와 tag 를 함께 주면 둘 다 만족하는 글만 나온다', async () => {
      const body = (await get('/api/posts?category=backend&tag=alpha')).body as ListBody;

      expect(slugsOf(body.items)).toEqual(['p2', 'p1']);
    });

    it('featured=true 면 추천 글만 나오고 초안·예약 추천 글은 빠진다', async () => {
      const body = (await get('/api/posts?featured=true')).body as ListBody;

      expect(slugsOf(body.items)).toEqual(['p2']);
      expect(body.totalItems).toBe(1);
    });

    it('없는 category·tag slug 는 빈 목록(200, totalItems 0, totalPages 0)이다', async () => {
      for (const query of ['category=nope', 'tag=nope']) {
        const response = await get(`/api/posts?${query}`);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ items: [], totalItems: 0, totalPages: 0 });
      }
    });

    it('초안·예약 글은 어느 쪽에도 나오지 않는다', async () => {
      const all = (await get('/api/posts?size=50')).body as ListBody;

      expect(slugsOf(all.items)).toHaveLength(12);
      for (const hiddenSlug of [
        'draft-between',
        'draft-newest',
        'scheduled',
        'scheduled-backend',
      ]) {
        expect(slugsOf(all.items)).not.toContain(hiddenSlug);
      }
    });

    it('예약 글은 publishedAt 이 지나면 공개된다 (공개 조건은 publishedAt <= 지금)', async () => {
      await createPost(db.prisma, {
        slug: 'due-now',
        title: 'Due',
        publishedAt: new Date(Date.now() - 1000),
        categoryId: null,
      });
      try {
        const body = (await get('/api/posts?size=50')).body as ListBody;
        expect(slugsOf(body.items)[0]).toBe('due-now');
      } finally {
        await db.prisma.post.delete({ where: { slug: 'due-now' } });
      }
    });

    it.each([
      ['page=0'],
      ['page=-1'],
      ['page=1.5'],
      ['page=abc'],
      ['size=0'],
      ['size=51'],
      ['size=1.5'],
      ['featured=maybe'],
    ])('잘못된 쿼리(%s)는 400 VALIDATION_FAILED 다', async (query) => {
      const response = await get(`/api/posts?${query}`);

      expect(response.status).toBe(400);
      expectErrorShape(response.body, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        path: '/api/posts',
      });
      expect(response.headers['cache-control']).toBe(CACHE_CONTROL_NO_STORE);
    });

    it('size=50 은 허용한다', async () => {
      expect((await get('/api/posts?size=50')).status).toBe(200);
    });
  });

  describe('GET /api/posts/{slug} 상세', () => {
    it('메타 필드와 tags 를 주고 원문은 주지 않는다', async () => {
      const response = await get('/api/posts/p2');

      expect(response.status).toBe(200);
      const { post } = response.body as DetailBody;
      expect(Object.keys(post).sort()).toEqual(DETAIL_KEYS);
      expect(post).toMatchObject({
        slug: 'p2',
        title: 'P2',
        excerpt: '요약 p2',
        category: { name: 'Backend', slug: 'backend' },
        isFeatured: true,
        seoTitle: null,
        seoDescription: null,
      });
      expect([...post.tags].sort((a, b) => a.slug.localeCompare(b.slug))).toEqual([
        { name: 'Alpha', slug: 'alpha' },
        { name: 'Mid', slug: 'mid' },
      ]);
    });

    it('응답 최상위는 post·prev·next·related 뿐이다', async () => {
      const body = (await get('/api/posts/p2')).body as DetailBody;

      expect(Object.keys(body).sort()).toEqual(['next', 'post', 'prev', 'related']);
    });

    it('prev 는 바로 더 오래된 공개 글, next 는 바로 더 최근 공개 글이다', async () => {
      const body = (await get('/api/posts/p5')).body as DetailBody;

      expect(body.prev).toEqual({ slug: 'p4', title: 'P4' });
      expect(body.next).toEqual({ slug: 'p6', title: 'P6' });
    });

    it('동시각 글은 id 순서로 이어진다 (p7 의 prev 는 p6, p6 의 next 는 p7)', async () => {
      const p7 = (await get('/api/posts/p7')).body as DetailBody;
      const p6 = (await get('/api/posts/p6')).body as DetailBody;

      expect(p7.prev?.slug).toBe('p6');
      expect(p7.next?.slug).toBe('p8');
      expect(p6.next?.slug).toBe('p7');
      expect(p6.prev?.slug).toBe('p5');
    });

    it('가장 오래된 글의 prev, 가장 최근 글의 next 는 null 이다 (예약·초안 글은 next 가 되지 않는다)', async () => {
      const oldest = (await get('/api/posts/p12')).body as DetailBody;
      const newest = (await get('/api/posts/p11')).body as DetailBody;

      expect(oldest.prev).toBeNull();
      expect(oldest.next).toEqual({ slug: 'p1', title: 'P1' });
      expect(newest.next).toBeNull();
      expect(newest.prev).toEqual({ slug: 'p10', title: 'P10' });
    });

    it('prev 는 사이에 낀 초안을 건너뛴다 (p4 의 prev 는 draft-between 이 아니라 p3)', async () => {
      const body = (await get('/api/posts/p4')).body as DetailBody;

      expect(body.prev).toEqual({ slug: 'p3', title: 'P3' });
    });

    it('related 는 같은 카테고리의 다른 공개 글을 최근순으로 최대 3개 준다 (자기 자신·초안·예약 제외)', async () => {
      const body = (await get('/api/posts/p4')).body as DetailBody;

      expect(slugsOf(body.related)).toEqual(['p10', 'p2', 'p1']);
      for (const item of body.related) expect(Object.keys(item).sort()).toEqual(SUMMARY_KEYS);
    });

    it('같은 카테고리 공개 글이 3개를 넘어도 3개까지만 준다 (Frontend 글 p11 → p9 p7 p6)', async () => {
      const body = (await get('/api/posts/p11')).body as DetailBody;

      expect(slugsOf(body.related)).toEqual(['p9', 'p7', 'p6']);
    });

    it('카테고리에 다른 공개 글이 없으면 related 는 빈 배열이다', async () => {
      const body = (await get('/api/posts/p12')).body as DetailBody;

      expect(body.related).toEqual([]);
    });

    it('카테고리가 없는 글의 related 는 빈 배열이고 category 는 null 이다', async () => {
      const body = (await get('/api/posts/p8')).body as DetailBody;

      expect(body.post.category).toBeNull();
      expect(body.related).toEqual([]);
    });

    it('이전 slug 는 301 이고 Location 은 현재 slug 경로이며 본문이 없다', async () => {
      const response = await get('/api/posts/old-p4');

      expect(response.status).toBe(301);
      expect(response.headers.location).toBe('/api/posts/p4');
      expect(response.text).toBe('');
      expect(response.headers['cache-control']).toBe(CACHE_CONTROL_NO_STORE);
    });

    it.each([['draft-between'], ['draft-newest'], ['scheduled'], ['scheduled-backend']])(
      '초안·예약 글(%s)의 상세는 404 POST_NOT_FOUND 다',
      async (slug) => {
        const response = await get(`/api/posts/${slug}`);

        expect(response.status).toBe(404);
        expectErrorShape(response.body, {
          statusCode: 404,
          code: 'POST_NOT_FOUND',
          path: `/api/posts/${slug}`,
        });
      },
    );

    it.each([['old-draft'], ['old-scheduled'], ['deleted-post-slug'], ['never-existed']])(
      '이전 slug 의 대상이 공개 상태가 아니거나 없는 slug(%s)는 301 이 아니라 404 POST_NOT_FOUND 다',
      async (slug) => {
        const response = await get(`/api/posts/${slug}`);

        expect(response.status).toBe(404);
        expect(response.headers.location).toBeUndefined();
        expectErrorShape(response.body, {
          statusCode: 404,
          code: 'POST_NOT_FOUND',
          path: `/api/posts/${slug}`,
        });
      },
    );

    it('공개 조건에 못 미치는 글은 목록·상세·prev/next·related 어디에도 이름이 나오지 않는다', async () => {
      const responses = await Promise.all(
        [
          '/api/posts?size=50',
          '/api/posts/p4',
          '/api/posts/p11',
          '/api/posts/p10',
          '/api/posts/p12',
        ].map((path) => get(path)),
      );

      for (const response of responses) {
        expect(response.text).not.toMatch(/draft-between|draft-newest|scheduled/);
      }
    });
  });

  describe('GET /api/categories · /api/tags', () => {
    it('카테고리는 sortOrder, name 순이고 postCount 는 공개 글 수다 (글 0개 카테고리도 포함)', async () => {
      const response = await get('/api/categories');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { name: 'Frontend', slug: 'frontend', postCount: 6 },
        { name: 'Backend', slug: 'backend', postCount: 4 },
        { name: 'Alpha-Empty', slug: 'alpha-empty', postCount: 0 },
        { name: 'Beta-Hidden', slug: 'beta-hidden', postCount: 0 },
        { name: 'Solo', slug: 'solo', postCount: 1 },
      ]);
    });

    it('태그는 name 순이고 postCount 는 공개 글 수다 (초안·예약 연결 제외)', async () => {
      const response = await get('/api/tags');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { name: 'Alpha', slug: 'alpha', postCount: 2 },
        { name: 'Mid', slug: 'mid', postCount: 1 },
        { name: 'Zeta', slug: 'zeta', postCount: 1 },
      ]);
    });
  });

  describe('Cache-Control (규약 6)', () => {
    it.each([['/api/posts'], ['/api/posts/p2'], ['/api/categories'], ['/api/tags']])(
      '%s 성공 응답은 public, max-age=60, stale-while-revalidate=300 이다',
      async (path) => {
        const response = await get(path);

        expect(response.status).toBe(200);
        expect(response.headers['cache-control']).toBe(CACHE_CONTROL_PUBLIC);
      },
    );

    it.each([
      ['/api/posts/draft-between'],
      ['/api/posts/never-existed'],
      ['/api/posts?page=0'],
      ['/api/posts/old-p4'],
    ])('%s (404·400·301)는 no-store 다', async (path) => {
      expect((await get(path)).headers['cache-control']).toBe(CACHE_CONTROL_NO_STORE);
    });
  });

  describe('공개 응답 본문 보호 (백엔드 §4.2)', () => {
    it.each([
      ['/api/posts?size=50'],
      ['/api/posts/p1'],
      ['/api/posts/p4'],
      ['/api/posts/p11'],
      ['/api/categories'],
      ['/api/tags'],
      ['/api/search?q=P1'],
      ['/api/posts/old-p4'],
      ['/api/posts/draft-between'],
    ])('%s 응답 어디에도 contentMd·version 키가 없다', async (path) => {
      const response = await get(path);

      expect(findInternalOnlyKeys(response.body)).toEqual([]);
      expect(response.text).not.toContain(BODY_MARKER);
    });
  });
});
