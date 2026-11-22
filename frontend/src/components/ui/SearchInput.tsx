import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

const DEFAULT_LABEL = '검색';

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function SearchInput({
  className,
  'aria-label': ariaLabel = DEFAULT_LABEL,
  ...props
}: SearchInputProps) {
  return (
    // label로 감싸 입력 상자 위아래 4px도 눌러서 포커스되게 한다 (히트 영역 44px, 시각 36px 유지. UI §4.2)
    <label className="relative -my-1 block py-1">
      <input
        type="search"
        role="searchbox"
        aria-label={ariaLabel}
        className={cn(
          'text-b5 bg-input-bg text-body placeholder:text-input-placeholder w-full rounded-sm py-2 pr-10 pl-4',
          className,
        )}
        {...props}
      />
      <Icon
        name="search"
        className="text-muted pointer-events-none absolute top-1/2 right-2 -translate-y-1/2"
      />
    </label>
  );
}
