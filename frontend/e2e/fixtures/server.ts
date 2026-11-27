// 픽스처 API 서버 (M2-E 동작 규약 1). 백엔드(Nest) 없이 E2E·시각 회귀가 데이터를 받을 수 있게 고정 응답을 돌려준다.
// - Node 내장 http만 쓴다. 새 의존성 없음.
// - 응답 데이터는 생성 타입(M2-01 계약)으로 satisfies 검사한다. 계약이 바뀌면 typecheck가 먼저 깨진다.
// - 이 파일은 다른 로컬 파일을 import하지 않는다. `node server.ts`로 직접 실행하려면 `.ts` 확장자 import가 필요한데
//   tsconfig가 허용하지 않기 때문이다(데이터도 이 파일 안에 둔다).
// - Playwright가 CommonJS로 불러오므로 import.meta를 쓰지 않는다. 모든 실행(node·Playwright·Vitest)은 frontend/에서 한다.
// 실행: node --no-warnings e2e/fixtures/server.ts   (frontend/에서)
//   FIXTURE_API_PORT      기본 4100
//   FIXTURE_INTERNAL_KEY  기본 e2e-internal-key-not-secret (비밀이 아닌 테스트 값)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { components } from '../../src/generated/api-types';

type Schemas = components['schemas'];
type PostSummary = Schemas['PostSummaryDto'];
type PostDetail = Schemas['PostDetailDto'];
type InternalPost = Schemas['InternalPostDto'];
type PostLink = Schemas['PostLinkDto'];
type CategoryWithCount = Schemas['CategoryWithCountDto'];
type TagWithCount = Schemas['TagWithCountDto'];
type PostList = Schemas['PostListResponseDto'];
type ErrorBody = Schemas['ErrorResponseDto'];

// ───────────────────────── 설정 ─────────────────────────

export const DEFAULT_FIXTURE_API_PORT = 4100;
export const DEFAULT_FIXTURE_INTERNAL_KEY = 'e2e-internal-key-not-secret';

const ASSETS_DIR = path.resolve('e2e/fixtures/assets');
const UPLOADS_PREFIX = '/uploads/fixtures/';
const INTERNAL_KEY_HEADER = 'x-internal-key';

const DEFAULT_PAGE_SIZE = 9;
const MAX_PAGE_SIZE = 50;
const MIN_SEARCH_LENGTH = 2;
const MAX_RELATED_POSTS = 3;

// 백엔드 §5.7-①
export const CACHE_CONTROL = {
  public: 'public, max-age=60, stale-while-revalidate=300',
  search: 'public, max-age=30',
  internal: 'private, no-store',
  upload: 'public, max-age=31536000, immutable',
} as const;

// ───────────────────────── 데이터 ─────────────────────────

const category = (name: string, slug: string) => ({ name, slug });

export const EMPTY_CATEGORY_SLUG = 'empty-category';
const tag = (name: string, slug: string) => ({ name, slug });

export const CATEGORIES = {
  backend: category('백엔드', 'backend'),
  frontend: category('프론트엔드', 'frontend'),
  devops: category('DevOps', 'devops'),
  // 글이 0개인 카테고리(M2-07). 목록 칩·Footer에서 빠지고, 주소로 들어가면 빈 상태가 되는지 본다.
  // Footer "postCount 0 제외"가 단순 slice(0, 6)과 구분되도록 순서 가운데에 둔다.
  empty: category('빈 카테고리', EMPTY_CATEGORY_SLUG),
  database: category('데이터베이스', 'database'),
  architecture: category('아키텍처', 'architecture'),
  career: category('커리어', 'career'),
} satisfies Record<string, Schemas['CategoryRefDto']>;

export const TAGS = {
  nestjs: tag('NestJS', 'nestjs'),
  nextjs: tag('Next.js', 'nextjs'),
  postgresql: tag('PostgreSQL', 'postgresql'),
  docker: tag('Docker', 'docker'),
  cache: tag('캐시', 'cache'),
  testing: tag('테스트', 'testing'),
  security: tag('보안', 'security'),
} satisfies Record<string, Schemas['TagRefDto']>;

