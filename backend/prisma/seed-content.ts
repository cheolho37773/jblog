// seed가 넣는 기본 값 (백엔드 §3.3, 개요 Q3). 디자인 검수용 명백한 더미이며 실제 개인 정보가 아니다.
// 관리자 계정(User)은 넣지 않는다: 허용된 GitHub 계정의 최초 로그인 때 만들어진다.

// Profile은 단일 행이다 (스키마 Profile.id 기본값과 같은 값).
export const PROFILE_SINGLETON_ID = 1;

export const SAMPLE_PROFILE = {
  name: 'Sample Author',
  title: 'Backend Engineer',
  headline: 'I do code and\nmake content **about it!**',
  intro: '디자인 검수용 더미 소개문입니다. 관리자 화면에서 실제 내용으로 바꿉니다.',
  bio: '디자인 검수용 더미 자기소개입니다. 관리자 화면에서 실제 내용으로 바꿉니다.',
  // example.com은 예시 전용으로 예약된 도메인이다 (RFC 2606).
  email: 'author@example.com',
  socialLinks: [{ type: 'github', url: 'https://github.com/example' }],
};

// 개요 Q3의 시드 카테고리. 순서가 곧 sortOrder다.
export const SEED_CATEGORIES = [
  { name: 'Backend', slug: 'backend' },
  { name: 'Frontend', slug: 'frontend' },
  { name: 'DevOps', slug: 'devops' },
  { name: 'Retrospect', slug: 'retrospect' },
];

// 시드 태그. 이름 순이 아니라 아래 글 정의에서 slug로 참조한다.
export const SEED_TAGS = [
  { name: 'NestJS', slug: 'nestjs' },
  { name: 'Next.js', slug: 'nextjs' },
  { name: 'PostgreSQL', slug: 'postgresql' },
  { name: 'Docker', slug: 'docker' },
  { name: '캐시', slug: 'cache' },
  { name: '테스트', slug: 'testing' },
];

// 시드 커버 이미지. 파일은 seed-assets/에 있고(generate-seed-covers.ts가 만든다) 개발 모드에서만 api가 서빙한다.
export const SEED_COVER_URL_PREFIX = '/uploads/seed/';
const SEED_COVER_FILES = [
  'cover-indigo.png',
  'cover-teal.png',
  'cover-rose.png',
  'cover-slate.png',
];

// 예약 글은 시간이 지나도 계속 예약 상태로 남도록 아주 먼 미래로 고정한다.
const SCHEDULED_PUBLISHED_AT = '2099-01-01T00:00:00.000Z';

export interface SamplePost {
  slug: string;
  title: string;
  categoryName: string;
  // null이면 초안(DRAFT)으로 둔다. 미래 시각이면 예약 발행(PUBLISHED + 미래 publishedAt)이다.
  publishedAt: Date | null;
  isFeatured: boolean;
  readingMinutes: number;
  coverImageUrl: string | null;
  tagSlugs: string[];
  // 이전 slug(영구 예약). 현재 slug로 301이 나가는지 확인하는 데 쓴다.
  previousSlugs: string[];
}

interface SamplePostInput {
  index: number;
  categoryName: string;
  // 'YYYY-MM-DD' (UTC 자정). null이면 초안.
  publishedOn: string | null;
  readingMinutes: number;
  isFeatured?: boolean;
  // 시드 커버 파일 번호(SEED_COVER_FILES 기준). 없으면 커버 없는 글이다.
  coverIndex?: number;
  tagSlugs?: string[];
  previousSlugs?: string[];
  // 'YYYY-MM-DD'보다 정확한 시각이 필요할 때(예약 글).
  publishedAtOverride?: string;
}

function samplePost(input: SamplePostInput): SamplePost {
  const { index, categoryName, publishedOn } = input;
  const publishedAtIso = input.publishedAtOverride ?? `${publishedOn}T00:00:00.000Z`;
  return {
    slug: `sample-post-${index}`,
    title: `샘플 글 ${index} (${categoryName})`,
    categoryName,
    publishedAt:
      publishedOn === null && !input.publishedAtOverride ? null : new Date(publishedAtIso),
    isFeatured: input.isFeatured ?? false,
    readingMinutes: input.readingMinutes,
    coverImageUrl:
      input.coverIndex === undefined
        ? null
        : `${SEED_COVER_URL_PREFIX}${SEED_COVER_FILES[input.coverIndex % SEED_COVER_FILES.length]}`,
    tagSlugs: input.tagSlugs ?? [],
    previousSlugs: input.previousSlugs ?? [],
  };
}

