import {
  JetBrains_Mono,
  Plus_Jakarta_Sans,
  Poppins,
  Source_Serif_4,
  Work_Sans,
} from 'next/font/google';

// 프론트엔드 §2: 필요한 weight만 로드하고 CSS 변수로 노출한다 (Tailwind @theme가 참조).
// Noto Serif KR(상세 페이지)과 Pretendard(로컬 파일)는 FE-02·FE-05에서 추가한다.
const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-work-sans',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-source-serif',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-plus-jakarta',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-jetbrains-mono',
});

export const fontVariableClassNames = [workSans, sourceSerif, plusJakarta, poppins, jetbrainsMono]
  .map((font) => font.variable)
  .join(' ');
