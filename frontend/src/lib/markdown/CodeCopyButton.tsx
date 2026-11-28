'use client';

import { Check, Copy } from 'lucide-react';
import type { MouseEvent } from 'react';
import { COPY_FAILED_MESSAGE } from '@/components/protection/CopyTextButton';
import { useCopyFeedback } from '@/components/protection/copy-to-clipboard';

const COPIED_MESSAGE = '복사됨';

/**
 * 코드 블록 복사 버튼 (04 §2.2 ③). 코드 원문은 같은 블록에서 렌더된 `pre`의 텍스트로 얻는다(줄바꿈 유지).
 * 서버에서 만든 pre 안의 글자를 그대로 읽으므로 원문을 클라이언트로 따로 넘기지 않는다.
 */
export function CodeCopyButton() {
  const { status, copy } = useCopyFeedback();
  const message = { idle: '', copied: COPIED_MESSAGE, failed: COPY_FAILED_MESSAGE }[status];

  function copyCode(event: MouseEvent<HTMLButtonElement>) {
    const code = event.currentTarget.closest('.code-block-body')?.querySelector('pre')?.textContent;
    if (code == null) return;
    void copy(code);
  }

  return (
    <>
      <button
        type="button"
        className="code-block-copy"
        aria-label="코드 복사"
        data-copy-state={status}
        onClick={copyCode}
      >
        {status === 'copied' ? (
          <Check aria-hidden="true" size={16} />
        ) : (
          <Copy aria-hidden="true" size={16} />
        )}
      </button>
      <span
        role="status"
        aria-live="polite"
        className="text-b5 text-muted absolute top-2.5 right-12"
      >
        {message}
      </span>
    </>
  );
}
