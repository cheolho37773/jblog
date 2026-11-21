import {
  closeIntegrationDatabase,
  type IntegrationDatabase,
  prepareIntegrationDatabase,
  resetDatabase,
  runSeed,
} from './support/integration-db';

// seed 검증 (M0-06 규약 5, 백엔드 §3.3, 개요 Q3).
const SEED_CATEGORY_NAMES = ['Backend', 'DevOps', 'Frontend', 'Retrospect'];
const SEED_POST_COUNT = 9;
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
        select: { id: true, slug: true, status: true, publishedAt: true, categoryId: true },
        orderBy: { id: 'asc' },
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

  it('샘플 글 9개를 넣고 각 글은 자기 slug 를 현재 PostSlug(isCurrent=true)로 1개 가진다', async () => {
    await runSeed(db.databaseUrl);

    const posts = await db.prisma.post.findMany({
      select: { slug: true, slugs: { where: { isCurrent: true }, select: { slug: true } } },
    });
    expect(posts).toHaveLength(SEED_POST_COUNT);
    for (const post of posts) {
      expect(post.slugs).toEqual([{ slug: post.slug }]);
    }
  });

  it('샘플 글에 발행 상태(PUBLISHED) 글이 있다 (디자인 검수용)', async () => {
    await runSeed(db.databaseUrl);

    expect(await db.prisma.post.count({ where: { status: 'PUBLISHED' } })).toBeGreaterThan(0);
  });

  it('발행 글은 모두 publishedAt 이 있고, 지금 공개되는 글(publishedAt <= 지금)이 1개 이상이다', async () => {
    await runSeed(db.databaseUrl);

    const published: { publishedAt: Date | null }[] = await db.prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      select: { publishedAt: true },
    });
    expect(published.every((post) => post.publishedAt !== null)).toBe(true);
    const now = Date.now();
    expect(published.some((post) => (post.publishedAt?.getTime() ?? Infinity) <= now)).toBe(true);
  });

  it('현재 slug 외의 PostSlug 를 만들지 않는다 (PostSlug 9행 = 글 9개의 현재 slug)', async () => {
    await runSeed(db.databaseUrl);

    expect(await db.prisma.postSlug.count()).toBe(SEED_POST_COUNT);
    expect(await db.prisma.postSlug.count({ where: { isCurrent: true } })).toBe(SEED_POST_COUNT);
  });

  it('관리자 계정(User)을 시드하지 않는다', async () => {
    await runSeed(db.databaseUrl);

    expect(await db.prisma.user.count()).toBe(0);
  });

  it('두 번 실행해도 오류 없이 같은 상태다 (Profile 1, 카테고리 4, 글 9)', async () => {
    await runSeed(db.databaseUrl);
    const afterFirst = await seededCounts();

    const snapshotAfterFirst = await seededSnapshot();

    await runSeed(db.databaseUrl);
    const afterSecond = await seededCounts();

    expect(afterFirst).toEqual({
      profile: 1,
      category: SEED_CATEGORY_NAMES.length,
      post: SEED_POST_COUNT,
      postSlug: SEED_POST_COUNT,
      user: 0,
    });
    expect(afterSecond).toEqual(afterFirst);
    expect(await seededSnapshot()).toEqual(snapshotAfterFirst);
  });
});
