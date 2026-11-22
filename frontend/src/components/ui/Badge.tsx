import { cva, type VariantProps } from 'class-variance-authority';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const badgeVariants = cva('text-b5-medium inline-block rounded-md', {
  variants: {
    variant: {
      solid: 'bg-primary text-white',
      soft: 'bg-primary-soft text-primary',
    },
    size: {
      md: 'px-2.5 py-1',
      lg: 'px-3 py-1.5',
    },
  },
  defaultVariants: { variant: 'solid', size: 'md' },
});

type BadgeProps = VariantProps<typeof badgeVariants> & {
  href?: string;
  className?: string;
  children: ReactNode;
};

export function Badge({ variant, size, href, className, children }: BadgeProps) {
  const classes = cn(badgeVariants({ variant, size }), className);
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return <span className={classes}>{children}</span>;
}
