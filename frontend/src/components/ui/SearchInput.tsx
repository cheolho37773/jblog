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
    <div className="relative">
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
    </div>
  );
}
