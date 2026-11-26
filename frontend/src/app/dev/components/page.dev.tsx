import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { Section as LayoutSection } from '@/components/layout/Section';
import { PageInfo } from '@/components/layout/PageInfo';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { CategoryChips } from '@/features/posts/components/CategoryChips';
import { FeaturedHeroCard } from '@/features/posts/components/FeaturedHeroCard';
import { PostCardGrid } from '@/features/posts/components/PostCardGrid';
import { PostCardOverlay } from '@/features/posts/components/PostCardOverlay';
import { PostCardSkeleton } from '@/features/posts/components/PostCardSkeleton';
import { SearchInput } from '@/components/ui/SearchInput';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import type { components } from '@/generated/api-types';

// 개발 전용 페이지다. JBLOG_DEV_PAGES=1 빌드에서만 라우트가 되고 운영 빌드에는 들어가지 않는다 (next.config.ts).
export const metadata: Metadata = {
  title: 'Components (dev)',
  robots: { index: false, follow: false },
};

// hover·focus는 마우스·키보드 없이 눈으로 볼 수 있게 같은 스타일을 고정해 보여준다.
const FIXED_FOCUS_RING = 'outline-2 outline-offset-2 outline-primary';
// 컴포넌트에 hover 스타일이 아직 없어 hover 예제는 기본과 같다. 스타일이 생기면 여기서 고정 클래스를 준다.
const FIXED_HOVER = '';

const BUTTON_VARIANTS = ['primary', 'outline', 'icon', 'pillSolid', 'pillOutline'] as const;
const BUTTON_STATES = ['default', 'hover', 'focus', 'disabled'] as const;
const STATE_CLASS: Record<(typeof BUTTON_STATES)[number], string> = {
  default: '',
  hover: FIXED_HOVER,
  focus: FIXED_FOCUS_RING,
  disabled: '',
};
// 대비 E2E가 기본 예제를 이름(GitHub)으로 찾는다.
const ICON_BUTTON_LABEL = {
  default: 'GitHub',
  hover: 'icon hover',
  focus: 'icon focus',
  disabled: 'icon disabled',
} as const;
// 연락처는 실제 값이 아닌 example.com 예시다.
const EXAMPLE_FOOTER = {
  about: '기술과 기록을 모아 두는 개인 블로그입니다.',
  contact: { email: 'hello@example.com', githubUrl: 'https://github.com/example' },
  categories: ['React', 'TypeScript', 'NestJS', 'Prisma', 'DevOps', 'Career', 'Extra'].map(
    (name) => ({ name, slug: name.toLowerCase() }),
  ),
};
const AVATAR_SIZES = [28, 40, 80];
// 외부 URL·실제 인물 사진을 쓰지 않는 단색 더미 이미지
const AVATAR_IMAGE = '/dev/avatar-dummy.png';

type PostSummaryDto = components['schemas']['PostSummaryDto'];
type CategoryWithCountDto = components['schemas']['CategoryWithCountDto'];

// 카드 예시 데이터. 이미지는 E2E 픽스처 경로이고 개발 서버에서는 /uploads rewrite로 보인다.
const BACKEND_CATEGORY = { name: '백엔드', slug: 'backend' };
const MAX_TITLE_LENGTH = 200;
const MAX_TITLE = '가나다라마바사아자차'.repeat(MAX_TITLE_LENGTH / 10);

