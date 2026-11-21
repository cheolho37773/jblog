import type { INestApplication } from '@nestjs/common';
import { Writable } from 'node:stream';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import {
  closeIntegrationDatabase,
  createIntegrationEnv,
  type IntegrationDatabase,
  prepareIntegrationDatabase,
} from './support/integration-db';

// 실제 DB에 붙은 헬스체크 (M0-06 규약 8, 백엔드 §6). DB 불가 503은 test/health.e2e-spec.ts.
const HEALTH_PATH = '/api/health';

function discardLogs(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

describe('GET /api/health (실제 PostgreSQL)', () => {
  let db: IntegrationDatabase;
  let app: INestApplication;

  beforeAll(async () => {
    db = await prepareIntegrationDatabase();
    app = await createApp(createIntegrationEnv(db.databaseUrl), { logStream: discardLogs() });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (db) await closeIntegrationDatabase(db);
  });

  it('DB 에 연결되면 200 이다', async () => {
    const response = await request(app.getHttpServer()).get(HEALTH_PATH);

    expect(response.status).toBe(200);
  });

  it('200 응답에도 접속 정보를 넣지 않는다', async () => {
    const response = await request(app.getHttpServer()).get(HEALTH_PATH);
    const databaseUrl = new URL(db.databaseUrl);

    expect(response.text.includes(db.databaseUrl)).toBe(false);
    expect(response.text.includes(decodeURIComponent(databaseUrl.password))).toBe(false);
    expect(response.text.includes(databaseUrl.host)).toBe(false);
  });

  it('인증 없이 호출할 수 있다', async () => {
    const response = await request(app.getHttpServer()).get(HEALTH_PATH);

    expect([401, 403]).not.toContain(response.status);
  });
});
