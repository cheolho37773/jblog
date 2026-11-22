'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { SearchInput } from '@/components/ui/SearchInput';
import { cn } from '@/lib/cn';

type SearchBoxProps = {
  className?: string;
  inputClassName?: string;
  /** 검색어로 이동한 뒤 호출 (검색 오버레이를 닫는 데 쓴다) */
  onSearched?: () => void;
};

/** Enter로 `/search?q=`에 이동하는 검색 폼 (프론트엔드 §6). 빈 검색어는 무시한다. */
export function SearchBox({ className, inputClassName, onSearched }: SearchBoxProps) {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    if (!query) return;

    router.push(`/search?q=${encodeURIComponent(query)}`);
    onSearched?.();
  }

  return (
    <form role="search" onSubmit={handleSubmit} className={cn(className)}>
      <SearchInput name="q" placeholder="Search" className={inputClassName} />
    </form>
  );
}