const EXAMPLE_POSTS = {
  // 제목이 2줄이라 스켈레톤(제목 2줄)과 높이가 같다
  withCover: {
    title: 'Prisma 마이그레이션을 무중단으로 적용하는 방법',
    slug: 'prisma-zero-downtime',
    excerpt: '예시 요약',
    coverImageUrl: '/uploads/fixtures/cover-indigo.png',
    category: BACKEND_CATEGORY,
    publishedAt: '2026-01-04T15:00:00.000Z',
    readingMinutes: 5,
    likeCount: 0,
    viewCount: 0,
  },
  // 커버 없음 + 카테고리 없음 + 3줄을 넘는 긴 제목(3줄 clamp 확인용)
  noCoverNoCategory: {
    title:
      '아주 긴 제목의 글은 카드 안에서 세 줄까지만 보이고 그 뒤는 말줄임표로 잘려야 하므로 이 예시는 일부러 길게 적었습니다',
    slug: 'very-long-title',
    excerpt: '예시 요약',
    coverImageUrl: null,
    category: null,
    publishedAt: '2025-12-31T15:00:00.000Z',
    readingMinutes: 1,
    likeCount: 0,
    viewCount: 0,
  },
  another: {
    title: 'React 서버 컴포넌트 경계 정하기',
    slug: 'rsc-boundary',
    excerpt: '예시 요약',
    coverImageUrl: '/uploads/fixtures/cover-rose.png',
    category: { name: '프론트엔드', slug: 'frontend' },
    publishedAt: '2026-02-10T03:00:00.000Z',
    readingMinutes: 8,
    likeCount: 0,
    viewCount: 0,
  },
  overlay: {
    title: '개인 블로그를 직접 만들며 배운 것들',
    slug: 'building-jblog',
    excerpt: '예시 요약',
    coverImageUrl: '/uploads/fixtures/cover-emerald.png',
    category: BACKEND_CATEGORY,
    publishedAt: '2026-03-01T03:00:00.000Z',
    readingMinutes: 6,
    likeCount: 0,
    viewCount: 0,
  },
  hero: {
    title: '운영 중인 서비스의 캐시 전략',
    slug: 'cache-strategy',
    excerpt: '예시 요약',
    coverImageUrl: '/uploads/fixtures/cover-amber.png',
    category: { name: '인프라', slug: 'infra' },
    publishedAt: '2026-03-15T03:00:00.000Z',
    readingMinutes: 10,
    likeCount: 0,
    viewCount: 0,
  },
  heroLong: {
    title:
      '운영 중인 서비스에서 캐시 전략을 처음부터 다시 설계하며 겪은 무효화 문제와 일관성 보장, 그리고 장애를 줄이기 위해 도입한 단계별 롤아웃 과정에서 배운 점들을 정리한 아주 긴 제목의 예시 글',
    slug: 'cache-strategy-long',
    excerpt: '예시 요약',
    coverImageUrl: '/uploads/fixtures/cover-amber.png',
    category: { name: '인프라', slug: 'infra' },
    publishedAt: '2026-03-15T03:00:00.000Z',
    readingMinutes: 10,
    likeCount: 0,
    viewCount: 0,
  },
  // 백엔드 최대 길이(200자) 제목: 공백이 없어 줄바꿈 기회가 없는 최악의 경우
  maxTitle: {
    title: MAX_TITLE,
    slug: 'max-title',
    excerpt: '예시 요약',
    coverImageUrl: '/uploads/fixtures/cover-indigo.png',
    category: BACKEND_CATEGORY,
    publishedAt: '2026-03-15T03:00:00.000Z',
    readingMinutes: 10,
    likeCount: 0,
    viewCount: 0,
  },
} satisfies Record<string, PostSummaryDto>;
const EXAMPLE_CATEGORIES = [
  { name: '백엔드', slug: 'backend', postCount: 12 },
  { name: '프론트엔드', slug: 'frontend', postCount: 8 },
  { name: '인프라', slug: 'infra', postCount: 5 },
  { name: '데이터베이스', slug: 'database', postCount: 4 },
  { name: '커리어', slug: 'career', postCount: 2 },
] satisfies CategoryWithCountDto[];
const SKELETON_COUNT = 3;
const CARD_GRID_CLASS =
  'grid grid-cols-1 items-start gap-4 tablet:grid-cols-2 tablet:gap-5 laptop:grid-cols-3';

const COLOR_SWATCHES = [
  'bg-bg',
  'bg-bg-subtle',
  'bg-surface',
  'bg-surface-2',
  'bg-border',
  'bg-border-strong',
  'bg-strong',
  'bg-body',
  'bg-muted',
  'bg-subtle',
  'bg-nav-text',
  'bg-primary',
  'bg-primary-strong',
  'bg-primary-text',
  'bg-on-primary',
  'bg-danger',
  'bg-icon-button-bg',
  'bg-toggle-knob',
  'bg-toggle-knob-icon',
  'bg-primary-soft',
  'bg-input-bg',
  'bg-input-placeholder',
  'bg-footer-bg',
  'bg-footer-link',
  'bg-toggle-track',
  'bg-overlay',
];

