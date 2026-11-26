import Link from 'next/link';
import { useId } from 'react';
import { AuthorMeta } from './AuthorMeta';
import { Badge } from '@/components/ui/Badge';
import type { components } from '@/generated/api-types';

type PostSummaryDto = components['schemas']['PostSummaryDto'];

type PostCardGridProps = {
  post: PostSummaryDto;
  headingLevel?: 2 | 3;
};

// 호버 모션은 움직임 줄이기 설정이면 끈다. 그림자만 남는다 (UI §5.4, §8)
const CARD_LINK =
  'group border-border bg-surface flex flex-col gap-4 rounded-lg border p-4 hover:[box-shadow:var(--shadow-md)] motion-safe:hover:[transform:translateY(-4px)]';
const THUMBNAIL_BOX = 'bg-bg-subtle aspect-[3/2] overflow-hidden rounded-md';

/** 글 목록 카드 (UI §5.4). 카드 전체가 글 링크 하나이고, 카테고리 배지는 링크가 아니다. */
export function PostCardGrid({ post, headingLevel = 3 }: PostCardGridProps) {
  const Heading = `h${headingLevel}` as const;
  // 링크 안에 배지·날짜도 있어, 접근 가능한 이름을 제목으로 고정한다
  const titleId = useId();
  return (
    <article>
      <Link href={`/blog/${post.slug}`} aria-labelledby={titleId} className={CARD_LINK}>
        <div className={THUMBNAIL_BOX}>
          {post.coverImageUrl && (
            // /uploads 이미지는 최적화 대상이 아니라 일반 img를 쓴다 (프론트엔드 §5.3). 제목이 링크 이름이라 장식이다.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.coverImageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full rounded-md object-cover motion-safe:group-hover:[transform:scale(1.03)]"
            />
          )}
        </div>
        <div className="flex flex-col gap-5 p-2">
          <div className="flex flex-col items-start gap-4">
            {post.category && <Badge variant="soft">{post.category.name}</Badge>}
            <Heading id={titleId} className="text-h3 text-strong line-clamp-3 wrap-anywhere">
              {post.title}
            </Heading>
          </div>
          <AuthorMeta publishedAt={post.publishedAt} readingMinutes={post.readingMinutes} />
        </div>
      </Link>
    </article>
  );
}