// 서버 조회 실패·지연을 재현하는 시험용 태그(M2-07). 태그 목록에는 보이지만 글 조회가 각각 500·지연으로 답한다.
// Next 서버의 fetch 캐시(revalidate 3600)가 같은 주소의 응답을 재사용하므로, 지연 태그는 재시도(retry)마다 다른 것을 쓴다.
export const ERROR_TAG = tag('서버 오류 재현', 'fixture-error');
export const SLOW_TAGS = [
  tag('느린 조회 0', 'fixture-slow-0'),
  tag('느린 조회 1', 'fixture-slow-1'),
];
export const SLOW_TAG_DELAY_MS = 3000;
const HOOK_TAGS = [ERROR_TAG, ...SLOW_TAGS];
const isSlowTag = (slug: string | null) => SLOW_TAGS.some((hook) => hook.slug === slug);

/** 목록 응답의 정렬 순서(sortOrder)와 같다. */
const CATEGORY_ORDER = Object.values(CATEGORIES);
const TAG_ORDER = Object.values(TAGS);

/** 이전 slug 하나. 현재 slug로 301 / `{ redirectTo }`가 나간다. */
export const OLD_SLUG = 'old-internal-api-guard';
export const OLD_SLUG_TARGET = 'nestjs-internal-api-guard';
export const FEATURED_SLUG = 'designing-cache-strategy';
export const MISSING_SLUG = 'no-such-post';

export const COVER_FILES = [
  'cover-indigo.png',
  'cover-emerald.png',
  'cover-amber.png',
  'cover-rose.png',
  'cover-slate.png',
  'cover-solid.png',
] as const;

const coverUrlAt = (index: number) => `${UPLOADS_PREFIX}${COVER_FILES[index % COVER_FILES.length]}`;

// 본문은 파이프라인이 처리할 요소(h2·h3, 코드 블록, 콜아웃, 이미지 캡션)를 모두 담는다.
// 콜아웃·캡션의 정확한 문법은 M2 본문 렌더 작업에서 확정되므로 여기서는 일반적인 Markdown 형태를 쓴다.
const contentMdOf = (title: string, imageUrl: string) => `## ${title}을 시작하며

이 글은 픽스처 데이터입니다. 실제 글이 아니며 화면 검증에만 쓰입니다.

### 먼저 알아둘 점

> [!NOTE]
> 콜아웃 예시입니다. 중요한 내용을 눈에 띄게 보여 줍니다.

\`\`\`ts title="example.ts"
export function greet(name: string): string {
  return \`Hello, \${name}\`;
}
\`\`\`

![픽스처 이미지](${imageUrl} "그림 1. 직접 만든 그라디언트 이미지")

## 정리

- 첫째 항목
- 둘째 항목

본문 끝입니다.
`;

interface PostRow {
  slug: string;
  title: string;
  category: Schemas['CategoryRefDto'] | null;
  tags: Schemas['TagRefDto'][];
  publishedAt: string;
  isFeatured?: boolean;
}

