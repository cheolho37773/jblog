import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Container } from '@/components/layout/Container';
import { PageInfo } from '@/components/layout/PageInfo';
import { Button } from '@/components/ui/Button';
import { CategoryChips } from '@/features/posts/components/CategoryChips';
import {
  FilterLinks,
  FilterTransitionProvider,
  PendingListSlot,
} from '@/features/posts/components/FilterTransition';
import { LoadMoreGrid } from '@/features/posts/components/LoadMoreGrid';
import { PostCardOverlay } from '@/features/posts/components/PostCardOverlay';
import { TagFilterChip } from '@/features/posts/components/TagFilterChip';
import {
  loadBlogListing,
  loadCategories,
  loadFeaturedPost,
  loadTags,
} from '@/features/posts/lib/blog-list-api';
import { parseBlogQuery, type BlogQuery } from '@/features/posts/lib/blog-list-query';

type BlogPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const FIRST_PAGE = 1;

// 칩 영역의 위아래 여백(py-2 8px)이 간격 24·48에 포함되도록 그만큼 줄인 바깥 여백이다 (UI §7.2).
const CHIPS_SPACING = 'mt-4 mb-10';
const TAG_CHIP_SPACING = 'mt-6 mb-12';
const OVERLAY_SPACING = 'mb-12';

export async function generateMetadata({ searchParams }: BlogPageProps): Promise<Metadata> {
  const { category, tag } = parseBlogQuery(await searchParams);
  if (tag) {
    const found = (await loadTags()).find((item) => item.slug === tag);
    return { title: found ? `#${found.name} · Blog` : 'Blog' };
  }
  if (category) {
    const found = (await loadCategories()).find((item) => item.slug === category);
    return { title: found ? `${found.name} · Blog` : 'Blog' };
  }
  return { title: 'Blog' };
}

function EmptyState() {
  return (
    <div data-testid="blog-empty" className="flex flex-col items-center gap-6 py-16 text-center">
      <p className="text-h4 text-strong">아직 글이 없습니다</p>
      <Button asChild variant="outline">
        <Link href="/">Home</Link>
      </Button>
    </div>
  );
}

// 없는 slug는 404다. 글이 0개인 카테고리는 있는 slug라 통과한다.
async function resolveTagName(tag: string | undefined): Promise<string | undefined> {
  if (!tag) return undefined;
  const found = (await loadTags()).find((item) => item.slug === tag);
  if (!found) notFound();
  return found.name;
}

async function assertCategoryExists(category: string | undefined) {
  if (!category) return;
  const exists = (await loadCategories()).some((item) => item.slug === category);
  if (!exists) notFound();
}

function filterOf(query: BlogQuery) {
  if (query.tag) return { tag: query.tag };
  if (query.category) return { category: query.category };
  return {};
}

function breadcrumbOf(tagName: string | undefined) {
  const home = { label: 'Home', href: '/' };
  if (!tagName) return [home, { label: 'Blog' }];
  return [home, { label: 'Blog', href: '/blog' }, { label: `#${tagName}` }];
}

async function FilterChips({ query, tagName }: { query: BlogQuery; tagName?: string }) {
  if (tagName) {
    return (
      <div className={TAG_CHIP_SPACING}>
        <TagFilterChip tagName={tagName} />
      </div>
    );
  }
  const categories = await loadCategories();
  return (
    <div className={CHIPS_SPACING}>
      <CategoryChips
        categories={categories.filter((item) => item.postCount > 0)}
        activeSlug={query.category}
      />
    </div>
  );
}

// Overlay는 필터 없는 1페이지 첫 요청에만 나온다. 추천 글이 없으면 최신 글(목록 첫 글)을 쓴다.
async function Overlay({ query, fallback }: { query: BlogQuery; fallback?: BlogListingFirst }) {
  const isUnfilteredFirstPage = !query.tag && !query.category && query.page === FIRST_PAGE;
  if (!isUnfilteredFirstPage) return null;
  const post = (await loadFeaturedPost()) ?? fallback;
  if (!post) return null;
  return (
    <div className={OVERLAY_SPACING}>
      <PostCardOverlay post={post} headingLevel={2} />
    </div>
  );
}

type BlogListingFirst = Awaited<ReturnType<typeof loadBlogListing>>['firstPost'];

export default async function BlogPage({ searchParams }: BlogPageProps) {
  // 요청 시 렌더: 빌드(백엔드 없음)에서 조회하지 않게 한다 (프론트엔드 §4 "빌드와 데이터").
  await connection();
  const query = parseBlogQuery(await searchParams);
  const [tagName] = await Promise.all([
    resolveTagName(query.tag),
    assertCategoryExists(query.category),
  ]);

  // 서버가 이 페이지를 그릴 때마다 새 값. 라우터 이동·같은 주소 재요청처럼 서버가 다시 그리면 LoadMoreGrid가 새로 만들어져
  // 서버 값(글 내용 포함)을 그대로 쓴다. props 값을 비교해 상태를 버릴지 추측하지 않는다. Load More의 replaceState는 서버 렌더가 아니라 상태가 유지된다.
  // connection() 뒤라 요청 시 렌더되므로 캐시된 값이 아니다.
  const renderId = crypto.randomUUID();
  const filter = filterOf(query);
  const listing = await loadBlogListing(query.page, filter);

  return (
    <Container className="pt-6 pb-16">
      <FilterTransitionProvider>
        <PageInfo title={tagName ? `#${tagName}` : 'Blog'} breadcrumb={breadcrumbOf(tagName)} />
        <FilterLinks>
          <FilterChips query={query} tagName={tagName} />
        </FilterLinks>
        <PendingListSlot>
          <Overlay query={query} fallback={listing.firstPost} />
          {listing.posts.length === 0 ? (
            <EmptyState />
          ) : (
            // 필터가 바뀌면 다른 목록이라 key로 상태를 새로 시작한다(클라이언트 이동 시 이전 필터의 글이 남지 않게)
            <LoadMoreGrid
              key={`${renderId}|${query.tag ?? ''}|${query.category ?? ''}`}
              initialPosts={listing.posts}
              initialPage={listing.page}
              totalPages={listing.totalPages}
              filter={filter}
            />
          )}
        </PendingListSlot>
      </FilterTransitionProvider>
    </Container>
  );
}
