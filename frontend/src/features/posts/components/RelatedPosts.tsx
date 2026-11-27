import { useId } from 'react';
import type { components } from '@/generated/api-types';
import { PostCardGrid } from './PostCardGrid';
import { POST_GRID_CLASS } from './post-grid-class';

type PostSummaryDto = components['schemas']['PostSummaryDto'];

/** 관련 글 최대 3개 (UI §7.3). 섹션 제목 → 그리드 32 (UI §4.1). 없으면 그리지 않는다. */
export function RelatedPosts({
  posts,
  className,
}: {
  posts: PostSummaryDto[];
  className?: string;
}) {
  const titleId = useId();
  if (posts.length === 0) return null;
  return (
    <section data-testid="related-posts" aria-labelledby={titleId} className={className}>
      <h2 id={titleId} className="text-h3-bold text-strong mb-8">
        관련 글
      </h2>
      <ul className={POST_GRID_CLASS}>
        {posts.map((post) => (
          <li key={post.slug}>
            <PostCardGrid post={post} headingLevel={3} />
          </li>
        ))}
      </ul>
    </section>
  );
}
