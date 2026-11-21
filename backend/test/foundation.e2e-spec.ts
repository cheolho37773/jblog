import type { INestApplication } from '@nestjs/common';
import { Writable } from 'node:stream';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import { buildUnreachableDatabaseUrl } from './fixtures/database-url';
import { expectErrorShape } from './fixtures/error-body';
import {
  PROBE_APP_500_CODE,
  PROBE_APP_ERROR,
  PROBE_HTTP_5XX_MESSAGE,
  PROBE_INTERNAL_ERROR_MESSAGE,
  PROBE_SET_COOKIE_VALUE,
  ProbeModule,
} from './fixtures/probe.module';

// DB 없이 앱이 떠야 한다(M0-06 규약 7): 닫힌 포트를 가리키는 더미 DATABASE_URL을 쓴다.
const DUMMY_DATABASE_URL = buildUnreachableDatabaseUrl();
const DEV_ENV = { NODE_ENV: 'development', API_PORT: '4000', DATABASE_URL: DUMMY_DATABASE_URL };
const PRODUCTION_ENV = {
  NODE_ENV: 'production',
  API_PORT: '4000',
  DATABASE_URL: DUMMY_DATABASE_URL,
};
const GENERIC_500_MESSAGE_MAX_LENGTH = 100;

const REQUEST_ID_HEADER = 'x-request-id';
const SENT_REQUEST_ID = 'req-id-from-client-123';
const AUTHORIZATION_VALUE = 'Bearer dummy-authorization-token-a1';
const COOKIE_VALUE = 'jb_session=dummy-cookie-value-b2';

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

