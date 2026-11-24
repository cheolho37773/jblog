import {
  closeIntegrationDatabase,
  type IntegrationDatabase,
  prepareIntegrationDatabase,
  resetDatabase,
  runSeed,
} from './support/integration-db';

// seed 검증 (M0-06 규약 5 + M2-03 규약 7·8, 백엔드 §3.3, 개요 Q3).
const SEED_CATEGORY_NAMES = ['Backend', 'DevOps', 'Frontend', 'Retrospect'];
const MIN_PUBLISHED_POSTS = 12;
const MIN_TAGS = 5;
const MAX_TAGS_PER_POST = 3;
const SEED_COVER_PREFIX = '/uploads/seed/';
const PROFILE_SINGLETON_ID = 1;
describe('seed (실제 PostgreSQL)', () => {
  let db: IntegrationDatabase;

  beforeAll(async () => {
    db = await prepareIntegrationDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
  });

  afterAll(async () => {
    if (db) await closeIntegrationDatabase(db);
  });

  async function seededCounts(): Promise<Record<string, number>> {
    return {
      profile: await db.prisma.profile.count(),
      category: await db.prisma.category.count(),
      post: await db.prisma.post.count(),
      postSlug: await db.prisma.postSlug.count(),
      tag: await db.prisma.tag.count(),
      postTag: await db.prisma.postTag.count(),
      user: await db.prisma.user.count(),
    };
  }

  // 재실행 비교용 상태. 개수만 같고 내용이 바뀌는 경우(중복 생성 후 삭제, slug 교체 등)도 잡는다.
  async function seededSnapshot(): Promise<unknown> {
    return {
      profileIds: await db.prisma.profile.findMany({ select: { id: true } }),
      categories: await db.prisma.category.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { id: 'asc' },
      }),
      posts: await db.prisma.post.findMany({
        select: {
          id: true,
          slug: true,
          status: true,
          publishedAt: true,
          categoryId: true,
          isFeatured: true,
          coverImageUrl: true,
        },
        orderBy: { id: 'asc' },
      }),
      postTags: await db.prisma.postTag.findMany({
        orderBy: [{ postId: 'asc' }, { tagId: 'asc' }],
      }),
      postSlugs: await db.prisma.postSlug.findMany({
        select: { slug: true, postId: true, isCurrent: true },
        orderBy: { slug: 'asc' },
      }),
    };
  }

  it('Profile 1행(id=1)을 넣는다', async () => {
    await runSeed(db.databaseUrl);

    const profiles = await db.prisma.profile.findMany({ select: { id: true } });
    expect(profiles).toEqual([{ id: PROFILE_SINGLETON_ID }]);
  });

  it('기본 카테고리 4개(Backend, Frontend, DevOps, Retrospect)를 넣는다', async () => {
    await runSeed(db.databaseUrl);

    const categories: { name: string }[] = await db.prisma.category.findMany({
      select: { name: true },
    });
    const names = categories.map((category) => category.name).sort();
    expect(names).toEqual(SEED_CATEGORY_NAMES);
  });

  it('각 글은 자기 slug 를 현재 PostSlug(isCurrent=true)로 정확히 1개 가진다', async () => {
    await runSeed(db.databaseUrl);

    const posts = await db.prisma.post.findMany({
      select: { slug: true, slugs: { where: { isCurrent: true }, select: { slug: true } } },
    });
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) {
      expect(post.slugs).toEqual([{ slug: post.slug }]);
    }
  });

  it('발행 글이 12개 이상이고 그중 Featured 는 정확히 1개다', async () => {
    await runSeed(db.databaseUrl);

    const published = { status: 'PUBLISHED' as const, publishedAt: { lte: new Date() } };
    expect(await db.prisma.post.count({ where: published })).toBeGreaterThanOrEqual(
      MIN_PUBLISHED_POSTS,
    );
    expect(await db.prisma.post.count({ where: { ...published, isFeatured: true } })).toBe(1);
  });

  it('공개 발행 글은 모두 publishedAt 이 있다', async () => {
    await runSeed(db.databaseUrl);

    const published: { publishedAt: Date | null }[] = await db.prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      select: { publishedAt: true },
    });
    expect(published.every((post) => post.publishedAt !== null)).toBe(true);
  });

  it('예약 글(PUBLISHED + 미래 publishedAt)이 정확히 1개 있고 먼 미래다', async () => {
    await runSeed(db.databaseUrl);

    const scheduled: { publishedAt: Date | null }[] = await db.prisma.post.findMany({
      where: { status: 'PUBLISHED', publishedAt: { gt: new Date() } },
      select: { publishedAt: true },
    });
    expect(scheduled).toHaveLength(1);
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const ONE_YEAR_DAYS = 365;
    expect((scheduled[0]?.publishedAt?.getTime() ?? 0) - Date.now()).toBeGreaterThan(
      ONE_YEAR_DAYS * MS_PER_DAY,
    );
  });

  it('초안(DRAFT)이 정확히 1개 있다', async () => {
    await runSeed(db.databaseUrl);

    expect(await db.prisma.post.count({ where: { status: 'DRAFT' } })).toBe(1);
  });

  it('태그가 5개 이상이고 글마다 태그는 0~3개다', async () => {
    await runSeed(db.databaseUrl);

    expect(await db.prisma.tag.count()).toBeGreaterThanOrEqual(MIN_TAGS);
    const posts = await db.prisma.post.findMany({ select: { _count: { select: { tags: true } } } });
    for (const post of posts) {
      expect(post._count.tags).toBeLessThanOrEqual(MAX_TAGS_PER_POST);
    }
    expect(posts.some((post) => post._count.tags > 0)).toBe(true);
  });

  it('이전 slug 가 정확히 1개 있고 그 글의 현재 slug 와 다르다', async () => {
    await runSeed(db.databaseUrl);

    const oldSlugs = await db.prisma.postSlug.findMany({ where: { isCurrent: false } });
    expect(oldSlugs).toHaveLength(1);
    const post = await db.prisma.post.findUniqueOrThrow({
      where: { id: oldSlugs[0]?.postId ?? -1 },
    });
    expect(post.slug).not.toBe(oldSlugs[0]?.slug);
    expect(post.status).toBe('PUBLISHED');
  });

  it('시드 커버 이미지는 /uploads/seed/<파일>.png 형식이다 (공개 글 중 1개 이상)', async () => {
    await runSeed(db.databaseUrl);

    const covers: { coverImageUrl: string | null }[] = await db.prisma.post.findMany({
      where: { coverImageUrl: { not: null } },
      select: { coverImageUrl: true },
    });
    expect(covers.length).toBeGreaterThan(0);
    for (const cover of covers) {
      expect(cover.coverImageUrl).toMatch(new RegExp(`^${SEED_COVER_PREFIX}[\\w.-]+\\.png$`));
    }
  });

  it('본문에 코드 블록과 h2·h3 을 담은 글이 1개 이상 있다', async () => {
    await runSeed(db.databaseUrl);

    const posts: { contentMd: string }[] = await db.prisma.post.findMany({
      select: { contentMd: true },
    });
    const rich = posts.filter(
      (post) =>
        post.contentMd.includes('```') &&
        /^## /m.test(post.contentMd) &&
        /^### /m.test(post.contentMd),
    );
    expect(rich.length).toBeGreaterThanOrEqual(1);
  });

  it('관리자 계정(User)을 시드하지 않는다', async () => {
    await runSeed(db.databaseUrl);

    expect(await db.prisma.user.count()).toBe(0);
  });

  it('두 번 실행해도 오류 없이 같은 상태다 (개수와 태그·커버·예약·이전 slug 내용까지)', async () => {
    await runSeed(db.databaseUrl);
    const afterFirst = await seededCounts();
    const snapshotAfterFirst = await seededSnapshot();

    await runSeed(db.databaseUrl);

    expect(afterFirst).toMatchObject({ profile: 1, category: SEED_CATEGORY_NAMES.length, user: 0 });
    expect(await seededCounts()).toEqual(afterFirst);
    expect(await seededSnapshot()).toEqual(snapshotAfterFirst);
  });
});
