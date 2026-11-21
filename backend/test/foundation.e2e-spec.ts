import type { INestApplication } from '@nestjs/common';
import { Writable } from 'node:stream';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import {
  PROBE_APP_ERROR,
  PROBE_INTERNAL_ERROR_MESSAGE,
  PROBE_SET_COOKIE_VALUE,
  ProbeModule,
} from './fixtures/probe.module';

const DEV_ENV = { NODE_ENV: 'development', API_PORT: '4000' };
const PRODUCTION_ENV = { NODE_ENV: 'production', API_PORT: '4000' };
const ERROR_BODY_KEYS = ['code', 'message', 'path', 'statusCode', 'timestamp'];
const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const GENERIC_500_MESSAGE_MAX_LENGTH = 100;

const REQUEST_ID_HEADER = 'x-request-id';
const SENT_REQUEST_ID = 'req-id-from-client-123';
const AUTHORIZATION_VALUE = 'Bearer dummy-authorization-token-a1';
const COOKIE_VALUE = 'jb_session=dummy-cookie-value-b2';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  path: string;
  timestamp: string;
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

async function waitForLogFlush(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

function expectErrorShape(
  body: ErrorBody,
  expected: { statusCode: number; code: string; path: string },
): void {
  expect(Object.keys(body).sort()).toEqual(ERROR_BODY_KEYS);
  expect(body.statusCode).toBe(expected.statusCode);
  expect(body.code).toBe(expected.code);
  expect(body.path).toBe(expected.path);
  expect(typeof body.message).toBe('string');
  expect(body.timestamp).toMatch(ISO_8601_UTC);
  expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
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
    ['NODE_ENV 누락', { API_PORT: '4000' }, 'NODE_ENV'],
    ['API_PORT 누락', { NODE_ENV: 'development' }, 'API_PORT'],
    ['API_PORT=abc', { NODE_ENV: 'development', API_PORT: 'abc' }, 'API_PORT'],
    ['NODE_ENV=staging', { NODE_ENV: 'staging', API_PORT: '4000' }, 'NODE_ENV'],
  ])(
    '%s 이면 앱 생성이 reject 되고 메시지에 변수 이름이 있다',
    async (_caseName, env, variableName) => {
      await expect(createApp(env, { logStream: createLogCollector().stream })).rejects.toThrow(
        variableName,
      );
    },
  );
});
