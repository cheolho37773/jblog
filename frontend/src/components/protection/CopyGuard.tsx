'use client';

import { useEffect, useRef, useState } from 'react';
import {
  isCopyAllowed,
  isEditableContext,
  isInAllowSelect,
  shouldBlockShortcut,
} from './guard-rules';

const TOAST_MESSAGE = '콘텐츠 복사가 제한되어 있습니다';
/** 토스트를 보여 주는 시간. 보이는 동안에는 같은 토스트를 또 띄우지 않아 3초에 1번만 나온다. */
const TOAST_MS = 3000;

/**
 * 공개 사이트 복사 방지 (04 §2.2 ②). 이벤트는 document에 한 번만 등록하고 언마운트 시 해제한다.
 * 화면에는 차단 안내 토스트만 그린다. 영역은 항상 두어 스크린리더가 나중에 생긴 문구를 읽게 한다.
 */
export function CopyGuard() {
  const [toastVisible, setToastVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    function notifyBlocked() {
      if (hideTimer.current) return;
      setToastVisible(true);
      hideTimer.current = setTimeout(() => {
        hideTimer.current = undefined;
        setToastVisible(false);
      }, TOAST_MS);
    }

    function blockCopy(event: Event) {
      if (isCopyAllowed(event)) return;
      event.preventDefault();
      notifyBlocked();
    }

    function blockUnlessAllowed(event: Event) {
      if (isEditableContext(event) || isInAllowSelect(event)) return;
      event.preventDefault();
    }

    function blockAlways(event: Event) {
      event.preventDefault();
    }

    function blockShortcut(event: KeyboardEvent) {
      if (!shouldBlockShortcut(event)) return;
      event.preventDefault();
      notifyBlocked();
    }

    const listeners: [string, EventListener][] = [
      ['copy', blockCopy],
      ['cut', blockCopy],
      ['contextmenu', blockUnlessAllowed],
      ['selectstart', blockUnlessAllowed],
      ['dragstart', blockAlways],
      ['keydown', blockShortcut as EventListener],
    ];
    for (const [type, listener] of listeners) document.addEventListener(type, listener);

    return () => {
      for (const [type, listener] of listeners) document.removeEventListener(type, listener);
      clearTimeout(hideTimer.current);
      hideTimer.current = undefined;
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
    >
      {toastVisible && (
        <p className="bg-surface border-border text-strong text-b5 shadow-md rounded-md border px-4 py-3">
          {TOAST_MESSAGE}
        </p>
      )}
    </div>
  );
}
