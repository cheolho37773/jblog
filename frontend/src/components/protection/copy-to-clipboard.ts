'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** 복사 결과 표시(체크 아이콘·안내 문구)를 유지하는 시간 (04 §2.2 ③) */
const FEEDBACK_MS = 2000;

export type CopyStatus = 'idle' | 'copied' | 'failed';

/**
 * 클립보드에 쓴다. 권한 거부·비보안 문맥(navigator.clipboard 없음)이어도 던지지 않고 false를 돌려준다.
 * writeText는 copy 이벤트를 내지 않아 CopyGuard와 충돌하지 않는다.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** 코드·링크·주소 복사 버튼이 함께 쓰는 상태. 성공·실패 표시는 2초 뒤 idle로 돌아온다. */
export function useCopyFeedback(): { status: CopyStatus; copy: (text: string) => Promise<void> } {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const copy = useCallback(async (text: string) => {
    const copied = await copyToClipboard(text);
    clearTimeout(resetTimer.current);
    setStatus(copied ? 'copied' : 'failed');
    resetTimer.current = setTimeout(() => setStatus('idle'), FEEDBACK_MS);
  }, []);

  return { status, copy };
}