// 최신 글이 앞에 온다(publishedAt 내림차순). 13개, featured 1개, 분류 없는 글 1개.
const POST_ROWS: PostRow[] = [
  {
    slug: 'nextjs-request-time-rendering',
    title: 'Next.js 요청 시 렌더링 정리',
    category: CATEGORIES.frontend,
    tags: [TAGS.nextjs, TAGS.cache],
    publishedAt: '2026-11-20T09:00:00.000Z',
  },
  {
    slug: 'prisma-transaction-isolation',
    title: 'Prisma 트랜잭션과 격리 수준',
    category: CATEGORIES.database,
    tags: [TAGS.postgresql, TAGS.nestjs],
    publishedAt: '2026-11-15T09:00:00.000Z',
  },
  {
    slug: FEATURED_SLUG,
    title: '캐시 전략 설계하기',
    category: CATEGORIES.architecture,
    tags: [TAGS.cache, TAGS.nextjs, TAGS.nestjs],
    publishedAt: '2026-11-10T09:00:00.000Z',
    isFeatured: true,
  },
  {
    slug: 'docker-multistage-build',
    title: 'Docker 멀티 스테이지 빌드',
    category: CATEGORIES.devops,
    tags: [TAGS.docker],
    publishedAt: '2026-11-05T09:00:00.000Z',
  },
  {
    slug: OLD_SLUG_TARGET,
    title: 'NestJS 내부 API 가드 만들기',
    category: CATEGORIES.backend,
    tags: [TAGS.nestjs, TAGS.security],
    publishedAt: '2026-10-28T09:00:00.000Z',
  },
  {
    slug: 'testcontainers-integration-tests',
    title: 'Testcontainers로 통합 테스트하기',
    category: CATEGORIES.backend,
    tags: [TAGS.testing, TAGS.postgresql, TAGS.docker],
    publishedAt: '2026-10-20T09:00:00.000Z',
  },
  {
    slug: 'tailwind-design-tokens',
    title: 'Tailwind로 디자인 토큰 다루기',
    category: CATEGORIES.frontend,
    tags: [TAGS.nextjs],
    publishedAt: '2026-10-12T09:00:00.000Z',
  },
  {
    slug: 'postgresql-index-basics',
    title: 'PostgreSQL 인덱스 기초',
    category: CATEGORIES.database,
    tags: [TAGS.postgresql],
    publishedAt: '2026-10-04T09:00:00.000Z',
  },
  {
    slug: 'github-actions-ci-pipeline',
    title: 'GitHub Actions CI 파이프라인',
    category: CATEGORIES.devops,
    tags: [TAGS.docker, TAGS.testing],
    publishedAt: '2026-09-25T09:00:00.000Z',
  },
  {
    slug: 'monorepo-without-shared-package',
    title: '공용 패키지 없는 모노레포',
    category: CATEGORIES.architecture,
    tags: [TAGS.nextjs, TAGS.nestjs],
    publishedAt: '2026-09-15T09:00:00.000Z',
  },
  {
    slug: 'playwright-visual-regression',
    title: 'Playwright 시각 회귀 운용',
    category: CATEGORIES.frontend,
    tags: [TAGS.testing],
    publishedAt: '2026-09-05T09:00:00.000Z',
  },
  {
    slug: 'writing-a-tech-blog',
    title: '기술 블로그를 운영하며',
    category: CATEGORIES.career,
    tags: [],
    publishedAt: '2026-08-25T09:00:00.000Z',
  },
  {
    slug: 'uncategorized-memo',
    title: '분류 없는 메모',
    category: null,
    tags: [],
    publishedAt: '2026-08-10T09:00:00.000Z',
  },
];

function toInternalPost(row: PostRow, index: number): InternalPost {
  const coverImageUrl = coverUrlAt(index);
  const hasSeo = index % 2 === 0;
  return {
    slug: row.slug,
    title: row.title,
    excerpt: `${row.title}에 대한 요약입니다. 카드와 목록에 쓰이는 한두 문장 길이의 발췌문입니다.`,
    coverImageUrl,
    category: row.category,
    tags: row.tags,
    publishedAt: row.publishedAt,
    updatedAt: row.publishedAt,
    isFeatured: row.isFeatured ?? false,
    readingMinutes: 3 + (index % 7),
    viewCount: 100 + index * 13,
    likeCount: index * 2,
    seoTitle: hasSeo ? `${row.title} | jblog` : null,
    seoDescription: hasSeo ? `${row.title}의 SEO 설명입니다.` : null,
    contentMd: contentMdOf(row.title, coverImageUrl),
    version: 1 + (index % 3),
  } satisfies InternalPost;
}

/** 발행 글 전체(최신순). 내부 API 원문 포함 형태. */
export const INTERNAL_POSTS: InternalPost[] = POST_ROWS.map(toInternalPost);

function toSummary(post: InternalPost): PostSummary {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    coverImageUrl: post.coverImageUrl,
    category: post.category,
    publishedAt: post.publishedAt,
    readingMinutes: post.readingMinutes,
    viewCount: post.viewCount,
    likeCount: post.likeCount,
  } satisfies PostSummary;
}

// 공개 상세는 contentMd·version을 담지 않는다(백엔드 §4.2). 빼는 방식이 아니라 필드를 직접 나열해 새 필드가 실수로 새지 않게 한다.
function toPublicDetail(post: InternalPost): PostDetail {
  return {
    ...toSummary(post),
    tags: post.tags,
    isFeatured: post.isFeatured,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    updatedAt: post.updatedAt,
  } satisfies PostDetail;
}

export const POST_SUMMARIES: PostSummary[] = INTERNAL_POSTS.map(toSummary);

export const CATEGORIES_RESPONSE: CategoryWithCount[] = CATEGORY_ORDER.map((ref) => ({
  ...ref,
  postCount: INTERNAL_POSTS.filter((post) => post.category?.slug === ref.slug).length,
}));

