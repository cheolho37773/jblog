import { cva, type VariantProps } from 'class-variance-authority';
import { cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactElement } from 'react';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'text-b4-medium inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary-strong text-on-primary rounded-md px-5 py-3',
        outline: 'border-border-strong text-body rounded-md border px-5 py-3',
        // 터치 타겟 44px: 보이는 크기는 32px, 클릭 영역만 after로 넓힌다 (UI §4.2)
        icon: 'bg-icon-button-bg text-on-primary relative rounded-md p-2 after:absolute after:-inset-1.5 after:content-[""]',
        pillSolid: 'bg-strong text-bg h-13 rounded-full px-6',
        pillOutline: 'border-strong text-strong h-13 rounded-full border-2 px-6',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** true이면 자식 요소(예: 링크)에 버튼 스타일을 입힌다. 자식은 요소 하나여야 한다. */
    asChild?: boolean;
  };

export function Button({
  variant,
  asChild = false,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant }), className);

  if (asChild && isValidElement<{ className?: string }>(children)) {
    const child = children as ReactElement<{ className?: string }>;
    return cloneElement(child, { className: cn(classes, child.props.className) });
  }

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}
