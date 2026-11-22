'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useId, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { ICON_BUTTON_CLASS } from './icon-button';
import { SearchBox } from './SearchBox';
import { useModalDialog } from './useModalDialog';

const TABLET_MIN_WIDTH = 768; // 이 폭부터 검색 입력창이 Navbar에 직접 보인다

/** < 768px의 검색 아이콘 버튼과 전체 폭 검색 오버레이 (UI §4.2). */
export function MobileSearch({ className }: { className?: string }) {
  const overlayId = useId();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const isOpen = openedAt === pathname;

  const close = useCallback(() => setOpenedAt(null), []);
  useModalDialog(dialogRef, {
    isOpen,
    closeAtMinWidth: TABLET_MIN_WIDTH,
    onRequestClose: close,
  });

  function handleClosed() {
    close();
    triggerRef.current?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="검색 열기"
        aria-expanded={isOpen}
        aria-controls={overlayId}
        onClick={() => setOpenedAt(pathname)}
        className={cn(ICON_BUTTON_CLASS, className)}
      >
        <Icon name="search" size={24} />
      </button>
      <dialog
        ref={dialogRef}
        id={overlayId}
        aria-label="검색"
        onClose={handleClosed}
        className="bg-bg border-border backdrop:bg-overlay invisible fixed top-0 right-0 left-0 m-0 w-full max-w-none border-b p-4 open:visible open:block"
      >
        {/* 입력창을 열 때만 만들어 닫힌 상태에서는 검색창이 둘로 보이지 않게 한다. 첫 포커스 대상이 입력창이다. */}
        {isOpen && (
          <div className="flex items-center gap-2">
            <SearchBox className="min-w-0 flex-1" inputClassName="py-3" onSearched={close} />
            <button
              type="button"
              aria-label="검색 닫기"
              onClick={close}
              className={ICON_BUTTON_CLASS}
            >
              <Icon name="x" size={24} />
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