async function waitForLogFlush(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

async function startApp(
  env: Record<string, unknown>,
  logStream?: NodeJS.WritableStream,
): Promise<INestApplication> {
  const app = await createApp(env, { imports: [ProbeModule], logStream });
  await app.init();
  return app;
}

describe('Nest 기반 (development)', () => {
  let app: INestApplication;
  let logs: ReturnType<typeof createLogCollector>;

  beforeAll(async () => {
    logs = createLogCollector();
    app = await startApp(DEV_ENV, logs.stream);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('에러 응답 형식', () => {
    it('없는 경로는 404 NOT_FOUND 에러 형식이다', async () => {
      const response = await request(app.getHttpServer()).get('/api/does-not-exist');

      expect(response.status).toBe(404);
      expectErrorShape(response.body, {
        statusCode: 404,
        code: 'NOT_FOUND',
        path: '/api/does-not-exist',
      });
    });

    it('ValidationPipe 실패는 400 VALIDATION_FAILED 에러 형식이다', async () => {
      const response = await request(app.getHttpServer()).post('/api/probe/validate').send({});

      expect(response.status).toBe(400);
      expectErrorShape(response.body, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        path: '/api/probe/validate',
      });
    });

    it('허용되지 않은 필드를 보내면 400 VALIDATION_FAILED 에러 형식이다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/probe/validate')
        .send({ title: 'ok', unexpected: 'x' });

      expect(response.status).toBe(400);
      expectErrorShape(response.body, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        path: '/api/probe/validate',
      });
    });

    it('올바른 본문은 검증을 통과한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/probe/validate')
        .send({ title: 'ok' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ title: 'ok' });
    });

    it('AppException 은 지정한 상태·코드·메시지로 응답한다', async () => {
      const response = await request(app.getHttpServer()).get('/api/probe/app-error');

      expect(response.status).toBe(PROBE_APP_ERROR.status);
      expectErrorShape(response.body, {
        statusCode: PROBE_APP_ERROR.status,
        code: PROBE_APP_ERROR.code,
        path: '/api/probe/app-error',
      });
      expect(response.body.message).toBe(PROBE_APP_ERROR.message);
    });

    it('알 수 없는 오류는 500 INTERNAL_ERROR 이고 스택·원래 메시지를 응답에 넣지 않는다', async () => {
      const response = await request(app.getHttpServer()).get('/api/probe/unknown-error');

      expect(response.status).toBe(500);
      expectErrorShape(response.body, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        path: '/api/probe/unknown-error',
      });
      expect(response.text).not.toContain(PROBE_INTERNAL_ERROR_MESSAGE);
      expect(response.text).not.toMatch(/\bat\s.+\(.+:\d+:\d+\)/);
      expect(response.text).not.toContain('stack');
      expect(response.body.message.length).toBeLessThan(GENERIC_500_MESSAGE_MAX_LENGTH);
    });

    it('500 의 원래 오류는 서버 로그에만 남는다', async () => {
      await request(app.getHttpServer()).get('/api/probe/unknown-error');
      await waitForLogFlush();

      expect(logs.output()).toContain(PROBE_INTERNAL_ERROR_MESSAGE);
    });

    describe('5xx HttpException 계열도 내부 메시지를 응답에 넣지 않는다 (Codex r1 #1)', () => {
      const GENERIC_MESSAGE_ROUTE = '/api/probe/unknown-error';
      const cases = [
        {
          name: 'InternalServerErrorException',
          path: '/api/probe/internal-server-error',
          status: 500,
          code: 'INTERNAL_ERROR',
        },
        {
          name: 'HttpException(500)',
          path: '/api/probe/http-500',
          status: 500,
          code: 'INTERNAL_ERROR',
        },
        {
          name: 'AppException(500) 은 지정 코드를 유지한다',
          path: '/api/probe/app-500',
          status: 500,
          code: PROBE_APP_500_CODE,
        },
        {
          name: 'ServiceUnavailableException(503)',
          path: '/api/probe/service-unavailable',
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
        },
      ];

      it.each(cases)(
        '$name: 일반 문구로 응답하고 원래 메시지는 서버 로그에 남는다',
        async ({ path, status, code }) => {
          const generic = await request(app.getHttpServer()).get(GENERIC_MESSAGE_ROUTE);
          const response = await request(app.getHttpServer()).get(path);
          await waitForLogFlush();

          expect(response.status).toBe(status);
          expectErrorShape(response.body, { statusCode: status, code, path });
          expect(response.body.message).toBe(generic.body.message);
          expect(response.text).not.toContain(PROBE_HTTP_5XX_MESSAGE);
          expect(logs.output()).toContain(PROBE_HTTP_5XX_MESSAGE);
        },
      );
    });

    it('path 에는 쿼리 문자열이 아닌 요청 경로가 담긴다', async () => {
      const response = await request(app.getHttpServer()).get('/api/does-not-exist?x=1');

      expect(response.body.path).toBe('/api/does-not-exist');
    });
  });

  describe('Swagger', () => {
    it('development 에서 /api/docs 는 200 이다', async () => {
      const response = await request(app.getHttpServer()).get('/api/docs');

      expect(response.status).toBe(200);
    });
  });

  describe('x-request-id', () => {
    it('들어온 x-request-id 를 응답 헤더로 그대로 돌려준다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/does-not-exist')
        .set(REQUEST_ID_HEADER, SENT_REQUEST_ID);

      expect(response.headers[REQUEST_ID_HEADER]).toBe(SENT_REQUEST_ID);
    });

    it('x-request-id 가 없으면 생성하고 요청마다 다르다', async () => {
      const first = await request(app.getHttpServer()).get('/api/does-not-exist');
      const second = await request(app.getHttpServer()).get('/api/does-not-exist');

      expect(first.headers[REQUEST_ID_HEADER]).toBeTruthy();
      expect(second.headers[REQUEST_ID_HEADER]).toBeTruthy();
      expect(first.headers[REQUEST_ID_HEADER]).not.toBe(second.headers[REQUEST_ID_HEADER]);
    });
  });

  describe('Swagger 경로의 x-request-id (Codex r1 #2)', () => {
    it('/api/docs 에 보낸 x-request-id 를 응답 헤더로 돌려준다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/docs')
        .set(REQUEST_ID_HEADER, SENT_REQUEST_ID);

      expect(response.status).toBe(200);
      expect(response.headers[REQUEST_ID_HEADER]).toBe(SENT_REQUEST_ID);
    });

    it('/api/docs 에 x-request-id 가 없으면 생성한다', async () => {
      const response = await request(app.getHttpServer()).get('/api/docs');

      expect(response.headers[REQUEST_ID_HEADER]).toBeTruthy();
    });
  });

  describe('로그 redact', () => {
    it('Authorization·Cookie 요청 헤더와 Set-Cookie 응답 헤더 값이 로그에 남지 않는다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/probe/set-cookie')
        .set('Authorization', AUTHORIZATION_VALUE)
        .set('Cookie', COOKIE_VALUE);
      await waitForLogFlush();

      expect(response.headers['set-cookie']).toBeDefined();
      const output = logs.output();
      expect(output).toContain('/api/probe/set-cookie');
      expect(output).not.toContain(AUTHORIZATION_VALUE);
      expect(output).not.toContain(COOKIE_VALUE);
      expect(output).not.toContain(PROBE_SET_COOKIE_VALUE);
    });

    it('헤더가 로그에 실제로 기록되며 값만 [Redacted] 로 가려진다 (redact 대상이 비어 있어 우연히 통과하는 것 방지)', async () => {
      await request(app.getHttpServer())
        .get('/api/probe/set-cookie')
        .set('Authorization', AUTHORIZATION_VALUE)
        .set('Cookie', COOKIE_VALUE);
      await waitForLogFlush();

      const entry = logs
        .output()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .find((parsed) => parsed.req?.url === '/api/probe/set-cookie' && parsed.res);
      expect(entry.req.headers.authorization).toBe('[Redacted]');
      expect(entry.req.headers.cookie).toBe('[Redacted]');
      expect(entry.res.headers['set-cookie']).toBe('[Redacted]');
    });

    it('로그는 한 줄에 하나씩 JSON 이다', async () => {
      await request(app.getHttpServer()).get('/api/does-not-exist');
      await waitForLogFlush();

      const lines = logs.output().split('\n').filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });
  });
});

