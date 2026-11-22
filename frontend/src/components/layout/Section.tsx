import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type SectionProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title?: string;
  children: ReactNode;
};

/**
 * 섹션 사이 세로 간격 (UI §4.1: 데스크톱 80px, 모바일은 40px로 줄임).
 * 위쪽 간격만 가진다. 위·아래를 모두 주면 연속한 두 Section 사이에서 합쳐져 160px이 된다.
 * 그래서 페이지의 첫 Section은 위쪽(Navbar와의 간격)이 생기고, 마지막 Section 아래는 Footer 자신의 패딩이 맡는다.
 */
export function Section({ title, className, children, ...props }: SectionProps) {
  return (
    <section className={cn('pt-10 tablet:pt-20', className)} {...props}>
      {title && <h2 className="text-h3-bold text-strong mb-8">{title}</h2>}
      {children}
    </section>
  );
}
