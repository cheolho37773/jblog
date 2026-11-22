import type { INestApplication } from '@nestjs/common';
import { Writable } from 'node:stream';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import { buildUnreachableDatabaseUrl } from './fixtures/database-url';

// 보안 헤더의 모드별 차이 (M1-09, Issue #37).
// Safari(WebKit)는 localhost에도 CSP upgrade-insecure-requests를 적용해 http://localhost의
// Swagger UI 정적 파일을 https://로 요청하다 실패한다. 개발 모드에서는 이 지시어만 빼고,
// 운영(HTTPS 전제)은 그대로 둔다. 그 밖의 CSP 지시어·helmet 헤더는 두 모드에서 같아야 한다.
const UPGRADE_DIRECTIVE = 'upgrade-insecure-requests';
const CSP_HEADER = 'content-security-policy';
const NOT_FOUND_PATH = '/api/does-not-exist';
const DOCS_PATH = '/api/docs';

// CSP 외에 helmet이 붙이는 헤더 중 모드와 무관해야 하는 것들.
const OTHER_HELMET_HEADERS = [
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'origin-agent-cluster',
  'referrer-policy',
  'strict-transport-security',
  'x-content-type-options',
  'x-dns-prefetch-control',
  'x-download-options',
  'x-frame-options',
  'x-permitted-cross-domain-policies',
  'x-xss-protection',
];

type NodeEnvironment = 'development' | 'test' | 'production';

function envFor(nodeEnv: NodeEnvironment): Record<string, unknown> {
  return { NODE_ENV: nodeEnv, API_PORT: '4000', DATABASE_URL: buildUnreachableDatabaseUrl() };
}

function discardLogs(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

async function startApp(nodeEnv: NodeEnvironment): Promise<INestApplication> {
  const app = await createApp(envFor(nodeEnv), { logStream: discardLogs() });
  await app.init();
  return app;
}

// "default-src 'self';base-uri 'self';..." → 지시어별 문자열 목록(공백 정규화, 정렬).
function cspDirectives(header: string | undefined): string[] {
  if (!header) throw new Error('Content-Security-Policy 헤더가 없다');
  return header
    .split(';')
    .map((directive) => directive.trim().replace(/\s+/g, ' '))
    .filter((directive) => directive !== '')
    .sort();
}

function directiveNames(directives: string[]): string[] {
  return directives.map((directive) => directive.split(' ')[0] ?? directive);
}

describe('보안 헤더: CSP upgrade-insecure-requests (M1-09)', () => {
  let developmentApp: INestApplication;
  let testModeApp: INestApplication;
  let productionApp: INestApplication;

  beforeAll(async () => {
    developmentApp = await startApp('development');
    testModeApp = await startApp('test');
    productionApp = await startApp('production');
  });

  afterAll(async () => {
    await developmentApp?.close();
    await testModeApp?.close();
    await productionApp?.close();
  });

  async function cspOf(app: INestApplication, path: string): Promise<string[]> {
    const response = await request(app.getHttpServer()).get(path);
    return cspDirectives(response.headers[CSP_HEADER]);
  }

  it('development 의 /api/docs 응답 CSP 에 upgrade-insecure-requests 가 없다 (Safari 흰 화면 재현)', async () => {
    expect(directiveNames(await cspOf(developmentApp, DOCS_PATH))).not.toContain(UPGRADE_DIRECTIVE);
  });

  it('development 의 404 응답 CSP 에도 upgrade-insecure-requests 가 없다', async () => {
    expect(directiveNames(await cspOf(developmentApp, NOT_FOUND_PATH))).not.toContain(
      UPGRADE_DIRECTIVE,
    );
  });

  it('production 이 아닌 test 모드도 upgrade-insecure-requests 가 없다', async () => {
    expect(directiveNames(await cspOf(testModeApp, NOT_FOUND_PATH))).not.toContain(
      UPGRADE_DIRECTIVE,
    );
  });

  it('production 응답 CSP 에는 upgrade-insecure-requests 가 있다', async () => {
    expect(directiveNames(await cspOf(productionApp, NOT_FOUND_PATH))).toContain(UPGRADE_DIRECTIVE);
  });

  it("upgrade-insecure-requests 를 뺀 나머지 CSP 지시어는 두 모드에서 같다 (default-src 'self' 포함)", async () => {
    const withoutUpgrade = (directives: string[]): string[] =>
      directives.filter((directive) => directive !== UPGRADE_DIRECTIVE);
    const development = withoutUpgrade(await cspOf(developmentApp, NOT_FOUND_PATH));
    const production = withoutUpgrade(await cspOf(productionApp, NOT_FOUND_PATH));

    expect(development).toContain("default-src 'self'");
    expect(development).toEqual(production);
  });

  it('CSP 외 helmet 헤더는 두 모드에서 같다', async () => {
    const developmentResponse = await request(developmentApp.getHttpServer()).get(NOT_FOUND_PATH);
    const productionResponse = await request(productionApp.getHttpServer()).get(NOT_FOUND_PATH);

    for (const header of OTHER_HELMET_HEADERS) {
      expect({ header, value: developmentResponse.headers[header] }).toEqual({
        header,
        value: productionResponse.headers[header],
      });
    }
    expect(developmentResponse.headers['strict-transport-security']).toBeDefined();
  });
});
