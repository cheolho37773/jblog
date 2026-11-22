import { cva, type VariantProps } from 'class-variance-authority';
import Link from 'next/link';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const badgeVariants = cva('text-b5-medium inline-block rounded-md', {
  variants: {
    variant: {
      solid: 'bg-primary-strong text-on-primary',
      soft: 'bg-primary-soft text-primary-text',
    },
    size: {
      md: 'px-2.5 py-1',
      lg: 'px-3 py-1.5',
    },
  },
  defaultVariants: { variant: 'solid', size: 'md' },
});

type BadgeProps = VariantProps<typeof badgeVariants> &
  Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'> & {
    href?: string;
    className?: string;
    children: ReactNode;
  };

// 링크일 때 보이는 크기는 그대로 두고 44x44 클릭 영역을 가운데 기준으로 넓힌다 (UI §4.2)
const LINK_HIT_AREA =
  "relative after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";

export function Badge({ variant, size, href, className, children, ...props }: BadgeProps) {
  const classes = cn(badgeVariants({ variant, size }), className);
  if (href) {
    return (
      <Link href={href} className={cn(classes, LINK_HIT_AREA)} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
