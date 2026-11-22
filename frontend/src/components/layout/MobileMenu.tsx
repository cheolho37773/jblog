'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useId, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { ICON_BUTTON_CLASS } from './icon-button';
import { NavLinks } from './NavLinks';
import { useModalDialog } from './useModalDialog';

const LAPTOP_MIN_WIDTH = 1024; // 이 폭부터 메뉴 링크가 Navbar에 직접 보인다

/** < 1024px의 햄버거 버튼과 오른쪽 드로어 메뉴 (프론트엔드 §8). 네이티브 <dialog>를 모달로 연다. */
export function MobileMenu({ className }: { className?: string }) {
  const menuId = useId();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // 열린 때의 경로를 기억하면 경로가 바뀔 때 자동으로 닫힌 상태가 된다.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const isOpen = openedAt === pathname;

  const close = useCallback(() => setOpenedAt(null), []);
  useModalDialog(dialogRef, {
    isOpen,
    closeAtMinWidth: LAPTOP_MIN_WIDTH,
    onRequestClose: close,
  });

  // ESC·닫기·링크 클릭 어느 쪽으로 닫혀도 포커스를 햄버거로 돌려준다.
  function handleClosed() {
    close();
    triggerRef.current?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="메뉴 열기"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setOpenedAt(pathname)}
        className={cn(ICON_BUTTON_CLASS, className)}
      >
        <Icon name="menu" size={24} />
      </button>
      {/* 닫힌 dialog의 링크까지 visibility로 숨겨 Tab·보조 기술에서 확실히 빠지게 한다 */}
      <dialog
        ref={dialogRef}
        id={menuId}
        aria-label="메뉴"
        onClose={handleClosed}
        className="bg-bg text-body border-border backdrop:bg-overlay invisible fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-72 max-w-[85vw] flex-col border-l p-4 open:visible open:flex"
      >
        <button
          type="button"
          aria-label="메뉴 닫기"
          onClick={close}
          className={cn(ICON_BUTTON_CLASS, 'self-end')}
        >
          <Icon name="x" size={24} />
        </button>
        <NavLinks
          aria-label="모바일 메뉴"
          listClassName="flex-col"
          linkClassName="w-full"
          onNavigate={close}
        />
      </dialog>
    </>
  );
}