// 디자인 검수에 필요한 경우를 고루 담는다.
// 발행 13개(Featured 1개, 카테고리 4개 모두 사용, 커버 없는 글·태그 없는 글 포함), 예약 1개, 초안 1개, 이전 slug 1개.
// 날짜를 고정해 두어 다시 실행해도 같은 값이 된다.
export const SAMPLE_POSTS: SamplePost[] = [
  {
    index: 1,
    categoryName: 'Backend',
    publishedOn: '2026-01-05',
    readingMinutes: 6,
    isFeatured: true,
    coverIndex: 0,
    tagSlugs: ['nestjs', 'postgresql', 'cache'],
  },
  {
    index: 2,
    categoryName: 'Frontend',
    publishedOn: '2026-01-19',
    readingMinutes: 4,
    coverIndex: 1,
    tagSlugs: ['nextjs', 'cache'],
  },
  {
    index: 3,
    categoryName: 'DevOps',
    publishedOn: '2026-02-02',
    readingMinutes: 8,
    tagSlugs: ['docker'],
  },
  {
    index: 4,
    categoryName: 'Retrospect',
    publishedOn: '2026-02-16',
    readingMinutes: 3,
    coverIndex: 2,
  },
  {
    index: 5,
    categoryName: 'Backend',
    publishedOn: '2026-03-02',
    readingMinutes: 5,
    coverIndex: 3,
    tagSlugs: ['nestjs', 'testing'],
  },
  {
    index: 6,
    categoryName: 'Frontend',
    publishedOn: '2026-03-16',
    readingMinutes: 7,
    coverIndex: 0,
    tagSlugs: ['nextjs', 'testing'],
  },
  {
    index: 7,
    categoryName: 'DevOps',
    publishedOn: '2026-03-30',
    readingMinutes: 2,
    coverIndex: 1,
    tagSlugs: ['docker', 'postgresql'],
  },
  {
    index: 8,
    categoryName: 'Backend',
    publishedOn: '2026-04-13',
    readingMinutes: 9,
    tagSlugs: ['postgresql'],
  },
  { index: 9, categoryName: 'Retrospect', publishedOn: null, readingMinutes: 1 },
  {
    index: 10,
    categoryName: 'Backend',
    publishedOn: '2026-04-27',
    readingMinutes: 6,
    coverIndex: 2,
    tagSlugs: ['nestjs', 'cache', 'testing'],
    previousSlugs: ['sample-post-10-old-title'],
  },
  {
    index: 11,
    categoryName: 'Frontend',
    publishedOn: '2026-05-11',
    readingMinutes: 5,
    coverIndex: 3,
    tagSlugs: ['nextjs'],
  },
  {
    index: 12,
    categoryName: 'DevOps',
    publishedOn: '2026-05-25',
    readingMinutes: 4,
    coverIndex: 0,
  },
  {
    index: 13,
    categoryName: 'Retrospect',
    publishedOn: '2026-06-08',
    readingMinutes: 3,
    coverIndex: 1,
  },
  {
    index: 14,
    categoryName: 'Backend',
    publishedOn: '2026-06-22',
    readingMinutes: 7,
    coverIndex: 2,
    tagSlugs: ['postgresql', 'docker'],
  },
  {
    index: 15,
    categoryName: 'Frontend',
    publishedOn: null,
    publishedAtOverride: SCHEDULED_PUBLISHED_AT,
    readingMinutes: 5,
    coverIndex: 3,
    tagSlugs: ['nextjs'],
  },
].map(samplePost);

export function sampleExcerpt(post: SamplePost): string {
  return `${post.title}의 요약입니다. 디자인 검수용 더미 문장입니다.`;
}

// 본문 렌더 파이프라인이 처리할 요소(h2·h3, 코드 블록, 콜아웃, 이미지 캡션)를 모두 담는다.
// 콜아웃(`> [!NOTE]`)·코드 블록 메타(`title="..."`)·이미지 캡션(`![alt](url "캡션")`) 문법은
// 프론트 픽스처(frontend/e2e/fixtures/server.ts)와 같게 맞춘다.
export function sampleContentMarkdown(post: SamplePost): string {
  const imageUrl = post.coverImageUrl ?? `${SEED_COVER_URL_PREFIX}${SEED_COVER_FILES[0]}`;
  return [
    `## ${post.title}을 시작하며`,
    '',
    '디자인 검수용 더미 본문입니다. 실제 글이 아니며 관리자 화면에서 지우거나 고쳐 씁니다.',
    '',
    '### 먼저 알아둘 점',
    '',
    '> [!NOTE]',
    '> 콜아웃 예시입니다. 중요한 내용을 눈에 띄게 보여 줍니다.',
    '',
    '```ts title="example.ts"',
    'export function greet(name: string): string {',
    '  return `Hello, ${name}`;',
    '}',
    '```',
    '',
    `![시드 이미지](${imageUrl} "그림 1. 직접 만든 그라디언트 이미지")`,
    '',
    '## 정리',
    '',
    '- 목록 항목 하나',
    '- 목록 항목 둘',
    '',
    '본문 끝입니다.',
    '',
  ].join('\n');
}
