import Image from 'next/image';
import { cn } from '@/lib/cn';

const INITIAL_FONT_RATIO = 0.4;

type AvatarProps = {
  src?: string;
  alt: string;
  /** 28~80px (UI §3.6) */
  size?: number;
  className?: string;
};

export function Avatar({ src, alt, size = 36, className }: AvatarProps) {
  const rootClass = cn('inline-flex shrink-0 overflow-hidden rounded-full', className);
  const sizeStyle = { width: size, height: size };

  if (src) {
    // 아바타는 작아서 이미지 최적화(srcset)가 필요 없고, 출처가 바뀌어도 설정 없이 쓰도록 unoptimized로 둔다.
    return (
      <span className={rootClass} style={sizeStyle}>
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          unoptimized
          className="object-cover"
        />
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={alt}
      className={cn(
        rootClass,
        'items-center justify-center bg-primary-strong text-on-primary font-semibold',
      )}
      style={{ ...sizeStyle, fontSize: size * INITIAL_FONT_RATIO }}
    >
      <span aria-hidden="true">{alt.charAt(0).toUpperCase()}</span>
    </span>
  );
}
