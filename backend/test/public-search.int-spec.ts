import type { INestApplication } from '@nestjs/common';
import { Writable } from 'node:stream';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import { expectErrorShape } from './fixtures/error-body';
import { createPost, MS_PER_DAY } from './fixtures/public-read-data';
import {
  closeIntegrationDatabase,
  createIntegrationEnv,
  type IntegrationDatabase,
  prepareIntegrationDatabase,
  resetDatabase,
} from './support/integration-db';

// 검색 API와 목록 자동 excerpt (M2-03 동작 규약 2·5, 백엔드 §5.4). 시드에 기대지 않는다.

const CACHE_CONTROL_SEARCH = 'public, max-age=30';
const CACHE_CONTROL_NO_STORE = 'no-store';
const AUTO_EXCERPT_LENGTH = 160;

function discardLogs(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

interface Item {
  slug: string;
  excerpt: string;
}
interface ListBody {
  items: Item[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

const slugsOf = (body: ListBody): string[] => body.items.map((item) => item.slug);

describe('검색 API (실제 PostgreSQL)', () => {
  let db: IntegrationDatabase;
  let app: INestApplication;
  const base = Date.now();
  const daysAgo = (days: number): Date => new Date(base - days * MS_PER_DAY);

  const search = (q: string, extra = '') =>
    request(app.getHttpServer()).get(`/api/search?q=${encodeURIComponent(q)}${extra}`);

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

  async function seedDataset(): Promise<void> {
    const { prisma } = db;
    // 제목 일치(더 최근) → 제목 일치(더 오래됨) → 본문 일치(최근) → 요약 일치
    await createPost(prisma, {
      slug: 't-old',
      title: 'DOCKER Tips',
      publishedAt: daysAgo(10),
      contentMd: '내용',
    });
    await createPost(prisma, {
      slug: 't-new',
      title: 'Docker 입문',
      publishedAt: daysAgo(5),
      contentMd: '내용',
    });
    await createPost(prisma, {
      slug: 'c-body',
      title: '다른 글',
      publishedAt: daysAgo(1),
      contentMd: 'docker 컴포즈 사용법',
    });
    await createPost(prisma, {
      slug: 'c-excerpt',
      title: '또 다른 글',
      publishedAt: daysAgo(2),
      excerpt: 'dockerfile 팁',
      contentMd: '내용',
    });
    // 같은 시각의 제목 일치: id 큰 쪽이 먼저
    const same = daysAgo(20);
    await createPost(prisma, {
      slug: 'tie-a',
      title: 'Tie 글',
      publishedAt: same,
      contentMd: '내용',
    });
    await createPost(prisma, {
      slug: 'tie-b',
      title: 'Tie 글',
      publishedAt: same,
      contentMd: '내용',
    });
    // 공개되면 안 되는 글(제목·본문 모두 일치해도 나오면 안 된다)
    await createPost(prisma, {
      slug: 'draft-hit',
      title: 'Docker 초안',
      status: 'DRAFT',
      publishedAt: null,
      contentMd: 'docker',
    });
    await createPost(prisma, {
      slug: 'scheduled-hit',
      title: 'Docker 예약',
      publishedAt: new Date(base + 30 * MS_PER_DAY),
      contentMd: 'docker',
    });
    // 와일드카드 이스케이프 검증용
    await createPost(prisma, {
      slug: 'pct',
      title: '100% 확실',
      publishedAt: daysAgo(30),
      contentMd: '내용',
    });
    await createPost(prisma, {
      slug: 'pct-decoy',
      title: '1000 확실',
      publishedAt: daysAgo(31),
      contentMd: '내용',
    });
    await createPost(prisma, {
      slug: 'under',
      title: 'a_b 변수',
      publishedAt: daysAgo(32),
      contentMd: '내용',
    });
    await createPost(prisma, {
      slug: 'under-decoy',
      title: 'axb 변수',
      publishedAt: daysAgo(33),
      contentMd: '내용',
    });
    await createPost(prisma, {
      slug: 'ab-post',
      title: 'ab test',
      publishedAt: daysAgo(34),
      contentMd: '내용',
    });
  }

  it('대소문자를 가리지 않고, 제목 일치가 본문·요약 일치보다 앞이며 그 안에서는 최신순이다', async () => {
    const response = await search('docker');

    expect(response.status).toBe(200);
    expect(slugsOf(response.body as ListBody)).toEqual(['t-new', 't-old', 'c-body', 'c-excerpt']);
  });

  it('검색어 대소문자가 달라도 같은 결과다', async () => {
    const lower = await search('docker');
    const upper = await search('DOCKER');

    expect(upper.body).toEqual(lower.body);
  });

  it('제목이 같은 시각이면 id 큰 글이 먼저다', async () => {
    const body = (await search('Tie')).body as ListBody;

    expect(slugsOf(body)).toEqual(['tie-b', 'tie-a']);
  });

  it('한글 부분 일치로 찾는다 (본문 "컴포즈" ← "컴포", 제목 "입문")', async () => {
    expect(slugsOf((await search('컴포')).body as ListBody)).toEqual(['c-body']);
    expect(slugsOf((await search('입문')).body as ListBody)).toEqual(['t-new']);
  });

  it('요약(excerpt)에만 있는 단어도 찾는다', async () => {
    expect(slugsOf((await search('dockerfile')).body as ListBody)).toEqual(['c-excerpt']);
  });

  it('초안·예약 글은 제목·본문이 일치해도 결과와 totalItems 에 들어오지 않는다', async () => {
    const body = (await search('docker')).body as ListBody;

    expect(body.totalItems).toBe(4);
    expect(slugsOf(body)).not.toContain('draft-hit');
    expect(slugsOf(body)).not.toContain('scheduled-hit');
  });

  it('결과 형태는 목록과 같다 (items·page·size·totalItems·totalPages, 항목은 PostSummary)', async () => {
    const body = (await search('docker')).body as ListBody;

    expect(Object.keys(body).sort()).toEqual(['items', 'page', 'size', 'totalItems', 'totalPages']);
    expect(body).toMatchObject({ page: 1, size: 9, totalItems: 4, totalPages: 1 });
    expect(Object.keys(body.items[0] ?? {}).sort()).toEqual([
      'category',
      'coverImageUrl',
      'excerpt',
      'likeCount',
      'publishedAt',
      'readingMinutes',
      'slug',
      'title',
      'viewCount',
    ]);
  });

  it('페이지네이션을 따른다 (size 1, page 2 → 두 번째 결과, 범위 밖은 빈 items)', async () => {
    const second = (await search('docker', '&size=1&page=2')).body as ListBody;
    const outOfRange = await search('docker', '&page=9');

    expect(slugsOf(second)).toEqual(['t-old']);
    expect(second.totalPages).toBe(4);
    expect(outOfRange.status).toBe(200);
    expect((outOfRange.body as ListBody).items).toEqual([]);
  });

  it('일치하는 글이 없으면 빈 목록(200)이다', async () => {
    const response = await search('zzzz-없는-단어');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ items: [], totalItems: 0, totalPages: 0 });
  });

  it('q 앞뒤 공백은 제거한다 (" ab " → "ab" 로 검색)', async () => {
    const response = await search(' ab ');

    expect(response.status).toBe(200);
    expect(slugsOf(response.body as ListBody)).toContain('ab-post');
  });

  describe('LIKE 와일드카드 이스케이프', () => {
    it('% 는 문자 그대로만 일치한다 ("0% 확" 은 "100% 확실" 만, "1000 확실" 은 아님)', async () => {
      expect(slugsOf((await search('0% 확')).body as ListBody)).toEqual(['pct']);
    });

    it('_ 는 문자 그대로만 일치한다 ("a_b" 는 "a_b 변수" 만, "axb 변수" 는 아님)', async () => {
      expect(slugsOf((await search('a_b')).body as ListBody)).toEqual(['under']);
    });

    it.each([['%%'], ['__'], ['%_']])(
      '와일드카드만으로 된 검색어(%s)는 모든 글에 일치하지 않는다',
      async (q) => {
        const response = await search(q);

        expect(response.status).toBe(200);
        expect((response.body as ListBody).items).toEqual([]);
      },
    );
  });

  it('SQL 조각이 들어간 q 도 값으로만 다루고 데이터를 건드리지 않는다', async () => {
    const response = await search('\'; DROP TABLE "Post"; --');

    expect(response.status).toBe(200);
    expect((response.body as ListBody).items).toEqual([]);
    expect(await db.prisma.post.count()).toBe(13);
  });

  describe('입력 검증', () => {
    it.each([[''], ['a'], ['   '], [' a '], ['가']])(
      'q 가 비었거나 공백 제거 후 1자 이하("%s")면 400 VALIDATION_FAILED 다',
      async (q) => {
        const response = await search(q);

        expect(response.status).toBe(400);
        expectErrorShape(response.body, {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          path: '/api/search', // 검색어가 에러 응답에 남지 않도록 쿼리스트링은 뺀다
        });
      },
    );

    it('q 가 없으면 400 VALIDATION_FAILED 다', async () => {
      const response = await request(app.getHttpServer()).get('/api/search');

      expect(response.status).toBe(400);
      expectErrorShape(response.body, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        path: '/api/search',
      });
    });

    it.each([['page=0'], ['page=1.5'], ['size=51'], ['size=0']])(
      '잘못된 페이지 쿼리(%s)는 400 이다',
      async (query) => {
        const response = await search('docker', `&${query}`);

        expect(response.status).toBe(400);
        expect((response.body as { code: string }).code).toBe('VALIDATION_FAILED');
      },
    );
  });

  describe('Cache-Control', () => {
    it('검색 성공 응답은 public, max-age=30 이다', async () => {
      expect((await search('docker')).headers['cache-control']).toBe(CACHE_CONTROL_SEARCH);
    });

    it('검색 400 응답은 no-store 다', async () => {
      expect((await search('a')).headers['cache-control']).toBe(CACHE_CONTROL_NO_STORE);
    });
  });
});

