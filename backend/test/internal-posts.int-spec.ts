import type { INestApplication } from '@nestjs/common';
import { Writable } from 'node:stream';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import { expectErrorShape } from './fixtures/error-body';
import { INTERNAL_KEY_HEADER_NAME, TEST_INTERNAL_KEY } from './fixtures/internal-key';
import {
  createCategory,
  createOldSlug,
  createPost,
  createTag,
  MS_PER_DAY,
} from './fixtures/public-read-data';
import {
  closeIntegrationDatabase,
  createIntegrationEnv,
  type IntegrationDatabase,
  prepareIntegrationDatabase,
  resetDatabase,
} from './support/integration-db';

// 내부 원문 API GET /internal/posts/{slug} + InternalKeyGuard (M2-04 동작 규약 2·3·5·6·7).
// 스냅샷(규약 4)은 internal-posts-snapshot.int-spec.ts가 맡는다.

const CACHE_CONTROL_PRIVATE_NO_STORE = 'private, no-store';
const LOG_WAIT_TIMEOUT_MS = 2_000;
const LOG_POLL_INTERVAL_MS = 10;

interface Link {
  slug: string;
  title: string;
}
interface InternalBody {
  post: Record<string, unknown> & { slug: string; contentMd: string; version: number };
  prev: Link | null;
  next: Link | null;
  related: { slug: string }[];
}
interface PublicBody {
  post: Record<string, unknown>;
  prev: Link | null;
  next: Link | null;
  related: unknown[];
}

function createLogCollector(): { stream: Writable; output: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return { stream, output: () => chunks.join('') };
}

