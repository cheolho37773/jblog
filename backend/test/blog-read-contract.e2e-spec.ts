import type { INestApplication } from '@nestjs/common';
import { Writable } from 'node:stream';
import request from 'supertest';
import { createApiDocument, createApp } from '../src/bootstrap';
import { buildUnreachableDatabaseUrl } from './fixtures/database-url';
import { expectErrorShape } from './fixtures/error-body';

// M2-01 공개 글·카테고리·태그·검색 + 내부 원문 API 계약 (지시서 docs/work/M2/tasks/M2-01.md).
// DB 없이 OpenAPI 문서와 "구현 전 501" 동작만 확인한다(조회 로직은 M2-03·04).
//
// 해석 약속(구현이 지킬 것):
//  - nullable 필드는 @nestjs/swagger 기본 출력대로 프로퍼티에 `nullable: true`를 둔다
//    (객체 참조는 `nullable: true` + `allOf: [{ $ref }]`). `oneOf: [..., { type: 'null' }]`는 쓰지 않는다.
//  - 표의 모든 필드는 required다. nullable은 "값이 null일 수 있다"는 뜻이지 키 생략이 아니다.

const JSON_MEDIA_TYPE = 'application/json';
const SCHEMA_PREFIX = '#/components/schemas/';
const INTERNAL_KEY_HEADER = 'X-Internal-Key';
const APP_TIMEOUT_MS = 20_000;
// 공개 API 어디에도 나오면 안 되는 키(백엔드 §4.2).
const INTERNAL_ONLY_KEYS = ['contentMd', 'version'];

const UNREACHABLE_DB_ENV = {
  NODE_ENV: 'test',
  API_PORT: '4000',
  DATABASE_URL: buildUnreachableDatabaseUrl(),
};

interface SchemaNode {
  $ref?: string;
  allOf?: SchemaNode[];
  oneOf?: SchemaNode[];
  anyOf?: SchemaNode[];
  items?: SchemaNode;
  additionalProperties?: SchemaNode | boolean;
  properties?: Record<string, SchemaNode>;
  required?: string[];
  type?: string;
  nullable?: boolean;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
}

interface ParameterNode {
  name: string;
  in: string;
  required?: boolean;
  schema?: SchemaNode;
}

interface OperationNode {
  parameters?: ParameterNode[];
  responses?: Record<string, { content?: Record<string, { schema?: SchemaNode }> }>;
}

type ApiDocument = ReturnType<typeof createApiDocument>;

