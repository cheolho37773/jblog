import { Noto_Serif_KR } from 'next/font/google';

// 글 상세 본문의 한글 서체 (프론트엔드 §5.1-a). 루트 layout이 아니라 Prose(본문 컨테이너)에서만 불러온다:
// 이 모듈을 import하는 페이지에서만 @font-face가 생겨 다른 페이지는 내려받지 않는다.
// 한글은 유니코드 범위별 조각으로 나뉘어 실제 쓰인 글자 범위만 받는다. preload는 라틴만 한다(한글 조각은 수십 개).
export const notoSerifKr = Noto_Serif_KR({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  // 폰트가 로딩되기 전 fallback의 글자 크기를 맞춰 로딩 전후 레이아웃 흔들림을 줄인다.
  adjustFontFallback: true,
  variable: '--font-noto-serif-kr',
});
