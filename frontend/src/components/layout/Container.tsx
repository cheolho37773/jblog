import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ContainerProps = {
  as?: 'div' | 'section' | 'main' | 'header' | 'footer' | 'nav';
  className?: string;
  children: ReactNode;
};

/** 페이지 가로 폭(최대 1216px)과 좌우 여백을 맞추는 래퍼 (UI §4.2, `container-site` 유틸). */
export function Container({ as: Tag = 'div', className, children }: ContainerProps) {
  return <Tag className={cn('container-site', className)}>{children}</Tag>;
}
