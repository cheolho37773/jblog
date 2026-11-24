import type { INestApplication } from '@nestjs/common';
import { Writable } from 'node:stream';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import {
  closeIntegrationDatabase,
  createIntegrationEnv,
  type IntegrationDatabase,
  prepareIntegrationDatabase,
  resetDatabase,
  runSeed,
} from './support/integration-db';

// 시드 커버 이미지 정적 서빙 (M2-03 규약 8). 개발 모드에서만 /uploads/seed/* 를 서빙하고 운영(Nginx 담당)에는 라우트가 없다.
// 파일 이름은 구현이 정하므로 시드 글의 coverImageUrl 에서 읽는다.

const SEED_UPLOAD_PREFIX = '/uploads/seed/';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function discardLogs(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

describe('시드 커버 이미지 서빙 (실제 PostgreSQL)', () => {
  let db: IntegrationDatabase;
  let developmentApp: INestApplication;
  let productionApp: INestApplication;
  let coverPath: string;

  beforeAll(async () => {
    db = await prepareIntegrationDatabase();
    await resetDatabase(db.prisma);
    await runSeed(db.databaseUrl);
    const cover = await db.prisma.post.findFirst({
      where: { coverImageUrl: { startsWith: SEED_UPLOAD_PREFIX } },
      select: { coverImageUrl: true },
    });
    coverPath = cover?.coverImageUrl ?? `${SEED_UPLOAD_PREFIX}missing-cover.png`;

    const env = createIntegrationEnv(db.databaseUrl);
    developmentApp = await createApp(
      { ...env, NODE_ENV: 'development' },
      { logStream: discardLogs() },
    );
    await developmentApp.init();
    productionApp = await createApp(
      { ...env, NODE_ENV: 'production' },
      { logStream: discardLogs() },
    );
    await productionApp.init();
  });

  afterAll(async () => {
    await developmentApp?.close();
    await productionApp?.close();
    if (db) await closeIntegrationDatabase(db);
  });

  it('시드 글 중 /uploads/seed/ 커버 이미지를 가진 글이 있다', () => {
    expect(coverPath.startsWith(SEED_UPLOAD_PREFIX)).toBe(true);
    expect(coverPath).not.toContain('missing-cover');
  });

  it('개발 모드에서 시드 커버 이미지는 200 image/png 이고 PNG 파일이다', async () => {
    const response = await request(developmentApp.getHttpServer()).get(coverPath);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^image\/png/);
    const body = response.body as Buffer;
    expect(body.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)).toBe(true);
  });

  it('개발 모드에서도 없는 파일은 404 다', async () => {
    const response = await request(developmentApp.getHttpServer()).get(
      `${SEED_UPLOAD_PREFIX}no-such-file.png`,
    );

    expect(response.status).toBe(404);
  });

  it('개발 모드에서 seed 폴더 밖 경로로 빠져나갈 수 없다', async () => {
    const response = await request(developmentApp.getHttpServer()).get(
      `${SEED_UPLOAD_PREFIX}..%2F..%2Fpackage.json`,
    );

    expect(response.status).toBe(404);
  });

  it('production 모드에서는 시드 커버 이미지 경로가 404 다 (운영은 Nginx 담당)', async () => {
    const response = await request(productionApp.getHttpServer()).get(coverPath);

    expect(response.status).toBe(404);
  });

  it('production 모드에서 /uploads/seed/x.png 는 404 다', async () => {
    const response = await request(productionApp.getHttpServer()).get('/uploads/seed/x.png');

    expect(response.status).toBe(404);
  });
});
