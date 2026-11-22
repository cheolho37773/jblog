import { cn } from '@/lib/cn';

// Navbar의 아이콘 버튼(검색 열기·메뉴 열기·닫기). 44x44는 터치 타겟 최소 크기다 (UI §4.2).
export const ICON_BUTTON_CLASS = cn(
  'text-strong hover:text-primary-text inline-flex size-11 shrink-0 items-center justify-center rounded-md',
);
