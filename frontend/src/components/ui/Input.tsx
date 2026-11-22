import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** 있으면 오류 상태: aria-invalid와 오류 문구를 설명으로 연결한다. */
  error?: string;
};

export function Input({
  label,
  error,
  className,
  id,
  'aria-describedby': describedBy,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const descriptionIds = [describedBy, error ? errorId : undefined].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-b5-medium text-strong">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={descriptionIds || undefined}
        className={cn(
          'text-b4 bg-bg text-body placeholder:text-input-placeholder rounded-md border px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-danger' : 'border-border-strong',
          className,
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-b5 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
