import type { INestApplication } from '@nestjs/common';
import { Writable } from 'node:stream';
import request from 'supertest';
import { createApiDocument, createApp } from '../src/bootstrap';
import { buildUnreachableDatabaseUrl } from './fixtures/database-url';
import { ERROR_BODY_KEYS } from './fixtures/error-body';

// OpenAPI 계약과 실제 실패 응답의 일치 (M0-07 Codex r1 #1, 백엔드 §4.1).
// 문서가 Terminus 형식(status/details)을 선언하고 실제 본문은 공통 에러 형식이면
// 프론트엔드 생성 타입의 error가 실제와 달라진다. DB 없이 닫힌 포트로 503을 재현한다.
const HEALTH_PATH = '/api/health';
const SERVICE_UNAVAILABLE_STATUS = '503';
const JSON_MEDIA_TYPE = 'application/json';
// 닫힌 포트라 연결 거부가 바로 오지만, 드라이버 재시도가 있어도 여유를 둔다.
const HEALTH_TIMEOUT_MS = 20_000;

const UNREACHABLE_DB_ENV = {
  NODE_ENV: 'test',
  API_PORT: '4000',
  DATABASE_URL: buildUnreachableDatabaseUrl(),
};

// OpenAPI 스키마 중 이 테스트가 읽는 부분만. 참조($ref)와 합성(allOf)을 풀어 한 객체로 본다.
interface SchemaNode {
  $ref?: string;
  allOf?: SchemaNode[];
  properties?: Record<string, unknown>;
  required?: string[];
}

interface ResolvedSchema {
  properties: string[];
  required: string[];
}

type ApiDocument = ReturnType<typeof createApiDocument>;

const COMPONENT_SCHEMA_PREFIX = '#/components/schemas/';

function lookupReference(document: ApiDocument, reference: string): SchemaNode {
  if (!reference.startsWith(COMPONENT_SCHEMA_PREFIX)) {
    throw new Error(`지원하지 않는 참조 형식: ${reference}`);
  }
  const name = reference.slice(COMPONENT_SCHEMA_PREFIX.length);
  const schema = document.components?.schemas?.[name];
  if (!schema) throw new Error(`components.schemas 에 없는 참조: ${name}`);
  return schema as SchemaNode;
}

// allOf 구성원과 자기 자신의 properties·required를 합친다(OpenAPI allOf 의미).
function resolveSchema(document: ApiDocument, node: SchemaNode): ResolvedSchema {
  if (node.$ref) return resolveSchema(document, lookupReference(document, node.$ref));

  const parts = (node.allOf ?? []).map((member) => resolveSchema(document, member));
  const properties = new Set(parts.flatMap((part) => part.properties));
  const required = new Set(parts.flatMap((part) => part.required));
  Object.keys(node.properties ?? {}).forEach((key) => properties.add(key));
  (node.required ?? []).forEach((key) => required.add(key));
  return { properties: [...properties].sort(), required: [...required].sort() };
}

function healthFailureSchema(document: ApiDocument): ResolvedSchema {
  const response = document.paths[HEALTH_PATH]?.get?.responses?.[SERVICE_UNAVAILABLE_STATUS] as
    { content?: Record<string, { schema?: SchemaNode }> } | undefined;
  const schema = response?.content?.[JSON_MEDIA_TYPE]?.schema;
  if (!schema) throw new Error(`${HEALTH_PATH} GET 503 의 ${JSON_MEDIA_TYPE} 스키마가 문서에 없다`);
  return resolveSchema(document, schema);
}

function discardLogs(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

describe('OpenAPI 계약: GET /api/health 503 응답 (Codex r1 #1)', () => {
  let app: INestApplication;
  let document: ApiDocument;

  beforeAll(async () => {
    app = await createApp(UNREACHABLE_DB_ENV, { logStream: discardLogs() });
    await app.init();
    document = createApiDocument(app);
  }, HEALTH_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
  });

  it('503 스키마는 공통 에러 형식 5개 키(statusCode, code, message, path, timestamp)를 모두 required 로 갖는다', () => {
    expect(healthFailureSchema(document).required).toEqual([...ERROR_BODY_KEYS].sort());
  });

  it('503 스키마의 properties 는 공통 에러 형식 5개 키뿐이다 (Terminus 의 status/details 없음)', () => {
    expect(healthFailureSchema(document).properties).toEqual([...ERROR_BODY_KEYS].sort());
  });

  it(
    '실제 503 본문의 키 집합이 문서의 503 스키마 properties 와 같다',
    async () => {
      const response = await request(app.getHttpServer()).get(HEALTH_PATH);

      expect(response.status).toBe(Number(SERVICE_UNAVAILABLE_STATUS));
      expect(Object.keys(response.body).sort()).toEqual(healthFailureSchema(document).properties);
    },
    HEALTH_TIMEOUT_MS,
  );
});
