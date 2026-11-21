import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  closeIntegrationDatabase,
  type IntegrationDatabase,
  prepareIntegrationDatabase,
  resetDatabase,
} from './support/integration-db';

// 마이그레이션이 만든 DB 구조 검증 (M0-06 규약 2·3·4, 백엔드 §3.2·§3.3).

const SCHEMA_FILE = resolve(__dirname, '../prisma/schema.prisma');

// 백엔드 §3.2의 MVP 모델 전부. M7 모델(McpToken)은 들어가지 않는다 (03 §6).
const MVP_TABLES = [
  'User',
  'LoginAudit',
  'RefreshToken',
  'Category',
  'Tag',
  'Post',
  'PostTag',
  'PostLike',
  'PostViewLog',
  'PostViewDaily',
  'PostDraft',
  'PostSlug',
  'RevalidateEvent',
  'JobState',
  'TechStack',
  'Project',
  'ProjectTechStack',
  'Experience',
  'Profile',
  'Media',
  'MediaUsage',
];

// PostgreSQL unique 위반 SQLSTATE. Prisma는 보통 P2002로 바꿔 주지만,
// 스키마에 없는 수동 SQL 인덱스 위반은 드라이버 오류로 올라올 수 있어 둘 다 인정한다.
const UNIQUE_VIOLATION_SQLSTATE = '23505';
const PRISMA_UNIQUE_VIOLATION_CODE = 'P2002';

interface TableRow {
  table_name: string;
}

interface IndexRow {
  indexname: string;
  indexdef: string;
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  if (code === PRISMA_UNIQUE_VIOLATION_CODE || code === UNIQUE_VIOLATION_SQLSTATE) return true;
  return (
    error.message.includes(UNIQUE_VIOLATION_SQLSTATE) || /unique constraint/i.test(error.message)
  );
}

async function expectUniqueViolation(operation: Promise<unknown>): Promise<void> {
  const error = await operation.then(
    () => undefined,
    (rejected: unknown) => rejected,
  );
  expect(error).toBeDefined();
  expect(isUniqueViolation(error)).toBe(true);
}

