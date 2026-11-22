import {
  ArrowUpRight,
  Mail,
  Menu,
  Moon,
  Search,
  Sun,
  X as XMark,
  type LucideIcon,
} from 'lucide-react';
import { siGithub, siInstagram, siX, siYoutube, type SimpleIcon } from 'simple-icons';
import { cn } from '@/lib/cn';

// 쓰는 아이콘만 등록해 번들에 전체 아이콘 세트가 들어가지 않게 한다. 새 아이콘은 여기에 추가한다.
const LUCIDE_ICONS: Record<string, LucideIcon> = {
  'arrow-up-right': ArrowUpRight,
  mail: Mail,
  menu: Menu,
  moon: Moon,
  search: Search,
  sun: Sun,
  x: XMark,
};

const SIMPLE_ICONS: Record<string, SimpleIcon> = {
  github: siGithub,
  instagram: siInstagram,
  x: siX,
  youtube: siYoutube,
};

type IconProps = {
  /** lucide 이름(예: `search`) 또는 simple-icons 슬러그(예: `github`). 둘 다 있으면 lucide가 우선. */
  name: string;
  /** 있으면 의미 아이콘(이름 제공), 없으면 장식(`aria-hidden`). */
  label?: string;
  size?: number;
  className?: string;
};

export function Icon({ name, label, size = 16, className }: IconProps) {
  const a11yProps = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  const LucideComponent = LUCIDE_ICONS[name];

  if (LucideComponent) {
    return <LucideComponent size={size} className={className} {...a11yProps} />;
  }

  const simple = SIMPLE_ICONS[name];
  if (!simple) throw new Error(`등록되지 않은 아이콘: ${name}`);

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={cn('shrink-0', className)}
      {...a11yProps}
    >
      <path d={simple.path} />
    </svg>
  );
}
