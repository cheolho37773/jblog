import Link from 'next/link';
import { cn } from '@/lib/cn';

/** 글자 로고. 색이 토큰이라 테마에 따라 바뀐다. 높이 44px는 터치 타겟(UI §4.2)이다. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="jblog 홈"
      className={cn(
        'font-jakarta text-footer-logo text-strong inline-flex h-11 items-center',
        className,
      )}
    >
      jblog
    </Link>
  );
}