describe('Nest 기반 (production)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await startApp(PRODUCTION_ENV, createLogCollector().stream);
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/docs 는 404 에러 형식이다', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs');

    expect(response.status).toBe(404);
    expectErrorShape(response.body, { statusCode: 404, code: 'NOT_FOUND', path: '/api/docs' });
  });
});

describe('createApp 환경변수 검증', () => {
  it.each([
    ['NODE_ENV 누락', { API_PORT: '4000', DATABASE_URL: DUMMY_DATABASE_URL }, 'NODE_ENV'],
    ['API_PORT 누락', { NODE_ENV: 'development', DATABASE_URL: DUMMY_DATABASE_URL }, 'API_PORT'],
    ['API_PORT=abc', { ...DEV_ENV, API_PORT: 'abc' }, 'API_PORT'],
    ['NODE_ENV=staging', { ...DEV_ENV, NODE_ENV: 'staging' }, 'NODE_ENV'],
    ['DATABASE_URL 누락', { NODE_ENV: 'development', API_PORT: '4000' }, 'DATABASE_URL'],
    ['DATABASE_URL=not-a-url', { ...DEV_ENV, DATABASE_URL: 'not-a-url' }, 'DATABASE_URL'],
  ])(
    '%s 이면 앱 생성이 reject 되고 메시지에 변수 이름이 있다',
    async (_caseName, env, variableName) => {
      await expect(createApp(env, { logStream: createLogCollector().stream })).rejects.toThrow(
        variableName,
      );
    },
  );

  it('DATABASE_URL 이 형식 오류면 앱 생성이 reject 되고 메시지에 입력값을 넣지 않는다', async () => {
    const leakCheckValue = 'leak-check-database-url-3e8a';

    const creation = createApp(
      { ...DEV_ENV, DATABASE_URL: leakCheckValue },
      { logStream: createLogCollector().stream },
    );

    await expect(creation).rejects.toThrow('DATABASE_URL');
    await expect(creation).rejects.not.toThrow(leakCheckValue);
  });
});
