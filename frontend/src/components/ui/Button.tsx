'use client';

// asChild가 자식에 이벤트 핸들러를 합성하므로 클라이언트 컴포넌트다 (서버 컴포넌트는 핸들러를 넘길 수 없다).
import { cva, type VariantProps } from 'class-variance-authority';
import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
} from 'react';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'text-b4-medium inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
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

type ChildProps = {
  className?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
};

/** 자식 핸들러를 먼저, 부모 핸들러를 다음에 호출한다. */
function composeHandlers<E>(
  childHandler: ((event: E) => void) | undefined,
  parentHandler: ((event: E) => void) | undefined,
) {
  return (event: E) => {
    childHandler?.(event);
    parentHandler?.(event);
  };
}

export function Button({
  variant,
  asChild = false,
  className,
  type = 'button',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant }), className);

  if (asChild && isValidElement<ChildProps>(children)) {
    const child = children as ReactElement<ChildProps>;
    const { onClick, onKeyDown, ...passThrough } = props as ChildProps & Record<string, unknown>;
    // <a>에는 disabled 속성이 없다. aria-disabled와 탭 순서 제외, 클릭·Enter 기본 동작 차단으로 대신한다.
    const blockWhenDisabled = (event: { preventDefault: () => void }) => event.preventDefault();

    return cloneElement(child, {
      ...passThrough,
      className: cn(classes, child.props.className),
      ...(disabled
        ? {
            'aria-disabled': true,
            tabIndex: -1,
            onClick: blockWhenDisabled,
            onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
              if (event.key === 'Enter') event.preventDefault();
            },
          }
        : {
            onClick: composeHandlers(child.props.onClick, onClick),
            onKeyDown: composeHandlers(child.props.onKeyDown, onKeyDown),
          }),
    });
  }

  return (
    <button type={type} className={classes} disabled={disabled} {...props}>
      {children}
    </button>
  );
}
