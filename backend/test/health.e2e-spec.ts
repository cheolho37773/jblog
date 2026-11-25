import type { INestApplication } from '@nestjs/common';
import { Writable } from 'node:stream';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import { buildUnreachableDatabaseUrl, UNREACHABLE_DATABASE } from './fixtures/database-url';
import { TEST_INTERNAL_KEY } from './fixtures/internal-key';
import { expectErrorShape } from './fixtures/error-body';

// DB가 없는 상태의 헬스체크 (M0-06 규약 7·8). 실제 DB가 붙은 200 확인은 test/health.int-spec.ts.
const HEALTH_PATH = '/api/health';
// 닫힌 포트라 연결 거부가 바로 오지만, 드라이버 재시도가 있어도 여유를 둔다.
const HEALTH_TIMEOUT_MS = 20_000;

const UNREACHABLE_DB_ENV = {
  NODE_ENV: 'test',
  API_PORT: '4000',
  DATABASE_URL: buildUnreachableDatabaseUrl(),
  INTERNAL_API_KEY: TEST_INTERNAL_KEY,
};

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

describe('GET /api/health (DB에 연결할 수 없을 때)', () => {
  let app: INestApplication;
  let logs: ReturnType<typeof createLogCollector>;

  beforeAll(async () => {
    logs = createLogCollector();
    // 부팅 시 DB 연결을 강제하지 않으므로 DB가 없어도 앱이 떠야 한다 (규약 7).
    app = await createApp(UNREACHABLE_DB_ENV, { logStream: logs.stream });
    await app.init();
  }, HEALTH_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
  });

  it(
    'DB 연결 불가면 503 SERVICE_UNAVAILABLE 에러 형식으로 응답한다',
    async () => {
      const response = await request(app.getHttpServer()).get(HEALTH_PATH);

      expect(response.status).toBe(503);
      expectErrorShape(response.body, {
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
        path: HEALTH_PATH,
      });
    },
    HEALTH_TIMEOUT_MS,
  );

  it(
    '503 응답에 접속 정보(호스트·포트·사용자·비밀번호·DB 이름)를 넣지 않는다',
    async () => {
      const response = await request(app.getHttpServer()).get(HEALTH_PATH);
      const { host, port, user, password, database } = UNREACHABLE_DATABASE;

      expect(response.status).toBe(503);
      for (const secretPart of [host, `${host}:${port}`, user, password, database]) {
        expect(response.text.includes(secretPart)).toBe(false);
      }
      expect(JSON.stringify(response.headers).includes(password)).toBe(false);
    },
    HEALTH_TIMEOUT_MS,
  );

  it(
    '헬스체크 실패를 기록해도 로그에 DB 비밀번호를 남기지 않는다',
    async () => {
      await request(app.getHttpServer()).get(HEALTH_PATH);
      await new Promise((resolve) => setImmediate(resolve));

      expect(logs.output().includes(UNREACHABLE_DATABASE.password)).toBe(false);
    },
    HEALTH_TIMEOUT_MS,
  );
});
