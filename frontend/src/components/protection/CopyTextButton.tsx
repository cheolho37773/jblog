'use client';

import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCopyFeedback } from './copy-to-clipboard';

export const COPY_FAILED_MESSAGE = '복사하지 못했습니다';

type CopyTextButtonProps = {
  /** 복사할 글. 이것만 클립보드에 들어간다. */
  text: string;
  /** 버튼의 접근 가능한 이름이자 보이는 글자 (예: "링크 복사") */
  label: string;
  /** 복사에 성공했을 때 알릴 문구 */
  successMessage: string;
  className?: string;
};

/** 링크 복사·주소 복사 버튼. 결과는 같은 `role="status"` 영역에 글자로 알린다. */
export function CopyTextButton({ text, label, successMessage, className }: CopyTextButtonProps) {
  const { status, copy } = useCopyFeedback();
  const message = { idle: '', copied: successMessage, failed: COPY_FAILED_MESSAGE }[status];

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        data-copy-state={status}
        onClick={() => void copy(text)}
        className={cn(
          'text-b5-medium text-muted hover:text-strong border-border-strong relative inline-flex min-h-8 items-center gap-1.5 rounded-md border px-3 after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[""]',
          className,
        )}
      >
        {status === 'copied' ? (
          <Check aria-hidden="true" size={16} />
        ) : (
          <Copy aria-hidden="true" size={16} />
        )}
        {label}
      </button>
      <span role="status" aria-live="polite" className="text-b5 text-muted">
        {message}
      </span>
    </span>
  );
}