function discardLogs(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

function refName(node: SchemaNode | undefined): string | undefined {
  return node?.$ref?.startsWith(SCHEMA_PREFIX) ? node.$ref.slice(SCHEMA_PREFIX.length) : undefined;
}

function component(document: ApiDocument, name: string): SchemaNode {
  const schema = document.components?.schemas?.[name];
  if (!schema) throw new Error(`components.schemas 에 ${name} 이(가) 없다`);
  return schema as SchemaNode;
}

// allOf를 따라가 필드 이름 -> (필드 노드), required 를 합친다. 필드 노드는 $ref 를 풀지 않는다.
function flatten(
  document: ApiDocument,
  node: SchemaNode,
): { fields: Record<string, SchemaNode>; required: Set<string> } {
  if (node.$ref) return flatten(document, component(document, refName(node) as string));
  const fields: Record<string, SchemaNode> = {};
  const required = new Set<string>();
  for (const member of node.allOf ?? []) {
    const part = flatten(document, member);
    Object.assign(fields, part.fields);
    part.required.forEach((key) => required.add(key));
  }
  Object.assign(fields, node.properties ?? {});
  (node.required ?? []).forEach((key) => required.add(key));
  return { fields, required };
}

function schemaOf(document: ApiDocument, name: string) {
  return flatten(document, component(document, name));
}

// 필드가 없으면 undefined 로 흘려보내지 않고 이유가 보이는 메시지로 실패시킨다.
function fieldOf(fields: Record<string, SchemaNode>, name: string): SchemaNode {
  const field = fields[name];
  if (!field) throw new Error(`스키마에 필드 ${name} 가 없다`);
  return field;
}

// 필드가 가리키는 DTO 이름. `$ref`, nullable 객체(`allOf: [{$ref}]`), 배열(`items.$ref`)을 모두 푼다.
function targetName(field: SchemaNode): string | undefined {
  return refName(field) ?? refName(field.allOf?.[0]) ?? refName(field.items);
}

function isNullable(field: SchemaNode): boolean {
  return field.nullable === true;
}

function operation(document: ApiDocument, path: string): OperationNode {
  const op = document.paths[path]?.get as OperationNode | undefined;
  if (!op) throw new Error(`OpenAPI 문서에 GET ${path} 가 없다`);
  return op;
}

function responseSchema(document: ApiDocument, path: string, status: string): SchemaNode {
  const response = operation(document, path).responses?.[status];
  const schema = response?.content?.[JSON_MEDIA_TYPE]?.schema;
  if (!schema) throw new Error(`GET ${path} ${status} 의 ${JSON_MEDIA_TYPE} 스키마가 없다`);
  return schema;
}

function parameter(document: ApiDocument, path: string, name: string): ParameterNode {
  const found = operation(document, path).parameters?.find((param) => param.name === name);
  if (!found) throw new Error(`GET ${path} 에 파라미터 ${name} 이(가) 없다`);
  return found;
}

function childSchemas(node: SchemaNode): SchemaNode[] {
  const extra = typeof node.additionalProperties === 'object' ? [node.additionalProperties] : [];
  const items = node.items ? [node.items] : [];
  const nested = Object.values(node.properties ?? {});
  return [
    ...(node.allOf ?? []),
    ...(node.oneOf ?? []),
    ...(node.anyOf ?? []),
    ...items,
    ...extra,
    ...nested,
  ];
}

// 스키마가 도달하는 모든 프로퍼티 키. $ref·allOf·oneOf·anyOf·items·중첩 properties를 재귀로 따른다.
function collectReachableKeys(
  document: ApiDocument,
  node: SchemaNode,
  seen = new Set<string>(),
): Set<string> {
  const name = refName(node);
  if (name) {
    if (seen.has(name)) return new Set();
    seen.add(name);
    return collectReachableKeys(document, component(document, name), seen);
  }
  const keys = new Set(Object.keys(node.properties ?? {}));
  for (const child of childSchemas(node)) {
    collectReachableKeys(document, child, seen).forEach((key) => keys.add(key));
  }
  return keys;
}

const PUBLIC_PATHS = [
  '/api/posts',
  '/api/posts/{slug}',
  '/api/categories',
  '/api/tags',
  '/api/search',
];
const INTERNAL_PATH = '/internal/posts/{slug}';

// 표: DTO -> 필드(nullable 여부, 가리키는 DTO). 모든 필드는 required.
interface FieldSpec {
  nullable?: boolean;
  ref?: string;
}
const DTO_FIELDS: Record<string, Record<string, FieldSpec>> = {
  CategoryRefDto: { name: {}, slug: {} },
  TagRefDto: { name: {}, slug: {} },
  PostSummaryDto: {
    slug: {},
    title: {},
    excerpt: {},
    coverImageUrl: { nullable: true },
    category: { nullable: true, ref: 'CategoryRefDto' },
    publishedAt: {},
    readingMinutes: {},
    viewCount: {},
    likeCount: {},
  },
  PostListResponseDto: {
    items: { ref: 'PostSummaryDto' },
    page: {},
    size: {},
    totalItems: {},
    totalPages: {},
  },
  PostLinkDto: { slug: {}, title: {} },
  PostDetailDto: {
    slug: {},
    title: {},
    excerpt: {},
    coverImageUrl: { nullable: true },
    category: { nullable: true, ref: 'CategoryRefDto' },
    publishedAt: {},
    readingMinutes: {},
    viewCount: {},
    likeCount: {},
    tags: { ref: 'TagRefDto' },
    isFeatured: {},
    seoTitle: { nullable: true },
    seoDescription: { nullable: true },
    updatedAt: {},
  },
  PostDetailResponseDto: {
    post: { ref: 'PostDetailDto' },
    prev: { nullable: true, ref: 'PostLinkDto' },
    next: { nullable: true, ref: 'PostLinkDto' },
    related: { ref: 'PostSummaryDto' },
  },
  InternalPostResponseDto: {
    post: { ref: 'InternalPostDto' },
    prev: { nullable: true, ref: 'PostLinkDto' },
    next: { nullable: true, ref: 'PostLinkDto' },
    related: { ref: 'PostSummaryDto' },
  },
  InternalPostRedirectDto: { redirectTo: {} },
  CategoryWithCountDto: { name: {}, slug: {}, postCount: {} },
  TagWithCountDto: { name: {}, slug: {}, postCount: {} },
};

describe('M2-01 계약: 공개 글·카테고리·태그·검색 + 내부 원문 API', () => {
  let app: INestApplication;
  let document: ApiDocument;

  beforeAll(async () => {
    app = await createApp(UNREACHABLE_DB_ENV, { logStream: discardLogs() });
    await app.init();
    document = createApiDocument(app);
  }, APP_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
  });

  describe('경로와 파라미터', () => {
    it.each(PUBLIC_PATHS)('공개 경로 GET %s 가 OpenAPI 문서에 있다', (path) => {
      expect(operation(document, path)).toBeDefined();
    });

    it('내부 경로는 전역 prefix 없이 GET /internal/posts/{slug} 이고 /api/internal 경로는 문서에 없다', () => {
      expect(operation(document, INTERNAL_PATH)).toBeDefined();
      expect(
        Object.keys(document.paths).filter((path) => path.startsWith('/api/internal')),
      ).toEqual([]);
    });

    it('GET /api/posts 쿼리: page(기본 1, 최소 1), size(기본 9, 1~50), category, tag, featured(boolean) 모두 선택', () => {
      const path = '/api/posts';
      const page = parameter(document, path, 'page');
      const size = parameter(document, path, 'size');
      expect(page.in).toBe('query');
      expect(page.required).toBeFalsy();
      expect(page.schema?.default).toBe(1);
      expect(page.schema?.minimum).toBe(1);
      expect(size.in).toBe('query');
      expect(size.required).toBeFalsy();
      expect(size.schema?.default).toBe(9);
      expect(size.schema?.minimum).toBe(1);
      expect(size.schema?.maximum).toBe(50);
      for (const name of ['category', 'tag']) {
        const param = parameter(document, path, name);
        expect(param.in).toBe('query');
        expect(param.required).toBeFalsy();
        expect(param.schema?.type).toBe('string');
      }
      const featured = parameter(document, path, 'featured');
      expect(featured.in).toBe('query');
      expect(featured.required).toBeFalsy();
      expect(featured.schema?.type).toBe('boolean');
    });

    it.each(['/api/posts', '/api/search'])(
      'GET %s 의 page·size 쿼리는 정수(integer)로 선언된다',
      (path) => {
        expect(parameter(document, path, 'page').schema?.type).toBe('integer');
        expect(parameter(document, path, 'size').schema?.type).toBe('integer');
      },
    );

    it('GET /api/posts/{slug} 는 path 파라미터 slug 가 필수다', () => {
      const slug = parameter(document, '/api/posts/{slug}', 'slug');
      expect(slug.in).toBe('path');
      expect(slug.required).toBe(true);
      expect(slug.schema?.type).toBe('string');
    });

    it('GET /api/search 쿼리: q 는 필수 문자열(2자 이상), page·size 는 선택', () => {
      const path = '/api/search';
      const q = parameter(document, path, 'q');
      expect(q.in).toBe('query');
      expect(q.required).toBe(true);
      expect(q.schema?.type).toBe('string');
      expect(q.schema?.minLength).toBe(2);
      for (const name of ['page', 'size']) {
        const param = parameter(document, path, name);
        expect(param.in).toBe('query');
        expect(param.required).toBeFalsy();
      }
    });

    it('GET /internal/posts/{slug} 는 X-Internal-Key 헤더 파라미터가 필수이고 slug 는 path 파라미터다', () => {
      const key = parameter(document, INTERNAL_PATH, INTERNAL_KEY_HEADER);
      expect(key.in).toBe('header');
      expect(key.required).toBe(true);
      expect(parameter(document, INTERNAL_PATH, 'slug').in).toBe('path');
      expect(parameter(document, INTERNAL_PATH, 'slug').schema?.type).toBe('string');
    });
  });

  describe('응답 코드와 스키마', () => {
    const STATUS_TABLE: Array<[string, string[], string[]]> = [
      ['/api/posts', ['200', '400'], []],
      ['/api/posts/{slug}', ['200', '301', '404'], []],
      ['/api/categories', ['200'], ['400', '404']],
      ['/api/tags', ['200'], ['400', '404']],
      ['/api/search', ['200', '400'], []],
      [INTERNAL_PATH, ['200', '401', '404'], []],
    ];

    it.each(STATUS_TABLE)('%s 응답 코드: 필수 %j', (path, expected, absent) => {
      const codes = Object.keys(operation(document, path).responses ?? {});
      expect(codes).toEqual(expect.arrayContaining(expected));
      absent.forEach((code) => expect(codes).not.toContain(code));
    });

    it.each([
      ['/api/posts', 'PostListResponseDto'],
      ['/api/posts/{slug}', 'PostDetailResponseDto'],
      ['/api/search', 'PostListResponseDto'],
    ])('GET %s 200 은 %s 이다', (path, dto) => {
      expect(refName(responseSchema(document, path, '200'))).toBe(dto);
    });

    it.each([
      ['/api/categories', 'CategoryWithCountDto'],
      ['/api/tags', 'TagWithCountDto'],
    ])('GET %s 200 은 %s 배열이다', (path, dto) => {
      const schema = responseSchema(document, path, '200');
      expect(schema.type).toBe('array');
      expect(refName(schema.items)).toBe(dto);
    });

    it.each([
      ['/api/posts', '400'],
      ['/api/search', '400'],
      ['/api/posts/{slug}', '404'],
      [INTERNAL_PATH, '401'],
      [INTERNAL_PATH, '404'],
    ])('GET %s %s 본문은 공통 에러 형식(ErrorResponseDto)이다', (path, status) => {
      expect(refName(responseSchema(document, path, status))).toBe('ErrorResponseDto');
    });

    it('내부 200 응답은 InternalPostResponseDto 또는 InternalPostRedirectDto 의 oneOf 이다', () => {
      const schema = responseSchema(document, INTERNAL_PATH, '200');
      expect((schema.oneOf ?? []).map(refName).sort()).toEqual([
        'InternalPostRedirectDto',
        'InternalPostResponseDto',
      ]);
    });
  });

  describe('DTO 필드·required·nullable', () => {
    it.each(Object.entries(DTO_FIELDS))(
      '%s 의 필드는 표와 같고 모두 required 이다',
      (name, spec) => {
        const { fields, required } = schemaOf(document, name);
        expect(Object.keys(fields).sort()).toEqual(Object.keys(spec).sort());
        expect([...required].sort()).toEqual(Object.keys(spec).sort());
        for (const [field, expected] of Object.entries(spec)) {
          expect({ field, nullable: isNullable(fieldOf(fields, field)) }).toEqual({
            field,
            nullable: expected.nullable === true,
          });
          if (expected.ref)
            expect({ field, ref: targetName(fieldOf(fields, field)) }).toEqual({
              field,
              ref: expected.ref,
            });
        }
      },
    );

    it('InternalPostDto 는 PostDetailDto 의 모든 필드에 contentMd·version 이 더해진다 (모두 required, non-null)', () => {
      const detail = schemaOf(document, 'PostDetailDto');
      const internal = schemaOf(document, 'InternalPostDto');
      const expected = [...Object.keys(detail.fields), ...INTERNAL_ONLY_KEYS].sort();
      expect(Object.keys(internal.fields).sort()).toEqual(expected);
      expect([...internal.required].sort()).toEqual(expected);
      INTERNAL_ONLY_KEYS.forEach((key) =>
        expect(isNullable(fieldOf(internal.fields, key))).toBe(false),
      );
    });

    it('PostDetailDto 는 PostSummaryDto 의 필드를 모두 포함한다', () => {
      const summary = Object.keys(schemaOf(document, 'PostSummaryDto').fields);
      const detail = Object.keys(schemaOf(document, 'PostDetailDto').fields);
      expect(detail).toEqual(expect.arrayContaining(summary));
    });

    it('contentMd·version 은 InternalPostDto 에만 있다 (다른 DTO 에는 없다)', () => {
      for (const name of Object.keys(DTO_FIELDS)) {
        const keys = Object.keys(schemaOf(document, name).fields);
        INTERNAL_ONLY_KEYS.forEach((key) =>
          expect({ name, has: keys.includes(key) }).toEqual({ name, has: false }),
        );
      }
    });
  });

  describe('거부: 공개 응답 스키마에 원문·버전이 새지 않는다 (백엔드 §4.2)', () => {
    it.each(PUBLIC_PATHS)(
      'GET %s 의 모든 응답 스키마가 도달하는 키에 contentMd·version 이 없다',
      (path) => {
        const responses = operation(document, path).responses ?? {};
        expect(Object.keys(responses).length).toBeGreaterThan(0);
        const reachable = new Set<string>();
        for (const response of Object.values(responses)) {
          const schema = response.content?.[JSON_MEDIA_TYPE]?.schema;
          if (schema) collectReachableKeys(document, schema).forEach((key) => reachable.add(key));
        }
        INTERNAL_ONLY_KEYS.forEach((key) =>
          expect({ path, key, leaked: reachable.has(key) }).toEqual({ path, key, leaked: false }),
        );
      },
    );

    it('검사기 자체 확인: 내부 200 응답에서는 contentMd·version 에 도달한다', () => {
      const reachable = collectReachableKeys(
        document,
        responseSchema(document, INTERNAL_PATH, '200'),
      );
      INTERNAL_ONLY_KEYS.forEach((key) => expect(reachable.has(key)).toBe(true));
    });
  });

  describe('구현 전 핸들러는 공통 에러 형식의 501이다 (빈 200 금지)', () => {
    it.each([
      '/api/posts',
      '/api/posts/some-slug',
      '/api/categories',
      '/api/tags',
      '/api/search?q=ab',
      '/internal/posts/some-slug',
    ])('GET %s 는 501 NOT_IMPLEMENTED', async (url) => {
      const response = await request(app.getHttpServer()).get(url);
      expect(response.status).toBe(501);
      expectErrorShape(response.body, {
        statusCode: 501,
        code: 'NOT_IMPLEMENTED',
        path: url.split('?')[0] ?? url,
      });
    });

    it('/api/internal/posts/x 는 라우트가 없어 404 이다 (내부 경로는 전역 prefix 제외)', async () => {
      const response = await request(app.getHttpServer()).get('/api/internal/posts/x');
      expect(response.status).toBe(404);
    });
  });
});
