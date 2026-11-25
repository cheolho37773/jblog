import type { INestApplication } from '@nestjs/common';
import { Writable } from 'node:stream';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { INTERNAL_KEY_HEADER_NAME, TEST_INTERNAL_KEY } from './fixtures/internal-key';
import { createCategory, createPost, MS_PER_DAY } from './fixtures/public-read-data';
import {
  closeIntegrationDatabase,
  createIntegrationEnv,
  type IntegrationDatabase,
  prepareIntegrationDatabase,
  resetDatabase,
} from './support/integration-db';

// 내부 원문 API의 스냅샷 일관성 (M2-04 규약 4, 백엔드 §4.5·§5.8).
// 본문·메타·prev/next/related 를 읽는 도중 다른 연결이 글을 바꿔도 한 응답은 조회 시작 시점의 값이어야 한다.
//
// 방법: 앱이 쓰는 PrismaService 인스턴스에 "첫 데이터 조회가 끝난 직후 한 번" 별도 연결(db.prisma)로
// 글을 바꾸는 훅을 건다. 이후의 조회가 같은 스냅샷(REPEATABLE READ 트랜잭션)을 읽으면 응답이 그대로고,
// 트랜잭션 없이 따로 읽으면 바뀐 값이 섞여 실패한다.
//
// 구현에 요구하는 해석: 한 트랜잭션은 interactive 형태(`$transaction(async (tx) => ...)`)로 열고,
// 모든 조회를 그 tx 로 한다. 배열 형태 $transaction 은 훅이 끼어들 수 없으므로 "훅이 실행되지 않음"으로 실패한다.

const MODEL_DELEGATES = ['post', 'postSlug', 'category', 'tag'];
const DATA_QUERY_METHODS = ['$queryRaw', '$queryRawUnsafe'];

