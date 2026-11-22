import {
  JetBrains_Mono,
  Plus_Jakarta_Sans,
  Poppins,
  Source_Serif_4,
  Work_Sans,
} from 'next/font/google';
import localFont from 'next/font/local';

// 프론트엔드 §2: 필요한 weight만 로드하고 CSS 변수로 노출한다 (Tailwind @theme가 참조).
// Noto Serif KR(글·프로젝트 상세 전용)은 M2에서 추가한다.
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
  weight: ['400', '600', '700'],
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

// 한글 fallback (프론트엔드 §5.1-a). 영문 폰트에 없는 글자(한글)가 나올 때만 내려받도록 preload를 끈다.
// 출처: github.com/orioncactus/pretendard v1.3.9 (web/variable/woff2), 라이선스 OFL 1.1: public/fonts/Pretendard-OFL-LICENSE.txt
const pretendard = localFont({
  src: '../../public/fonts/PretendardVariable.woff2',
  weight: '45 920',
  variable: '--font-pretendard',
  display: 'swap',
  preload: false,
});

export const fontVariableClassNames = [
  workSans,
  sourceSerif,
  plusJakarta,
  poppins,
  jetbrainsMono,
  pretendard,
]
  .map((font) => font.variable)
  .join(' ');