describe('목록 excerpt 자동 생성 (실제 PostgreSQL)', () => {
  let db: IntegrationDatabase;
  let app: INestApplication;

  const list = async (): Promise<Item[]> => {
    const response = await request(app.getHttpServer()).get('/api/posts?size=50');
    expect(response.status).toBe(200);
    return (response.body as ListBody).items;
  };

  beforeAll(async () => {
    db = await prepareIntegrationDatabase();
    app = await createApp(createIntegrationEnv(db.databaseUrl), { logStream: discardLogs() });
    await app.init();
    await resetDatabase(db.prisma);
    const { prisma } = db;
    const now = Date.now();
    await createPost(prisma, {
      slug: 'stored',
      title: 'S',
      excerpt: '저장된 요약',
      contentMd: '# 본문은 다르다',
      publishedAt: new Date(now - 4 * MS_PER_DAY),
    });
    await createPost(prisma, {
      slug: 'markdown',
      title: 'M',
      excerpt: null,
      contentMd:
        '## 제목입니다\n\n**굵은글씨** 와 [링크문구](https://example.com/x) 그리고 `코드` 입니다.\n\n- 목록항목',
      publishedAt: new Date(now - 3 * MS_PER_DAY),
    });
    await createPost(prisma, {
      slug: 'long',
      title: 'L',
      excerpt: null,
      contentMd: `# 헤딩\n\n${'가'.repeat(400)}`,
      publishedAt: new Date(now - 2 * MS_PER_DAY),
    });
    await createPost(prisma, {
      slug: 'fenced',
      title: 'F',
      excerpt: null,
      contentMd:
        '앞 문장입니다.\n\n```ts\nconst secretCode = 1;\n```\n\n![대체문구](https://example.com/a.png "그림캡션")\n\n뒤 문장입니다.',
      publishedAt: new Date(now - 1.5 * MS_PER_DAY),
    });
    await createPost(prisma, {
      slug: 'short',
      title: 'T',
      excerpt: null,
      contentMd: '짧은 본문',
      publishedAt: new Date(now - 1 * MS_PER_DAY),
    });
  });

  afterAll(async () => {
    await app?.close();
    if (db) await closeIntegrationDatabase(db);
  });

  it('excerpt 가 저장돼 있으면 본문과 무관하게 그대로 쓴다', async () => {
    const item = (await list()).find((post) => post.slug === 'stored');

    expect(item?.excerpt).toBe('저장된 요약');
  });

  it('excerpt 가 없으면 본문에서 Markdown 기호를 걷어 낸 글자만 남긴다', async () => {
    const excerpt = (await list()).find((post) => post.slug === 'markdown')?.excerpt ?? '';

    for (const text of ['제목입니다', '굵은글씨', '링크문구', '코드', '목록항목']) {
      expect(excerpt).toContain(text);
    }
    for (const symbol of ['#', '*', '`', '](', 'https://example.com']) {
      expect(excerpt).not.toContain(symbol);
    }
  });

  it('긴 본문은 기호를 걷어 낸 앞 160자로 자른다', async () => {
    const excerpt = (await list()).find((post) => post.slug === 'long')?.excerpt;

    // 헤딩 문구는 남고 기호만 빠진다(위 Markdown 테스트와 같은 규칙)
    expect(excerpt).toBe(`헤딩 ${'가'.repeat(400)}`.slice(0, AUTO_EXCERPT_LENGTH));
  });

  it('코드 블록과 이미지 문법은 요약에 섞지 않고 일반 문장만 남긴다', async () => {
    const excerpt = (await list()).find((post) => post.slug === 'fenced')?.excerpt ?? '';

    expect(excerpt).toContain('앞 문장입니다.');
    expect(excerpt).toContain('뒤 문장입니다.');
    for (const leaked of ['secretCode', '```', '![', 'a.png']) {
      expect(excerpt).not.toContain(leaked);
    }
  });

  it('160자보다 짧은 본문은 그대로 쓴다', async () => {
    const excerpt = (await list()).find((post) => post.slug === 'short')?.excerpt;

    expect(excerpt).toBe('짧은 본문');
  });
});
