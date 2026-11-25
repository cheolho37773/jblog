import { SearchService } from '../src/modules/posts/search.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createPost } from './fixtures/public-read-data';
import {
  closeIntegrationDatabase,
  type IntegrationDatabase,
  prepareIntegrationDatabase,
  resetDatabase,
} from './support/integration-db';

// 검색은 ID 조회($queryRaw)와 응답 데이터 재조회(findMany)를 따로 실행한다.
// 그 사이에 글이 비공개로 바뀌고 수정되어도 비공개 제목·자동 요약이 응답에 나오면 안 된다 (Codex r1, 백엔드 §5.1).

const PRIVATE_TITLE = '비공개로 바꾼 뒤 수정한 제목';
const PRIVATE_BODY = '비공개 본문 앞부분이 자동 요약으로 새어 나가면 안 된다';

describe('검색: ID 조회와 재조회 사이에 비공개 전환·수정이 끼어드는 경우 (실제 PostgreSQL)', () => {
  let db: IntegrationDatabase;

  beforeAll(async () => {
    db = await prepareIntegrationDatabase();
  });

  afterAll(async () => {
    if (db) await closeIntegrationDatabase(db);
  });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
  });

  // 재조회(post.findMany) 직전에 intrude()를 실행하는 Prisma 대리자. 그 외 호출은 실제 클라이언트로 그대로 보낸다.
  function prismaIntrudingBeforeReload(intrude: () => Promise<void>): PrismaService {
    const post = new Proxy(db.prisma.post, {
      get(target, property, receiver) {
        if (property !== 'findMany') return Reflect.get(target, property, receiver) as unknown;
        return async (...args: Parameters<typeof target.findMany>) => {
          await intrude();
          return target.findMany(...args);
        };
      },
    });
    return new Proxy(db.prisma, {
      get(target, property) {
        if (property === 'post') return post;
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as unknown as PrismaService;
  }

  // publishedAt을 지우는 경우(초안으로 되돌림)와 남기는 경우(발행 시각이 보존된 비공개) 모두 막아야 한다.
  it.each([
    ['발행 시각을 지우고', null],
    ['발행 시각을 남기고', undefined],
  ])(
    'ID 조회 뒤 비공개로 전환되고(%s) 수정된 글은 검색 응답에 나오지 않는다',
    async (_label, publishedAt) => {
      const id = await createPost(db.prisma, {
        slug: 'race-hit',
        title: 'Racekeyword 원래 제목',
        excerpt: null,
        contentMd: '원래 본문',
      });
      const service = new SearchService(
        prismaIntrudingBeforeReload(async () => {
          await db.prisma.post.update({
            where: { id },
            data: {
              status: 'DRAFT',
              ...(publishedAt === null ? { publishedAt } : {}),
              title: PRIVATE_TITLE,
              contentMd: PRIVATE_BODY,
            },
          });
        }),
      );

      const result = await service.search({ q: 'Racekeyword' } as never);

      expect(JSON.stringify(result)).not.toContain(PRIVATE_TITLE);
      expect(JSON.stringify(result)).not.toContain(PRIVATE_BODY);
      expect(result.items.map((item) => item.slug)).not.toContain('race-hit');
    },
  );
});
