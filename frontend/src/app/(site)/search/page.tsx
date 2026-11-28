import type { Metadata } from 'next';
import { Container } from '@/components/layout/Container';
import { PageInfo } from '@/components/layout/PageInfo';
import { CategoryChips } from '@/features/posts/components/CategoryChips';
import { PostCardGrid } from '@/features/posts/components/PostCardGrid';
import { POST_GRID_CLASS } from '@/features/posts/components/post-grid-class';
import { loadCategories } from '@/features/posts/lib/blog-list-api';
import { parseSearchQuery } from '@/features/posts/lib/search-query';
import { SEARCH_RESULT_LIMIT, searchPosts } from '@/features/posts/lib/search-api';

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const HOME_CRUMB = { label: 'Home', href: '/' };

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q, isSearchable } = parseSearchQuery((await searchParams).q);
  return {
    title: isSearchable ? `Search: ${q}` : 'Search',
    // 검색 결과는 색인하지 않되 링크는 따라가게 한다
    robots: { index: false, follow: true },
  };
}

function Notice({ children }: { children: string }) {
  return <p className="text-b4 text-muted py-16 text-center">{children}</p>;
}

async function NoResults({ q }: { q: string }) {
  const categories = await loadCategories();
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <p className="text-h4 text-strong">{`'${q}'에 대한 검색 결과가 없습니다.`}</p>
      {/* 칩 줄이 가로 스크롤되도록 가운데 정렬 flex 안에서도 폭을 부모에 맞춘다 */}
      <div className="w-full">
        <CategoryChips
          categories={categories.filter((item) => item.postCount > 0)}
          activeSlug={null}
        />
      </div>
    </div>
  );
}

async function Results({ q }: { q: string }) {
  const { items, totalItems } = await searchPosts(q);
  return (
    <>
      <p className="text-b4 text-muted mb-6 text-center">{`검색 결과 ${totalItems}개`}</p>
      {items.length === 0 ? (
        <NoResults q={q} />
      ) : (
        <>
          <ul aria-label="검색 결과" className={POST_GRID_CLASS}>
            {items.map((post) => (
              <li key={post.slug}>
                <PostCardGrid post={post} headingLevel={3} />
              </li>
            ))}
          </ul>
          {totalItems > SEARCH_RESULT_LIMIT && (
            <p className="text-b4 text-muted mt-8 text-center">
              {`상위 ${SEARCH_RESULT_LIMIT}개만 보여 줍니다. 검색어를 더 구체적으로 입력해 보세요.`}
            </p>
          )}
        </>
      )}
    </>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, isSearchable } = parseSearchQuery((await searchParams).q);

  return (
    <Container className="pt-6 pb-16">
      <PageInfo
        title={isSearchable ? `Search: ${q}` : 'Search'}
        breadcrumb={[HOME_CRUMB, { label: 'Search' }]}
      />
      {isSearchable ? <Results q={q} /> : <Notice>검색어를 2자 이상 입력해 주세요.</Notice>}
    </Container>
  );
}
