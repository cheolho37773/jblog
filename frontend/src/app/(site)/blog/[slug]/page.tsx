import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Container } from '@/components/layout/Container';
import { Badge } from '@/components/ui/Badge';
import type { components } from '@/generated/api-types';
import { CopyLinkButton } from '@/features/posts/components/CopyLinkButton';
import { AuthorMeta } from '@/features/posts/components/AuthorMeta';
import { DesktopTableOfContents } from '@/features/posts/components/DesktopTableOfContents';
import { PostJsonLd } from '@/features/posts/components/PostJsonLd';
import { PostNav } from '@/features/posts/components/PostNav';
import { PostTags } from '@/features/posts/components/PostTags';
import { RelatedPosts } from '@/features/posts/components/RelatedPosts';
import { loadPostDetail } from '@/features/posts/lib/post-detail-api';
import { postAbsoluteUrl, siteOrigin } from '@/features/posts/lib/post-url';
import { buildPostMetadata } from '@/features/posts/lib/post-metadata';
import { cn } from '@/lib/cn';
import { env } from '@/lib/env';
import { extractHeadings, renderMarkdown } from '@/lib/markdown';
import { Prose } from '@/lib/markdown/Prose';

type InternalPostDto = components['schemas']['InternalPostDto'];

type PostPageProps = {
  params: Promise<{ slug: string }>;
};

// 본문 열: 폭 800 가운데, 좁으면 Container의 좌우 gutter를 뺀 화면 폭 (UI §4.2·§7.3).
const COLUMN = 'mx-auto w-full max-w-200';
// ≥1280: [빈 칸 | 본문 800 | 목차] 3칸으로 두어 본문은 화면 가운데에 그대로 있고 목차는 오른쪽 칸에 붙는다.
const BODY_ROW = 'desktop:grid desktop:grid-cols-[1fr_minmax(0,800px)_1fr]';
// 목차는 sticky Navbar(높이 100 + 테두리 1) 아래 32에 붙는다. 헤딩 scroll-margin-top(prose-jblog.css)과 같은 값이다.
const TOC_PLACEMENT =
  'desktop:col-start-3 desktop:row-start-1 sticky top-[133px] self-start justify-self-end';

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { post } = await loadPostDetail(slug);
  return buildPostMetadata(post);
}

function PostHeader({ post, canonicalUrl }: { post: InternalPostDto; canonicalUrl: string }) {
  return (
    <header className={cn(COLUMN, 'flex flex-col items-start')}>
      {post.category && (
        <Badge
          variant="solid"
          size="lg"
          href={`/blog?category=${encodeURIComponent(post.category.slug)}`}
          className="mb-4"
        >
          {post.category.name}
        </Badge>
      )}
      <h1 className="text-h1 text-strong wrap-anywhere">{post.title}</h1>
      {/* 메타 줄: 모바일은 링크 복사가 아래 줄로 내려가고, tablet 이상은 오른쪽에 붙는다 */}
      <div
        data-testid="post-meta"
        className="mt-5 flex w-full flex-col items-start gap-3 tablet:flex-row tablet:items-center tablet:justify-between"
      >
        <AuthorMeta publishedAt={post.publishedAt} readingMinutes={post.readingMinutes} size="sm" />
        {/* 한 줄일 때 버튼(32)이 메타 줄 높이(20)를 키우지 않게 위아래로 상쇄한다 */}
        <div className="tablet:-my-1.5">
          <CopyLinkButton url={canonicalUrl} />
        </div>
      </div>
    </header>
  );
}

function PostCover({ src }: { src: string }) {
  // 첫 화면의 큰 이미지라 lazy로 두지 않고 먼저 받는다. /uploads 이미지는 최적화 대상이 아니라 일반 img다 (프론트엔드 §5.3).
  // 제목이 바로 위에 있어 장식 이미지로 둔다.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      data-testid="post-cover"
      src={src}
      alt=""
      draggable={false}
      fetchPriority="high"
      className={cn(COLUMN, 'aspect-[800/462] rounded-lg object-cover')}
    />
  );
}

/**
 * 글 상세 (UI §7.3, 프론트엔드 §6.3). 내부 API 한 번으로 받은 원문을 서버에서 렌더한다.
 * 원문(contentMd)은 이 서버 컴포넌트 안에서만 쓰고 클라이언트 컴포넌트에는 렌더 결과·헤딩 목록만 넘긴다.
 */
export default async function PostPage({ params }: PostPageProps) {
  // 요청 시 렌더: 빌드(백엔드 없음)에서 조회하지 않게 한다 (프론트엔드 §4 "빌드와 데이터").
  await connection();
  const { slug } = await params;
  const { post, prev, next, related } = await loadPostDetail(slug);
  const siteUrl = env.public.NEXT_PUBLIC_SITE_URL;
  const headings = extractHeadings(post.contentMd);
  const content = await renderMarkdown(post.contentMd, { siteOrigin: siteOrigin(siteUrl) });

  return (
    <Container className="pt-8 pb-16">
      <PostJsonLd post={post} siteUrl={siteUrl} />
      <article className="flex flex-col gap-8">
        <PostHeader post={post} canonicalUrl={postAbsoluteUrl(post.slug, siteUrl)} />
        {post.coverImageUrl && <PostCover src={post.coverImageUrl} />}
        <div className={BODY_ROW}>
          <Prose
            data-testid="post-body"
            className={cn(COLUMN, 'desktop:col-start-2 desktop:row-start-1')}
          >
            {content}
          </Prose>
          <DesktopTableOfContents headings={headings} className={TOC_PLACEMENT} />
        </div>
        <PostTags tags={post.tags} className={COLUMN} />
        <PostNav prev={prev} next={next} className={COLUMN} />
        <RelatedPosts posts={related} className={COLUMN} />
      </article>
    </Container>
  );
}
