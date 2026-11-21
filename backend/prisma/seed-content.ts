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

export interface SamplePost {
  slug: string;
  title: string;
  categoryName: string;
  // null이면 초안(DRAFT)으로 둔다.
  publishedAt: Date | null;
  isFeatured: boolean;
  readingMinutes: number;
}

interface SamplePostInput {
  index: number;
  categoryName: string;
  // 'YYYY-MM-DD' (UTC 자정). null이면 초안.
  publishedOn: string | null;
  readingMinutes: number;
  isFeatured?: boolean;
}

function samplePost(input: SamplePostInput): SamplePost {
  const { index, categoryName, publishedOn } = input;
  return {
    slug: `sample-post-${index}`,
    title: `샘플 글 ${index} (${categoryName})`,
    categoryName,
    publishedAt: publishedOn === null ? null : new Date(`${publishedOn}T00:00:00.000Z`),
    isFeatured: input.isFeatured ?? false,
    readingMinutes: input.readingMinutes,
  };
}

// 디자인 검수에 필요한 경우를 고루 담는다: 발행 8개(그중 Featured 1개, 카테고리 4개 모두 사용), 초안 1개.
// 날짜를 고정해 두어 다시 실행해도 같은 값이 된다.
export const SAMPLE_POSTS: SamplePost[] = [
  {
    index: 1,
    categoryName: 'Backend',
    publishedOn: '2026-01-05',
    readingMinutes: 6,
    isFeatured: true,
  },
  { index: 2, categoryName: 'Frontend', publishedOn: '2026-01-19', readingMinutes: 4 },
  { index: 3, categoryName: 'DevOps', publishedOn: '2026-02-02', readingMinutes: 8 },
  { index: 4, categoryName: 'Retrospect', publishedOn: '2026-02-16', readingMinutes: 3 },
  { index: 5, categoryName: 'Backend', publishedOn: '2026-03-02', readingMinutes: 5 },
  { index: 6, categoryName: 'Frontend', publishedOn: '2026-03-16', readingMinutes: 7 },
  { index: 7, categoryName: 'DevOps', publishedOn: '2026-03-30', readingMinutes: 2 },
  { index: 8, categoryName: 'Backend', publishedOn: '2026-04-13', readingMinutes: 9 },
  { index: 9, categoryName: 'Retrospect', publishedOn: null, readingMinutes: 1 },
].map(samplePost);

export function sampleExcerpt(post: SamplePost): string {
  return `${post.title}의 요약입니다. 디자인 검수용 더미 문장입니다.`;
}

export function sampleContentMarkdown(post: SamplePost): string {
  return [
    `## ${post.title}`,
    '',
    '디자인 검수용 더미 본문입니다. 실제 글이 아니며 관리자 화면에서 지우거나 고쳐 씁니다.',
    '',
    '### 코드 블록',
    '',
    '```ts',
    "const greeting = 'hello, jblog';",
    '```',
    '',
    '- 목록 항목 하나',
    '- 목록 항목 둘',
  ].join('\n');
}