const TYPE_SAMPLES = [
  'text-h1',
  'text-h3',
  'text-h3-bold',
  'text-h4',
  'text-b2',
  'text-b3',
  'text-b4',
  'text-b4-medium',
  'text-b5',
  'text-b5-medium',
  'type-article',
  'type-quote',
  'text-footer-logo',
  'text-footer-title',
  'text-footer-body',
  'text-footer-label',
  'text-display-hero',
  'text-display-section',
  'text-eyebrow',
  'text-intro',
  'text-exp-title',
  'text-exp-body',
];

// wide: 내용이 자기 Container를 가진 컴포넌트(Footer)는 개발 페이지 컨테이너 밖(전체 폭)에 둬야 실제 폭으로 보인다.
function Section({
  id,
  title,
  wide = false,
  children,
}: {
  id: string;
  title: string;
  wide?: boolean;
  children: ReactNode;
}) {
  if (wide) {
    return (
      <section data-testid={id} className="border-border border-t py-8">
        <div className="container-site mb-4">
          <h2 className="text-h4 text-strong">{title}</h2>
        </div>
        {children}
      </section>
    );
  }
  return (
    <section data-testid={id} className="border-border border-t py-8">
      <div className="container-site flex flex-col gap-4">
        <h2 className="text-h4 text-strong">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-4">{children}</div>;
}

export default function ComponentsPage() {
  return (
    <main className="text-body py-8">
      <header className="container-site flex items-center justify-between gap-4 pb-8">
        <h1 className="text-h3-bold text-strong">Components</h1>
        <ThemeToggle />
      </header>

      <Section id="dev-badge" title="Badge">
        <Row>
          <Badge variant="solid" data-example="solid-md">
            solid md
          </Badge>
          <Badge variant="solid" size="lg" data-example="solid-lg">
            solid lg
          </Badge>
          <Badge variant="soft" data-example="soft-md">
            soft md
          </Badge>
          <Badge variant="soft" size="lg" data-example="soft-lg">
            soft lg
          </Badge>
          <Badge href="#badge-link" data-example="link">
            link
          </Badge>
        </Row>
      </Section>

      <Section id="dev-button" title="Button">
        {BUTTON_VARIANTS.map((variant) => (
          <Row key={variant}>
            {BUTTON_STATES.map((state) => (
              <Button
                key={state}
                variant={variant}
                data-example={`${variant}-${state}`}
                disabled={state === 'disabled'}
                aria-label={variant === 'icon' ? ICON_BUTTON_LABEL[state] : undefined}
                className={STATE_CLASS[state]}
              >
                {variant === 'icon' ? (
                  <Icon name="github" />
                ) : state === 'default' ? (
                  variant
                ) : (
                  state
                )}
              </Button>
            ))}
          </Row>
        ))}
        <Row>
          <Button asChild variant="pillOutline">
            <a href="#button-link">asChild 링크</a>
          </Button>
          <Button asChild variant="outline" disabled>
            <a href="#button-link-disabled">asChild 비활성</a>
          </Button>
        </Row>
      </Section>

      <Section id="dev-avatar" title="Avatar">
        <Row>
          {AVATAR_SIZES.map((size) => (
            <Avatar
              key={`i${size}`}
              src={AVATAR_IMAGE}
              alt="더미 이미지"
              size={size}
              data-example={`image-${size}`}
            />
          ))}
          {AVATAR_SIZES.map((size) => (
            <Avatar key={`t${size}`} alt="Jason" size={size} data-example={`initials-${size}`} />
          ))}
          <Avatar alt="홍길동" size={48} />
        </Row>
      </Section>

      <Section id="dev-input" title="Input">
        <div className="flex max-w-80 flex-col gap-4">
          <Input label="기본" placeholder="you@example.com" data-example="default" />
          <Input label="포커스 (고정)" className={FIXED_FOCUS_RING} data-example="focus" />
          <Input
            label="오류"
            defaultValue="abc"
            error="올바른 이메일을 입력하세요"
            data-example="error"
          />
          <Input label="비활성" disabled placeholder="disabled" data-example="disabled" />
        </div>
      </Section>

      <Section id="dev-searchinput" title="SearchInput">
        <div className="flex max-w-80 flex-col gap-4">
          <SearchInput placeholder="Search" data-example="default" />
          <SearchInput
            placeholder="포커스 (고정)"
            className={FIXED_FOCUS_RING}
            data-example="focus"
          />
          <SearchInput placeholder="disabled" disabled data-example="disabled" />
        </div>
      </Section>

      <Section id="dev-themetoggle" title="ThemeToggle">
        <ThemeToggle />
      </Section>

      <Section id="dev-icon" title="Icon">
        <Row>
          <span data-example="lucide">
            <Icon name="search" size={24} />
          </span>
          <span data-example="simple">
            <Icon name="github" size={24} />
          </span>
          <span data-example="labelled">
            <Icon name="mail" label="메일" size={24} />
          </span>
          <Icon name="sun" size={24} />
          <Icon name="moon" size={24} />
          <Icon name="x" size={24} />
          <Icon name="youtube" size={24} />
        </Row>
      </Section>

      <Section id="dev-layout-navbar" title="Navbar">
        <Navbar sticky={false} />
      </Section>

      <Section id="dev-layout-footer" title="Footer (예시 값)" wide>
        <Footer {...EXAMPLE_FOOTER} />
      </Section>

      <Section id="dev-layout-footer-empty" title="Footer (값 없음)" wide>
        <Footer />
      </Section>

      <Section id="dev-layout-pageinfo" title="PageInfo">
        <PageInfo title="Blog" breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Blog' }]} />
      </Section>

      <Section id="dev-layout-sections" title="Section 간격 (연속 2개)">
        {/* 부모가 flex gap을 가지면 Section 사이 간격에 더해지므로 일반 블록으로 한 번 감싼다 */}
        <div>
          <LayoutSection data-example="section-a">
            <p>Section A</p>
          </LayoutSection>
          <LayoutSection data-example="section-b">
            <p>Section B</p>
          </LayoutSection>
          <LayoutSection title="제목 있는 Section" data-example="section-titled">
            <p>Section 내용</p>
          </LayoutSection>
        </div>
      </Section>

      <Section id="dev-posts-cards" title="Post cards">
        <div data-testid="dev-card-grid" className={CARD_GRID_CLASS}>
          <PostCardGrid post={EXAMPLE_POSTS.withCover} />
          <PostCardGrid post={EXAMPLE_POSTS.noCoverNoCategory} />
          <PostCardGrid post={EXAMPLE_POSTS.another} />
        </div>
        <div data-testid="dev-card-overlay">
          <PostCardOverlay post={EXAMPLE_POSTS.overlay} />
        </div>
        <div data-testid="dev-card-hero">
          <FeaturedHeroCard post={EXAMPLE_POSTS.hero} />
        </div>
        <div data-testid="dev-card-hero-long">
          <FeaturedHeroCard post={EXAMPLE_POSTS.heroLong} />
        </div>
        <div data-testid="dev-card-overlay-long">
          <PostCardOverlay post={EXAMPLE_POSTS.maxTitle} />
        </div>
        <div data-testid="dev-card-grid-long" className={CARD_GRID_CLASS}>
          <PostCardGrid post={EXAMPLE_POSTS.maxTitle} />
        </div>
        <div data-testid="dev-card-hero-max">
          <FeaturedHeroCard post={EXAMPLE_POSTS.maxTitle} />
        </div>
        <div data-testid="dev-chips">
          <CategoryChips categories={EXAMPLE_CATEGORIES} activeSlug="frontend" />
        </div>
        <div data-testid="dev-card-skeleton" className={CARD_GRID_CLASS}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <PostCardSkeleton key={index} />
          ))}
        </div>
      </Section>

      <Section id="dev-tokens" title="Tokens">
        <div className="grid grid-cols-2 gap-2 tablet:grid-cols-4 laptop:grid-cols-6">
          {COLOR_SWATCHES.map((swatch) => (
            <div key={swatch} className="text-b5 flex flex-col gap-1">
              <div className={`${swatch} border-border h-10 rounded-md border`} />
              <span className="break-all">{swatch.replace('bg-', '')}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {TYPE_SAMPLES.map((typeClass) => (
            <p key={typeClass} className={`${typeClass} text-strong`}>
              {typeClass} 가나다 Abc
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-display-section text-gradient-primary">text-gradient-primary</p>
          <p className="text-display-section text-gradient-orange">PROJECTS</p>
          <p className="text-display-section text-gradient-blue">EXPERIENCE</p>
        </div>
      </Section>
    </main>
  );
}