describe('내부 원문 API (실제 PostgreSQL)', () => {
  let db: IntegrationDatabase;
  let app: INestApplication;
  const logs = createLogCollector();
  const base = Date.now();
  const daysAgo = (days: number): Date => new Date(base - days * MS_PER_DAY);

  const getInternal = (path: string, key: string | undefined = TEST_INTERNAL_KEY) => {
    const call = request(app.getHttpServer()).get(path);
    return key === undefined ? call : call.set(INTERNAL_KEY_HEADER_NAME, key);
  };

  // 요청 로그는 응답이 끝난 뒤 쓰이므로, 해당 경로의 로그가 보일 때까지 짧게 기다린다.
  async function waitForLogOf(path: string): Promise<string> {
    const deadline = Date.now() + LOG_WAIT_TIMEOUT_MS;
    while (!logs.output().includes(path) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, LOG_POLL_INTERVAL_MS));
    }
    return logs.output();
  }

  beforeAll(async () => {
    db = await prepareIntegrationDatabase();
    app = await createApp(
      { ...createIntegrationEnv(db.databaseUrl), INTERNAL_API_KEY: TEST_INTERNAL_KEY },
      { logStream: logs.stream },
    );
    await app.init();
    await resetDatabase(db.prisma);
    await seedDataset();
  });

  afterAll(async () => {
    await app?.close();
    if (db) await closeIntegrationDatabase(db);
  });

  // 최신순: n1(1일 전) > target(2일 전) > o1(3일 전) 이고, 같은 카테고리 형제 s1이 있다.
  // target 은 old-target 이라는 이전 slug를 갖는다.
  async function seedDataset(): Promise<void> {
    const { prisma } = db;
    const backend = await createCategory(prisma, {
      name: 'Backend',
      slug: 'backend',
      sortOrder: 0,
    });
    const alpha = await createTag(prisma, { name: 'Alpha', slug: 'alpha' });
    await createPost(prisma, { slug: 'o1', title: 'O1', publishedAt: daysAgo(3) });
    const targetId = await createPost(prisma, {
      slug: 'target',
      title: 'Target',
      contentMd: '# 원문 본문 MARKER-TARGET',
      publishedAt: daysAgo(2),
      categoryId: backend,
      tagIds: [alpha],
    });
    await createPost(prisma, { slug: 'n1', title: 'N1', publishedAt: daysAgo(1) });
    await createPost(prisma, {
      slug: 's1',
      title: 'S1',
      publishedAt: daysAgo(5),
      categoryId: backend,
    });
    await createOldSlug(prisma, 'old-target', targetId);

    const draftId = await createPost(prisma, {
      slug: 'draft-post',
      title: 'Draft',
      status: 'DRAFT',
      publishedAt: null,
      contentMd: '초안 원문 MARKER-DRAFT',
    });
    await createPost(prisma, {
      slug: 'scheduled-post',
      title: 'Scheduled',
      publishedAt: new Date(base + MS_PER_DAY),
      contentMd: '예약 원문 MARKER-SCHEDULED',
    });
    await createOldSlug(prisma, 'old-draft', draftId);
    await createOldSlug(prisma, 'old-deleted', null);
  }

  describe('InternalKeyGuard: 키 검증 (규약 2)', () => {
    const wrongKeys: [string, string | undefined][] = [
      ['헤더 없음', undefined],
      ['빈 값', ''],
      ['불일치(같은 길이)', 'x'.repeat(TEST_INTERNAL_KEY.length)],
      ['길이가 짧음', TEST_INTERNAL_KEY.slice(0, -1)],
      ['길이가 김', `${TEST_INTERNAL_KEY}-extra`],
      ['앞부분만 같고 한 글자 다름', `${TEST_INTERNAL_KEY.slice(0, -1)}X`],
      ['대소문자만 다름', TEST_INTERNAL_KEY.toUpperCase()],
    ];
    const slugs = [
      ['존재하는 공개 글', 'target'],
      ['이전 slug', 'old-target'],
      ['비공개 글', 'draft-post'],
      ['없는 글', 'no-such-post'],
    ];

    const cases = wrongKeys.flatMap(([keyLabel, key]) =>
      slugs.map(([slugLabel, slug]) => ({ keyLabel, slugLabel, key, slug })),
    );

    it.each(cases)(
      '키 $keyLabel + $slugLabel 는 401 UNAUTHORIZED 다 (slug 존재 여부와 무관)',
      async ({ key, slug }) => {
        const path = `/internal/posts/${slug}`;

        const response = await getInternal(path, key);

        expect(response.status).toBe(401);
        expectErrorShape(response.body as never, { statusCode: 401, code: 'UNAUTHORIZED', path });
        expect(response.headers['cache-control']).toBe(CACHE_CONTROL_PRIVATE_NO_STORE);
      },
    );

    it('401 응답 본문·헤더 어디에도 올바른 키나 마지막 시도한 키 값이 없다', async () => {
      const attempt = 'attempt-key-value-zzz-123';

      const response = await getInternal('/internal/posts/target', attempt);

      const everything = JSON.stringify([response.body, response.headers, response.text]);
      expect(everything).not.toContain(attempt);
      expect(everything).not.toContain(TEST_INTERNAL_KEY);
    });

    it('키가 같은 헤더가 여러 번 오면(쉼표로 합쳐져 길이가 달라짐) 401 이다', async () => {
      const response = await getInternal(
        '/internal/posts/target',
        `${TEST_INTERNAL_KEY}, ${TEST_INTERNAL_KEY}`,
      );

      expect(response.status).toBe(401);
    });
  });

  describe('공개 글 응답 (규약 3)', () => {
    it('키가 맞으면 원문·version·메타·prev/next/related 를 담은 응답이 온다', async () => {
      const response = await getInternal('/internal/posts/target');

      expect(response.status).toBe(200);
      const body = response.body as InternalBody;
      expect(Object.keys(body).sort()).toEqual(['next', 'post', 'prev', 'related']);
      expect(body.post.slug).toBe('target');
      expect(body.post.contentMd).toBe('# 원문 본문 MARKER-TARGET');
      expect(body.post.version).toBe(1);
      expect(body.prev).toEqual({ slug: 'o1', title: 'O1' });
      expect(body.next).toEqual({ slug: 'n1', title: 'N1' });
      expect(body.related.map((item) => item.slug)).toEqual(['s1']);
    });

    it('메타·prev·next·related 는 공개 상세(/api/posts/{slug})와 같고 원문·version 만 더해진다', async () => {
      const internal = (await getInternal('/internal/posts/target')).body as InternalBody;
      const publicBody = (await request(app.getHttpServer()).get('/api/posts/target'))
        .body as PublicBody;

      const { contentMd, version, ...meta } = internal.post;
      expect(contentMd).toBeDefined();
      expect(version).toBeDefined();
      expect(meta).toEqual(publicBody.post);
      expect(internal.prev).toEqual(publicBody.prev);
      expect(internal.next).toEqual(publicBody.next);
      expect(internal.related).toEqual(publicBody.related);
    });

    it('공개 API 응답에는 원문과 version 이 여전히 없다 (회귀)', async () => {
      const response = await request(app.getHttpServer()).get('/api/posts/target');

      expect(JSON.stringify(response.body)).not.toContain('MARKER-TARGET');
      expect(Object.keys((response.body as PublicBody).post)).not.toContain('contentMd');
      expect(Object.keys((response.body as PublicBody).post)).not.toContain('version');
    });

    it('이전 slug 는 200 { redirectTo: 현재 slug } 다', async () => {
      const response = await getInternal('/internal/posts/old-target');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ redirectTo: 'target' });
    });

    it('이전 slug 의 대상이 비공개면 404 POST_NOT_FOUND 다 (비공개 글의 현재 slug 를 알려 주지 않는다)', async () => {
      const response = await getInternal('/internal/posts/old-draft');

      expect(response.status).toBe(404);
      expectErrorShape(response.body as never, {
        statusCode: 404,
        code: 'POST_NOT_FOUND',
        path: '/internal/posts/old-draft',
      });
      expect(JSON.stringify(response.body)).not.toContain('draft-post');
    });

    it.each([
      ['초안', 'draft-post', 'MARKER-DRAFT'],
      ['예약', 'scheduled-post', 'MARKER-SCHEDULED'],
      ['없는 글', 'no-such-post', 'MARKER-NONE'],
      ['삭제된 글의 이전 slug', 'old-deleted', 'MARKER-NONE'],
    ])('%s(%s) 는 404 POST_NOT_FOUND 이고 원문이 나오지 않는다', async (_label, slug, marker) => {
      const response = await getInternal(`/internal/posts/${slug}`);

      expect(response.status).toBe(404);
      expectErrorShape(response.body as never, {
        statusCode: 404,
        code: 'POST_NOT_FOUND',
        path: `/internal/posts/${slug}`,
      });
      expect(JSON.stringify(response.body)).not.toContain(marker);
    });

    it('/api/internal/posts/{slug} 는 키가 맞아도 404 다 (내부 API 는 전역 prefix 밖, 규약 7)', async () => {
      const response = await getInternal('/api/internal/posts/target');

      expect(response.status).toBe(404);
      expect(JSON.stringify(response.body)).not.toContain('MARKER-TARGET');
    });

    it('/api/internal/posts/x 는 키가 없어도 404 다', async () => {
      const response = await getInternal('/api/internal/posts/x', undefined);

      expect(response.status).toBe(404);
    });
  });

  describe('Cache-Control (규약 5)', () => {
    it.each([
      {
        label: '200 본문',
        path: '/internal/posts/target',
        key: TEST_INTERNAL_KEY,
        status: 200,
      },
      {
        label: '200 이전 slug',
        path: '/internal/posts/old-target',
        key: TEST_INTERNAL_KEY,
        status: 200,
      },
      {
        label: '404',
        path: '/internal/posts/no-such-post',
        key: TEST_INTERNAL_KEY,
        status: 404,
      },
      { label: '401', path: '/internal/posts/target', key: 'wrong-key-wrong-key-1', status: 401 },
    ])('$label 는 private, no-store 다', async ({ path, key, status }) => {
      const response = await getInternal(path, key);

      expect(response.status).toBe(status);
      expect(response.headers['cache-control']).toBe(CACHE_CONTROL_PRIVATE_NO_STORE);
    });
  });

  describe('로그 마스킹 (규약 6)', () => {
    it('정상 요청 로그에 키 값이 없다 (요청 로그 자체는 남는다)', async () => {
      const path = '/internal/posts/n1?log-probe=ok';

      const response = await getInternal(path);
      const output = await waitForLogOf('log-probe=ok');

      expect(response.status).toBe(200);
      expect(output).toContain('log-probe=ok');
      expect(output).not.toContain(TEST_INTERNAL_KEY);
    });

    it('401 요청 로그에 시도한 키 값이 없다', async () => {
      const attempt = 'attempt-key-value-log-401';

      const response = await getInternal('/internal/posts/n1?log-probe=denied', attempt);
      const output = await waitForLogOf('log-probe=denied');

      expect(response.status).toBe(401);
      expect(output).toContain('log-probe=denied');
      expect(output).not.toContain(attempt);
      expect(output).not.toContain(TEST_INTERNAL_KEY);
    });

    it('앱이 뜬 뒤 지금까지의 모든 로그 어디에도 올바른 키 값이 없다', () => {
      expect(logs.output()).not.toContain(TEST_INTERNAL_KEY);
    });
  });
});