export const TAGS_RESPONSE: TagWithCount[] = [
  ...TAG_ORDER.map((ref) => ({
    ...ref,
    postCount: INTERNAL_POSTS.filter((post) => post.tags.some((t) => t.slug === ref.slug)).length,
  })),
  // 시험용 태그는 목록에 있는 slug(404 아님)여야 해서 postCount를 1로 둔다. 글 조회는 아래 handlePublicApi가 가로챈다.
  ...HOOK_TAGS.map((ref) => ({ ...ref, postCount: 1 })),
];

// ───────────────────────── 조회 규칙 ─────────────────────────

const toLink = (post: InternalPost): PostLink => ({ slug: post.slug, title: post.title });

// prev는 더 오래된 글, next는 더 최근 글이다(M2-01 계약). INTERNAL_POSTS는 최신순이다.
function neighbours(post: InternalPost) {
  const index = INTERNAL_POSTS.indexOf(post);
  const next = INTERNAL_POSTS[index - 1];
  const prev = INTERNAL_POSTS[index + 1];
  const related = INTERNAL_POSTS.filter(
    (other) =>
      other !== post && post.category !== null && other.category?.slug === post.category.slug,
  )
    .slice(0, MAX_RELATED_POSTS)
    .map(toSummary);
  return { prev: prev ? toLink(prev) : null, next: next ? toLink(next) : null, related };
}

const findPost = (slug: string) => INTERNAL_POSTS.find((post) => post.slug === slug);

interface Paging {
  page: number;
  size: number;
}

function paginate(posts: InternalPost[], { page, size }: Paging): PostList {
  const start = (page - 1) * size;
  return {
    items: posts.slice(start, start + size).map(toSummary),
    page,
    size,
    totalItems: posts.length,
    totalPages: Math.ceil(posts.length / size),
  };
}

// 제목 일치를 먼저, 그다음 발췌문 일치(백엔드 §4.2 검색 비고). 부분 문자열, 대소문자 무시.
function searchPosts(query: string): InternalPost[] {
  const needle = query.toLowerCase();
  const inTitle = INTERNAL_POSTS.filter((post) => post.title.toLowerCase().includes(needle));
  const inExcerptOnly = INTERNAL_POSTS.filter(
    (post) => !inTitle.includes(post) && post.excerpt.toLowerCase().includes(needle),
  );
  return [...inTitle, ...inExcerptOnly];
}

// ───────────────────────── HTTP ─────────────────────────

interface Exchange {
  req: http.IncomingMessage;
  res: http.ServerResponse;
}

interface JsonReply {
  status: number;
  body: unknown;
  cacheControl: string;
  headers?: http.OutgoingHttpHeaders;
}

function sendJson(res: http.ServerResponse, reply: JsonReply) {
  const payload = JSON.stringify(reply.body);
  res.writeHead(reply.status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': reply.cacheControl,
    ...reply.headers,
  });
  res.end(payload);
}

interface Failure {
  status: number;
  code: string;
  message: string;
}

// 에러 형식은 백엔드 §4.1(ErrorResponseDto)과 같다. 에러는 공유 캐시에 남기지 않는다.
function sendError({ req, res }: Exchange, { status, code, message }: Failure) {
  const body: ErrorBody = {
    statusCode: status,
    code,
    message,
    path: (req.url ?? '').split('?')[0] ?? '',
    timestamp: new Date().toISOString(),
  };
  sendJson(res, { status, body, cacheControl: CACHE_CONTROL.internal });
}

const NOT_FOUND: Failure = { status: 404, code: 'NOT_FOUND', message: 'Not found' };
const POST_NOT_FOUND: Failure = { status: 404, code: 'POST_NOT_FOUND', message: 'Post not found' };
const INVALID_PATH: Failure = {
  status: 400,
  code: 'VALIDATION_FAILED',
  message: 'Malformed URL encoding',
};
const INTERNAL_ERROR: Failure = {
  status: 500,
  code: 'INTERNAL_ERROR',
  message: 'Unexpected fixture server error',
};
const INVALID_QUERY: Failure = {
  status: 400,
  code: 'VALIDATION_FAILED',
  message: 'Invalid query',
};

interface IntegerOption {
  name: string;
  fallback: number;
  max?: number;
}

