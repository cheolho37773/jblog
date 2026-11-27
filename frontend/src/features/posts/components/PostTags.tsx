import { Badge } from '@/components/ui/Badge';
import type { components } from '@/generated/api-types';

type TagRefDto = components['schemas']['TagRefDto'];

/** 글 태그 목록 (UI §7.3). 각 태그는 그 태그의 글 목록으로 가는 soft Badge다. 태그가 없으면 그리지 않는다. */
export function PostTags({ tags, className }: { tags: TagRefDto[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <nav aria-label="태그" className={className}>
      <ul className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li key={tag.slug}>
            <Badge variant="soft" href={`/blog?tag=${encodeURIComponent(tag.slug)}`}>
              {tag.name}
            </Badge>
          </li>
        ))}
      </ul>
    </nav>
  );
}
