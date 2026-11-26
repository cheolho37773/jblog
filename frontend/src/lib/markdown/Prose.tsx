import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { notoSerifKr } from './fonts';
import './prose-jblog.css';

// next/font가 만든 글꼴 이름(따옴표 포함)에서 따옴표만 뺀다. 이름은 영문·숫자·밑줄뿐이라 따옴표 없이도 올바른 식별자다.
// (<style> 안의 글자는 React가 HTML 이스케이프하므로 따옴표를 그대로 두면 `&#x27;`가 되어 CSS가 깨진다.)
const notoSerifKrFamily = notoSerifKr.style.fontFamily.replaceAll("'", '');

/**
 * 글 본문 컨테이너. Markdown 렌더 결과(`renderMarkdown`)를 `.prose-jblog` 스타일로 감싼다.
 * 글 상세·프로젝트 상세·관리자 프리뷰만 쓴다(Noto Serif KR이 여기서만 로드된다).
 *
 * 폰트 변수를 :root에 건다: `--font-serif`(globals.css)가 이 변수를 참조하는데, 요소에만 걸면
 * body 아래에서 --font-serif를 풀어 쓰는 쪽(규칙 준수 검사의 probe 등)과 계산값이 어긋난다.
 */
export function Prose({ className, ...props }: ComponentProps<'div'>) {
  return (
    <>
      <style>{`:root{--font-noto-serif-kr:${notoSerifKrFamily};}`}</style>
      <div className={cn('prose-jblog', className)} {...props} />
    </>
  );
}
