import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// globals.css의 타이포 유틸(text-h1 등). 알려주지 않으면 tailwind-merge가 text-white 같은 색 유틸과
// 충돌한다고 보고 하나를 지워 버린다.
const TYPOGRAPHY_UTILITIES = [
  'h1',
  'h3',
  'h3-bold',
  'h4',
  'b2',
  'b3',
  'b4',
  'b4-medium',
  'b5',
  'b5-medium',
  'article',
  'quote',
  'footer-logo',
  'footer-title',
  'footer-body',
  'footer-label',
  'display-hero',
  'display-section',
  'eyebrow',
  'intro',
  'exp-title',
  'exp-body',
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: TYPOGRAPHY_UTILITIES }],
    },
  },
});

/** 조건부 클래스를 합치고, 충돌하는 Tailwind 유틸은 뒤에 온 것만 남긴다. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
