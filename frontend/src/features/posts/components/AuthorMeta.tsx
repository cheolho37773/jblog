import { cn } from '@/lib/cn';
import { formatPublishedDate, formatReadingTime } from '../lib/format-date';

type AuthorMetaProps = {
  publishedAt: string;
  readingMinutes: number;
  /** md: 카드(16/24, 간격 20), sm: 상세 페이지(14/20, 간격 24) — UI §5.3 */
  size?: 'md' | 'sm';
  /** 이미지 위에 올릴 때 글자색을 on-primary(흰색)로 바꾼다 */
  onImage?: boolean;
};

const SIZE_CLASS = {
  md: 'text-b4 gap-5',
  sm: 'text-b5 gap-6',
} as const;

// 작성자가 1명이라 아바타·이름 자리는 날짜 + 읽는 시간으로 대신한다 (UI §5.3)
export function AuthorMeta({ publishedAt, readingMinutes, size = 'md', onImage }: AuthorMetaProps) {
  return (
    <div className={cn('flex', SIZE_CLASS[size], onImage ? 'text-on-primary' : 'text-muted')}>
      <time dateTime={publishedAt}>{formatPublishedDate(publishedAt)}</time>
      <span>{formatReadingTime(readingMinutes)}</span>
    </div>
  );
}