// 1 이상의 정수만 받는다. 없으면 기본값, 잘못되면 undefined(=400).
function positiveInt(query: URLSearchParams, { name, fallback, max }: IntegerOption) {
  const raw = query.get(name);
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  return value >= 1 && value <= (max ?? Number.MAX_SAFE_INTEGER) ? value : undefined;
}

function pagingOf(query: URLSearchParams): Paging | undefined {
  const page = positiveInt(query, { name: 'page', fallback: 1 });
  const size = positiveInt(query, {
    name: 'size',
    fallback: DEFAULT_PAGE_SIZE,
    max: MAX_PAGE_SIZE,
  });
  return page === undefined || size === undefined ? undefined : { page, size };
}

function listPosts(query: URLSearchParams): PostList | undefined {
  const paging = pagingOf(query);
  const featured = query.get('featured');
  if (!paging || (featured !== null && featured !== 'true' && featured !== 'false')) {
    return undefined;
  }

  const categorySlug = query.get('category');
  const tagSlug = query.get('tag');
  const filtered = INTERNAL_POSTS.filter(
    (post) =>
      (categorySlug === null || post.category?.slug === categorySlug) &&
      (tagSlug === null || post.tags.some((t) => t.slug === tagSlug)) &&
      (featured === null || post.isFeatured === (featured === 'true')),
  );
  return paginate(filtered, paging);
}

// `/api/posts/` 뒤에 slug 한 조각만 있는 경로만 받는다(`/api/posts/x/views` 같은 건 이 서버가 흉내 내지 않는다).
function slugAfter(pathname: string, prefix: string): string | undefined {
  if (!pathname.startsWith(prefix)) return undefined;
  const rest = decodeURIComponent(pathname.slice(prefix.length));
  return rest !== '' && !rest.includes('/') ? rest : undefined;
}

function handleSearch(exchange: Exchange, query: URLSearchParams) {
  const q = query.get('q') ?? '';
  const paging = pagingOf(query);
  if (q.length < MIN_SEARCH_LENGTH || !paging) {
    return sendError(exchange, { ...INVALID_QUERY, message: 'q must be at least 2 characters' });
  }
  const body = paginate(searchPosts(q), paging);
  return sendJson(exchange.res, { status: 200, body, cacheControl: CACHE_CONTROL.search });
}

function handlePublicPost(exchange: Exchange, slug: string) {
  if (slug === OLD_SLUG) {
    return sendJson(exchange.res, {
      status: 301,
      body: {},
      cacheControl: CACHE_CONTROL.public,
      headers: { Location: `/api/posts/${OLD_SLUG_TARGET}` },
    });
  }
  const post = findPost(slug);
  if (!post) return sendError(exchange, POST_NOT_FOUND);
  const body: Schemas['PostDetailResponseDto'] = {
    post: toPublicDetail(post),
    ...neighbours(post),
  };
  return sendJson(exchange.res, { status: 200, body, cacheControl: CACHE_CONTROL.public });
}

// 시험용 태그(오류·지연)의 글 조회를 가로챈다. 가로챘으면 true.
function handleHookTag(exchange: Exchange, query: URLSearchParams): boolean {
  const tagSlug = query.get('tag');
  if (tagSlug === ERROR_TAG.slug) {
    sendError(exchange, INTERNAL_ERROR);
    return true;
  }
  if (!isSlowTag(tagSlug)) return false;
  const empty = paginate([], pagingOf(query) ?? { page: 1, size: DEFAULT_PAGE_SIZE });
  setTimeout(
    () => sendJson(exchange.res, { status: 200, body: empty, cacheControl: CACHE_CONTROL.public }),
    SLOW_TAG_DELAY_MS,
  );
  return true;
}

function handlePublicApi(exchange: Exchange, pathname: string, query: URLSearchParams) {
  const { res } = exchange;
  const ok = (body: unknown, cacheControl: string = CACHE_CONTROL.public) =>
    sendJson(res, { status: 200, body, cacheControl });

  if (pathname === '/api/posts' && handleHookTag(exchange, query)) return;
  if (pathname === '/api/posts') {
    const list = listPosts(query);
    return list ? ok(list) : sendError(exchange, INVALID_QUERY);
  }
  if (pathname === '/api/categories') return ok(CATEGORIES_RESPONSE);
  if (pathname === '/api/tags') return ok(TAGS_RESPONSE);
  if (pathname === '/api/search') return handleSearch(exchange, query);

  const slug = slugAfter(pathname, '/api/posts/');
  if (slug === undefined) return sendError(exchange, NOT_FOUND);
  return handlePublicPost(exchange, slug);
}

