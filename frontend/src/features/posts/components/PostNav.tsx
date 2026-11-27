import Link from 'next/link';
import type { components } from '@/generated/api-types';
import { cn } from '@/lib/cn';

type PostLinkDto = components['schemas']['PostLinkDto'];

type PostNavProps = {
  /** 더 오래된 글 */
  prev: PostLinkDto | null;
  /** 더 최근 글 */
  next: PostLinkDto | null;
  className?: string;
};

const CARD =
  'border-border bg-surface flex flex-col gap-2 rounded-lg border p-5 hover:[box-shadow:var(--shadow-md)]';

function PostNavCard({
  post,
  label,
  className,
}: {
  post: PostLinkDto;
  label: string;
  className?: string;
}) {
  // 카드 전체가 링크다. 이름은 라벨 + 제목이 된다.
  return (
    <Link href={`/blog/${post.slug}`} className={cn(CARD, className)}>
      <span className="text-b5 text-muted">{label}</span>
      <span className="text-b4-medium text-strong wrap-anywhere">{post.title}</span>
    </Link>
  );
}

/**
 * 이전/다음 글 카드 (UI §7.3). 2열(모바일 1열), 오래된 글이 왼쪽이다.
 * 한쪽이 없어도 다른 쪽은 제 칸(next는 오른쪽 칸)에 둔다. 둘 다 없으면 그리지 않는다.
 */
export function PostNav({ prev, next, className }: PostNavProps) {
  if (!prev && !next) return null;
  return (
    <nav
      aria-label="이전·다음 글"
      className={cn('grid grid-cols-1 gap-4 tablet:grid-cols-2 tablet:gap-5', className)}
    >
      {prev && <PostNavCard post={prev} label="이전 글" />}
      {next && (
        <PostNavCard
          post={next}
          label="다음 글"
          className="tablet:col-start-2 tablet:items-end tablet:text-right"
        />
      )}
    </nav>
  );
}
