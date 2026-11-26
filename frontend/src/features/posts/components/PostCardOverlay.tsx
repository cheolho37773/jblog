import Link from 'next/link';
import { useId } from 'react';
import { AuthorMeta } from './AuthorMeta';
import { CoverBackdrop } from './CoverBackdrop';
import { Badge } from '@/components/ui/Badge';
import type { components } from '@/generated/api-types';

type PostSummaryDto = components['schemas']['PostSummaryDto'];

type PostCardOverlayProps = {
  post: PostSummaryDto;
  headingLevel?: 1 | 2;
};

/** 블로그 목록 맨 위 최신 글 카드 (UI §5.6). 모바일은 높이 320·padding 20 (UI §4.2). */
export function PostCardOverlay({ post, headingLevel = 2 }: PostCardOverlayProps) {
  const Heading = `h${headingLevel}` as const;
  // 링크 안에 배지·날짜도 있어, 접근 가능한 이름을 제목으로 고정한다
  const titleId = useId();
  // 카드가 overflow-hidden이라 기본 포커스 링(바깥 offset 2)은 잘린다. 같은 2px primary 링을 카드 안쪽으로 그린다 (UI §9).
  // 전역 :focus-visible 규칙이 레이어 밖이라 offset만 `!`로 덮어쓴다
  return (
    <article className="bg-icon-button-bg relative h-80 overflow-hidden rounded-lg tablet:h-[450px]">
      <CoverBackdrop src={post.coverImageUrl} />
      <Link
        href={`/blog/${post.slug}`}
        aria-labelledby={titleId}
        className="relative flex h-full flex-col focus-visible:outline-offset-[-4px]! items-start justify-end gap-4 p-5 tablet:p-10"
      >
        {post.category && <Badge variant="solid">{post.category.name}</Badge>}
        <Heading id={titleId} className="text-h1 text-on-primary max-w-[720px]">
          {post.title}
        </Heading>
        <AuthorMeta publishedAt={post.publishedAt} readingMinutes={post.readingMinutes} onImage />
      </Link>
    </article>
  );
}