function handleInternalApi(exchange: Exchange, pathname: string, internalKey: string) {
  const { req, res } = exchange;
  const slug = slugAfter(pathname, '/internal/posts/');
  if (slug === undefined) return sendError(exchange, NOT_FOUND);
  // 키 검사가 먼저다. 틀린 키로는 글이 있는지 없는지도 알 수 없어야 한다.
  if (req.headers[INTERNAL_KEY_HEADER] !== internalKey) {
    return sendError(exchange, {
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid internal key',
    });
  }
  const cacheControl = CACHE_CONTROL.internal;
  if (slug === OLD_SLUG) {
    const body: Schemas['InternalPostRedirectDto'] = { redirectTo: OLD_SLUG_TARGET };
    return sendJson(res, { status: 200, body, cacheControl });
  }
  const post = findPost(slug);
  if (!post) return sendError(exchange, POST_NOT_FOUND);
  const body: Schemas['InternalPostResponseDto'] = { post, ...neighbours(post) };
  return sendJson(res, { status: 200, body, cacheControl });
}

function handleUpload(exchange: Exchange, pathname: string) {
  const { req, res } = exchange;
  const file = path.basename(pathname);
  const isKnown =
    pathname.startsWith(UPLOADS_PREFIX) && (COVER_FILES as readonly string[]).includes(file);
  const filePath = path.join(ASSETS_DIR, file);
  if (!isKnown || !fs.existsSync(filePath)) return sendError(exchange, NOT_FOUND);

  const bytes = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-Length': bytes.length,
    'Cache-Control': CACHE_CONTROL.upload,
  });
  res.end(req.method === 'HEAD' ? undefined : bytes);
}

// 잘못된 퍼센트 인코딩(`%`)은 decodeURIComponent가 URIError를 던진다. 클라이언트 입력 문제이므로 400이다.
function routeOf(exchange: Exchange, internalKey: string) {
  const { req, res } = exchange;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendError(exchange, {
      status: 405,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only GET is supported',
    });
  }
  const { pathname, searchParams } = new URL(req.url ?? '/', 'http://fixture.local');

  if (pathname === '/__fixture/health') {
    return sendJson(res, {
      status: 200,
      body: { status: 'ok' },
      cacheControl: CACHE_CONTROL.internal,
    });
  }
  if (pathname.startsWith('/api/')) return handlePublicApi(exchange, pathname, searchParams);
  if (pathname.startsWith('/internal/')) return handleInternalApi(exchange, pathname, internalKey);
  if (pathname.startsWith('/uploads/')) return handleUpload(exchange, pathname);
  return sendError(exchange, NOT_FOUND);
}

// 어떤 요청도 프로세스를 죽이면 안 된다. 예상 못 한 예외는 로그를 남기고 500으로 답한다.
function respondToFailure(exchange: Exchange, error: unknown) {
  if (error instanceof URIError) return sendError(exchange, INVALID_PATH);
  console.error('fixture api unexpected error', error);
  if (exchange.res.headersSent) return exchange.res.destroy();
  return sendError(exchange, INTERNAL_ERROR);
}

export function createFixtureServer(
  internalKey: string = DEFAULT_FIXTURE_INTERNAL_KEY,
): http.Server {
  return http.createServer((req, res) => {
    const exchange: Exchange = { req, res };
    try {
      routeOf(exchange, internalKey);
    } catch (error) {
      respondToFailure(exchange, error);
    }
  });
}

// ───────────────────────── 직접 실행 ─────────────────────────

function isMainModule(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && path.basename(entry) === 'server.ts';
}

// 이 도구 서버의 포트·테스트 키만 읽는 단독 실행 진입점이라 설정 모듈을 따로 두지 않는다.
function readFixtureSettings() {
  return {
    port: Number(process.env.FIXTURE_API_PORT ?? DEFAULT_FIXTURE_API_PORT),
    internalKey: process.env.FIXTURE_INTERNAL_KEY ?? DEFAULT_FIXTURE_INTERNAL_KEY,
  };
}

if (isMainModule()) {
  const { port, internalKey } = readFixtureSettings();
  createFixtureServer(internalKey).listen(port, () => {
    console.log(`fixture api listening on :${port}`);
  });
}
