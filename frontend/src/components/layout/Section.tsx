import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type SectionProps = {
  title?: string;
  className?: string;
  children: ReactNode;
};

/** 섹션 사이 세로 간격(데스크톱 80px, 작은 화면은 줄임)과 선택적 제목 (UI §4.1). */
export function Section({ title, className, children }: SectionProps) {
  return (
    <section className={cn('py-10 tablet:py-20', className)}>
      {title && <h2 className="text-h3-bold text-strong mb-8">{title}</h2>}
      {children}
    </section>
  );
}
