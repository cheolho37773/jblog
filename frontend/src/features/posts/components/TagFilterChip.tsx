import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';

/** 태그 필터 상태에서 카테고리 칩 대신 보이는 "필터 해제" 칩. 누르면 /blog로 돌아간다. */
export function TagFilterChip({ tagName }: { tagName: string }) {
  return (
    <div className="flex">
      <Badge href="/blog" variant="solid" size="lg" className="inline-flex items-center gap-2">
        #{tagName} 필터 해제
        <Icon name="x" size={14} />
      </Badge>
    </div>
  );
}