// 주석(//)을 지운 스키마 본문. M7 관계는 주석으로만 남겨 두는 것이 규약이므로 주석은 검사 대상이 아니다.
function schemaWithoutComments(): string {
  return readFileSync(SCHEMA_FILE, 'utf8')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

describe('Prisma 스키마·마이그레이션 (실제 PostgreSQL)', () => {
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

  // Prisma 쿼리 인자 키 `data`는 라이브러리 API 이름이라 바꿀 수 없어 이 두 줄만 id-denylist 예외로 둔다.
  async function createPost(slug: string): Promise<{ id: number }> {
    const fields = { slug, title: `더미 글 ${slug}`, contentMd: '더미 본문' };
    // eslint-disable-next-line id-denylist -- Prisma API 인자 이름
    return db.prisma.post.create({ data: fields, select: { id: true } });
  }

  async function createPostSlug(slug: string, postId: number, isCurrent: boolean) {
    // eslint-disable-next-line id-denylist -- Prisma API 인자 이름
    return db.prisma.postSlug.create({ data: { slug, postId, isCurrent } });
  }

  async function indexesOf(table: string): Promise<IndexRow[]> {
    return db.prisma.$queryRaw<IndexRow[]>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ${table}`;
  }

  describe('마이그레이션 결과', () => {
    it('백엔드 §3.2의 MVP 테이블이 모두 있다', async () => {
      const rows: TableRow[] = await db.prisma.$queryRaw<TableRow[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
      const tableNames = rows.map((row) => row.table_name);

      expect(tableNames).toEqual(expect.arrayContaining(MVP_TABLES));
    });

    it('pg_trgm 확장이 설치되어 있다', async () => {
      const rows = await db.prisma.$queryRaw<{ extname: string }[]>`
        SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`;

      expect(rows).toHaveLength(1);
    });

    it('Post 제목·본문에 trgm GIN 인덱스가 각각 있다', async () => {
      const definitions = (await indexesOf('Post')).map((row) => row.indexdef);
      const trgmIndexes = definitions.filter(
        (definition) => definition.includes('USING gin') && definition.includes('gin_trgm_ops'),
      );

      expect(trgmIndexes).toHaveLength(2);
      expect(trgmIndexes.some((definition) => definition.includes('(title gin_trgm_ops)'))).toBe(
        true,
      );
      expect(
        trgmIndexes.some((definition) => definition.includes('("contentMd" gin_trgm_ops)')),
      ).toBe(true);
    });

    it('PostSlug 에 글당 isCurrent=true 1개를 강제하는 부분 unique 인덱스가 있다', async () => {
      const definitions = (await indexesOf('PostSlug')).map((row) => row.indexdef);
      const partialUnique = definitions.filter(
        (definition) =>
          definition.startsWith('CREATE UNIQUE INDEX') &&
          definition.includes('("postId")') &&
          / WHERE .*"isCurrent"/.test(definition),
      );

      expect(partialUnique).toHaveLength(1);
    });

    it('마이그레이션을 다시 적용해도 오류 없이 이력이 그대로다 (멱등)', async () => {
      const countFinished = async (): Promise<number> => {
        const rows = await db.prisma.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) AS count FROM "_prisma_migrations"
          WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
        return Number(rows[0]?.count ?? 0);
      };
      const before = await countFinished();

      const again = await prepareIntegrationDatabase();
      await closeIntegrationDatabase(again);

      expect(before).toBeGreaterThan(0);
      expect(await countFinished()).toBe(before);
      const failed = await db.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*) AS count FROM "_prisma_migrations" WHERE finished_at IS NULL`;
      expect(Number(failed[0]?.count ?? 0)).toBe(0);
    });
  });

  describe('PostSlug 영구 예약 (D20)', () => {
    it('같은 slug 로 PostSlug 2행을 만들면 DB 제약 위반이다', async () => {
      const first = await createPost('dummy-post-a');
      const second = await createPost('dummy-post-b');
      await createPostSlug('reserved-slug', first.id, false);

      await expectUniqueViolation(createPostSlug('reserved-slug', second.id, false));
    });

    it('글이 삭제되어 postId 가 비어도 slug 는 계속 예약된다', async () => {
      const post = await createPost('dummy-post-deleted');
      await createPostSlug('orphan-slug', post.id, true);
      await db.prisma.post.delete({ where: { id: post.id } });
      const orphan = await db.prisma.postSlug.findUnique({ where: { slug: 'orphan-slug' } });
      expect(orphan?.postId).toBeNull();
      const other = await createPost('dummy-post-other');

      await expectUniqueViolation(createPostSlug('orphan-slug', other.id, true));
    });

    it('한 글에 isCurrent=true 2행을 만들면 DB 제약 위반이다', async () => {
      const post = await createPost('dummy-post-current');
      await createPostSlug('current-slug-1', post.id, true);

      await expectUniqueViolation(createPostSlug('current-slug-2', post.id, true));
    });

    it('한 글에 isCurrent=false 는 여러 행을 허용한다', async () => {
      const post = await createPost('dummy-post-history');
      await createPostSlug('history-current', post.id, true);
      await createPostSlug('history-old-1', post.id, false);
      await createPostSlug('history-old-2', post.id, false);

      expect(await db.prisma.postSlug.count({ where: { postId: post.id } })).toBe(3);
    });

    it('서로 다른 글은 각자 isCurrent=true 1행을 가질 수 있다', async () => {
      const first = await createPost('dummy-post-x');
      const second = await createPost('dummy-post-y');
      await createPostSlug('x-current', first.id, true);
      await createPostSlug('y-current', second.id, true);

      expect(await db.prisma.postSlug.count({ where: { isCurrent: true } })).toBe(2);
    });
  });

  describe('M7 관계 미포함 (03 §6)', () => {
    it('DB 에 McpToken 테이블이 없다', async () => {
      const rows = await db.prisma.$queryRaw<TableRow[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND lower(table_name) LIKE '%mcp%'`;

      expect(rows).toEqual([]);
    });

    it('스키마에 McpToken 모델과 User.mcpTokens 관계가 없다 (주석 제외)', () => {
      expect(schemaWithoutComments()).not.toMatch(/McpToken|mcpTokens/);
    });

    it('생성된 Prisma 클라이언트에 mcpToken 모델이 없다', () => {
      const client = db.prisma as unknown as Record<string, unknown>;

      expect(client.mcpToken).toBeUndefined();
    });
  });
});