function discardLogs(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

type AnyFn = (...args: unknown[]) => unknown;

// 호출이 끝난 뒤(결과를 받은 뒤) afterQuery 를 실행하도록 함수를 감싼다.
function afterCall(fn: AnyFn, owner: unknown, afterQuery: () => Promise<void>): AnyFn {
  return async (...args: unknown[]) => {
    const result = await fn.apply(owner, args);
    await afterQuery();
    return result;
  };
}

// 클라이언트(또는 트랜잭션 클라이언트)의 모델 조회·raw 조회에 훅을 건 대리자.
function hookQueries<T extends object>(client: T, afterQuery: () => Promise<void>): T {
  return new Proxy(client, {
    get(target, property) {
      const value = Reflect.get(target, property, target) as unknown;
      const name = String(property);
      if (MODEL_DELEGATES.includes(name) && typeof value === 'object' && value !== null) {
        return new Proxy(value, {
          get(delegate, method) {
            const member = Reflect.get(delegate, method, delegate) as unknown;
            return typeof member === 'function'
              ? afterCall(member as AnyFn, delegate, afterQuery)
              : member;
          },
        });
      }
      if (DATA_QUERY_METHODS.includes(name) && typeof value === 'function') {
        return afterCall(value as AnyFn, target, afterQuery);
      }
      return typeof value === 'function' ? (value as AnyFn).bind(target) : value;
    },
  });
}

interface Link {
  slug: string;
  title: string;
}
interface InternalBody {
  post: { slug: string; title: string; contentMd: string };
  prev: Link | null;
  next: Link | null;
  related: { slug: string; title: string }[];
}

describe('내부 원문 API 스냅샷: 조회 도중 다른 연결이 글을 바꿔도 응답은 한 시점이다 (실제 PostgreSQL)', () => {
  let db: IntegrationDatabase;
  let app: INestApplication;
  let prismaService: PrismaService;
  let ids: Record<string, number>;
  let restorePrisma: () => void = () => undefined;

  const getTarget = () =>
    request(app.getHttpServer())
      .get('/internal/posts/target')
      .set(INTERNAL_KEY_HEADER_NAME, TEST_INTERNAL_KEY);

  beforeAll(async () => {
    db = await prepareIntegrationDatabase();
    app = await createApp(
      { ...createIntegrationEnv(db.databaseUrl), INTERNAL_API_KEY: TEST_INTERNAL_KEY },
      { logStream: discardLogs() },
    );
    await app.init();
    prismaService = app.get(PrismaService);
  });

  afterAll(async () => {
    restorePrisma();
    await app?.close();
    if (db) await closeIntegrationDatabase(db);
  });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    ids = await seedDataset();
  });

  afterEach(() => {
    restorePrisma();
    jest.useRealTimers();
  });

  // 최신순: next(1일 전) > target(2일 전) > prev(3일 전). related 는 같은 카테고리의 sibling(5일 전).
  async function seedDataset(): Promise<Record<string, number>> {
    const { prisma } = db;
    const category = await createCategory(prisma, {
      name: 'Backend',
      slug: 'backend',
      sortOrder: 0,
    });
    const at = (days: number) => new Date(Date.now() - days * MS_PER_DAY);
    return {
      prev: await createPost(prisma, { slug: 'prev', title: 'Prev 원래 제목', publishedAt: at(3) }),
      target: await createPost(prisma, {
        slug: 'target',
        title: 'Target 원래 제목',
        contentMd: '원래 본문',
        publishedAt: at(2),
        categoryId: category,
      }),
      next: await createPost(prisma, { slug: 'next', title: 'Next 원래 제목', publishedAt: at(1) }),
      sibling: await createPost(prisma, {
        slug: 'sibling',
        title: 'Sibling 원래 제목',
        publishedAt: at(5),
        categoryId: category,
      }),
    };
  }

  // 앱의 PrismaService 에 훅을 건다. 첫 데이터 조회가 끝난 직후 intrude 를 한 번만 실행한다.
  function intrudeAfterFirstQuery(intrude: () => Promise<void>): () => boolean {
    let intruded = false;
    let running = false;
    installQueryHook(async () => {
      if (intruded || running) return;
      running = true;
      try {
        await intrude();
        intruded = true;
      } finally {
        running = false;
      }
    });
    return () => intruded;
  }

  // 앱의 PrismaService 의 모든 데이터 조회가 끝날 때마다 afterQuery 를 실행하도록 훅을 건다.
  function installQueryHook(afterQuery: () => Promise<void>): void {
    // Prisma 클라이언트의 모델 대리자는 자기 속성 설명자로 보이지 않으므로, 값을 저장했다가 되돌린다.
    const originals = new Map<string, unknown>();
    const define = (name: string, value: unknown) => {
      originals.set(name, (prismaService as unknown as Record<string, unknown>)[name]);
      Object.defineProperty(prismaService, name, { value, configurable: true, writable: true });
    };

    const hooked = hookQueries(prismaService, afterQuery);
    for (const name of [...MODEL_DELEGATES, ...DATA_QUERY_METHODS]) {
      define(name, (hooked as unknown as Record<string, unknown>)[name]);
    }
    const originalTransaction = prismaService.$transaction.bind(prismaService) as AnyFn;
    define('$transaction', (arg: unknown, ...rest: unknown[]) =>
      typeof arg === 'function'
        ? originalTransaction((tx: object) => (arg as AnyFn)(hookQueries(tx, afterQuery)), ...rest)
        : originalTransaction(arg, ...rest),
    );
    restorePrisma = () => {
      for (const [name, value] of originals) {
        Object.defineProperty(prismaService, name, { value, configurable: true, writable: true });
      }
      originals.clear();
      restorePrisma = () => undefined;
    };
  }

  const intrusions: [string, () => Promise<void>][] = [
    [
      'next 글의 제목이 바뀜',
      () =>
        db.prisma.post
          .update({ where: { id: ids.next }, data: { title: '바뀐 Next 제목' } })
          .then(),
    ],
    [
      'next 글이 비공개로 돌아감',
      () =>
        db.prisma.post
          .update({ where: { id: ids.next }, data: { status: 'DRAFT', publishedAt: null } })
          .then(),
    ],
    [
      'prev 글이 비공개로 돌아감',
      () =>
        db.prisma.post
          .update({ where: { id: ids.prev }, data: { status: 'DRAFT', publishedAt: null } })
          .then(),
    ],
    [
      'related 글의 제목이 바뀜',
      () =>
        db.prisma.post
          .update({ where: { id: ids.sibling }, data: { title: '바뀐 Sibling 제목' } })
          .then(),
    ],
    [
      'related 글이 비공개로 돌아감',
      () =>
        db.prisma.post
          .update({ where: { id: ids.sibling }, data: { status: 'DRAFT', publishedAt: null } })
          .then(),
    ],
    [
      '본문 글의 제목·원문이 바뀜',
      () =>
        db.prisma.post
          .update({
            where: { id: ids.target },
            data: { title: '바뀐 Target 제목', contentMd: '바뀐 본문', version: { increment: 1 } },
          })
          .then(),
    ],
  ];

  it.each(intrusions)(
    '조회 도중 %s 해도 응답은 조회 시작 시점 그대로다',
    async (_label, intrude) => {
      const baseline = (await getTarget()).body as InternalBody;
      expect(baseline.next?.title).toBe('Next 원래 제목');
      const intruded = intrudeAfterFirstQuery(intrude);

      const response = await getTarget();

      expect(intruded()).toBe(true);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(baseline);
    },
  );

  it('대조: 훅 없이 같은 변경 뒤에 다시 조회하면 바뀐 값이 보인다 (훅이 실제로 DB 를 바꿨다)', async () => {
    const intruded = intrudeAfterFirstQuery(() =>
      db.prisma.post.update({ where: { id: ids.next }, data: { title: '바뀐 Next 제목' } }).then(),
    );
    await getTarget();
    expect(intruded()).toBe(true);
    restorePrisma();

    const after = (await getTarget()).body as InternalBody;

    expect(after.next?.title).toBe('바뀐 Next 제목');
  });

  // 조회 도중 예약 발행 시각이 지나는 경우: 응답 전체가 요청 시작 시점 하나만 기준으로 삼아야 한다 (백엔드 §4.5).
  // 시계(Date)만 가짜로 두고, 데이터 조회가 하나 끝날 때마다 1시간씩 앞당긴다.
  // 같은 카테고리의 예약 글(target 보다 최신)이 시작 시각에는 비공개이므로 next·related 어디에도 나오면 안 된다.
  const MS_PER_HOUR = 60 * 60 * 1000;
  const SCHEDULE_OFFSETS_MINUTES = [30, 150];

  async function seedScheduledSibling(offsetMinutes: number): Promise<void> {
    const category = await db.prisma.category.findFirstOrThrow({ select: { id: true } });
    // 예약 글이 target 의 바로 다음 글이 되도록 기존 next 글은 지운다.
    await db.prisma.post.delete({ where: { id: ids.next } });
    await createPost(db.prisma, {
      slug: 'scheduled',
      title: 'Scheduled 제목',
      publishedAt: new Date(Date.now() + offsetMinutes * 60 * 1000),
      categoryId: category.id,
    });
  }

  function advanceClockHourlyPerQuery(): void {
    jest.useFakeTimers({
      now: Date.now(),
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
        'queueMicrotask',
        'performance',
        'hrtime',
      ],
    });
    installQueryHook(async () => {
      jest.setSystemTime(Date.now() + MS_PER_HOUR);
      return Promise.resolve();
    });
  }

  it.each(SCHEDULE_OFFSETS_MINUTES)(
    '내부 상세: 조회 도중 %i분 뒤 예약 발행 시각이 지나도 next·related 모두 시작 시점 기준으로 제외된다',
    async (offsetMinutes) => {
      await seedScheduledSibling(offsetMinutes);
      advanceClockHourlyPerQuery();

      const response = await getTarget();

      const body = response.body as InternalBody;
      expect(response.status).toBe(200);
      expect(body.next).toBeNull();
      expect(body.related.map((post) => post.slug)).toEqual(['sibling']);
    },
  );

  it('공개 상세: 조회 도중 예약 발행 시각이 지나도 next·related 모두 시작 시점 기준으로 제외된다', async () => {
    await seedScheduledSibling(30);
    advanceClockHourlyPerQuery();

    const response = await request(app.getHttpServer()).get('/api/posts/target');

    const body = response.body as InternalBody;
    expect(response.status).toBe(200);
    expect(body.next).toBeNull();
    expect(body.related.map((post) => post.slug)).toEqual(['sibling']);
  });
});
