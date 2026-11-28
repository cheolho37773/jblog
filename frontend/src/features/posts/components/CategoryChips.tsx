import { Badge } from '@/components/ui/Badge';
import type { components } from '@/generated/api-types';

type CategoryWithCountDto = components['schemas']['CategoryWithCountDto'];

type CategoryChipsProps = {
  categories: CategoryWithCountDto[];
  /** 선택된 카테고리 slug. 생략하면 All이 선택되고, null이면 아무것도 선택하지 않는다(검색 결과 없음 안내) */
  activeSlug?: string | null;
};

/**
 * 블로그 목록의 카테고리 필터 칩 (UI §7.2). 가로 스크롤, 줄바꿈 없음.
 * 세로 여백(py-2)은 칩의 44px 터치 영역과 포커스 링이 스크롤 영역에 잘리지 않게 하려는 것이다.
 */
export function CategoryChips({ categories, activeSlug }: CategoryChipsProps) {
  const chips = [
    { key: 'all', label: 'All', href: '/blog', active: activeSlug === undefined },
    ...categories.map((category) => ({
      key: category.slug,
      label: category.name,
      href: `/blog?category=${encodeURIComponent(category.slug)}`,
      active: category.slug === activeSlug,
    })),
  ];

  return (
    <nav aria-label="카테고리" className="overflow-x-auto py-2">
      <ul className="flex w-max gap-2 px-1">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Badge
              href={chip.href}
              variant={chip.active ? 'solid' : 'soft'}
              aria-current={chip.active ? 'page' : undefined}
              className="whitespace-nowrap"
            >
              {chip.label}
            </Badge>
          </li>
        ))}
      </ul>
    </nav>
  );
}
