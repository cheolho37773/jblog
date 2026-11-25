import type { ComponentProps } from 'react';

// 프로토콜이 있는 http(s) 주소와 프로토콜 상대 주소(//host)는 다른 오리진으로 본다.
// `/…`·`#…`·상대 경로·mailto:는 이 사이트 안(또는 새 탭이 필요 없는 동작)이라 그대로 둔다.
const EXTERNAL_URL = /^(?:https?:)?\/\//i;

export const isExternalHref = (href: string | undefined): href is string =>
  href !== undefined && EXTERNAL_URL.test(href);

/** 본문 링크. 외부 링크만 새 탭으로 열고 opener·referrer를 끊는다 (프론트엔드 §5.3). */
export function MdLink({ href, children, ...props }: ComponentProps<'a'>) {
  if (!isExternalHref(href)) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  );
}
