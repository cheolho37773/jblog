import Link from 'next/link';
import { useId } from 'react';
import { AuthorMeta } from './AuthorMeta';
import { CoverBackdrop } from './CoverBackdrop';
import { Badge } from '@/components/ui/Badge';
import type { components } from '@/generated/api-types';

type PostSummaryDto = components['schemas']['PostSummaryDto'];

type FeaturedHeroCardProps = {
  post: PostSummaryDto;
  headingLevel?: 1 | 2;
};

/**
 * Home 대표 글 카드 (UI §5.5). 데스크톱은 이미지 위에 플로팅 카드가 떠 있고(left 64·top 360),
 * 모바일은 카드가 이미지 아래로 48px 겹쳐 쌓인다 (UI §4.2). 이미지 아래로 64px 돌출하는 만큼 아래 여백을 둔다.
 * 데스크톱 패널은 흐름 배치다: 이미지(600) 위로 -240px 끌어올려 top 360에 놓는다. 이렇게 하면 긴 제목으로
 * 패널이 커져도 카드 높이가 함께 늘어나 다음 블록과 겹치지 않는다. 링크 min-height 664는 이미지 600 + 돌출 64다.
 */
export function FeaturedHeroCard({ post, headingLevel = 2 }: FeaturedHeroCardProps) {
  const Heading = `h${headingLevel}` as const;
  // 링크 안에 배지·날짜도 있어, 접근 가능한 이름을 제목으로 고정한다
  const titleId = useId();
  return (
    <article>
      <Link
        href={`/blog/${post.slug}`}
        aria-labelledby={titleId}
        className="relative block tablet:min-h-[664px] tablet:pb-16"
      >
        <div className="bg-icon-button-bg relative h-60 overflow-hidden rounded-lg tablet:h-[600px]">
          <CoverBackdrop src={post.coverImageUrl} />
        </div>
        <div className="border-border bg-surface relative mx-4 -mt-12 flex flex-col items-start gap-6 rounded-lg border p-6 [box-shadow:var(--shadow-md)] tablet:mt-[-240px] tablet:ml-16 tablet:w-[598px] tablet:p-10">
          {post.category && <Badge variant="solid">{post.category.name}</Badge>}
          <Heading id={titleId} className="text-h1 text-strong">
            {post.title}
          </Heading>
          <AuthorMeta publishedAt={post.publishedAt} readingMinutes={post.readingMinutes} />
        </div>
      </Link>
    </article>
  );
}
