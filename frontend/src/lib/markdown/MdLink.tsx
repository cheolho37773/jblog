import type { ComponentProps } from 'react';

// 자리표시용 기준 주소. siteOrigin이 없을 때 상대 주소를 해석하는 데만 쓰고 비교에는 쓰지 않는다.
const FALLBACK_BASE = 'http://localhost';

/**
 * href가 siteOrigin과 다른 오리진인지 판정한다. 프로토콜 상대(`//host`)도 siteOrigin 기준으로 해석한다.
 * http(s)가 아닌 주소(mailto: 등)와 해석할 수 없는 주소는 새 탭이 필요 없으므로 내부로 둔다.
 * (잘못된 URL에 target을 붙이면 이동 동작이 불확실해져, 안전한 쪽인 무속성을 택한다.)
 */
export function isExternalHref(href: string | undefined, siteOrigin?: string): href is string {
  if (href === undefined) return false;
  try {
    const url = new URL(href, siteOrigin ?? FALLBACK_BASE);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    // siteOrigin을 모르면 기준이 없으므로, 명시적 호스트가 있는 주소(`http(s)://`·`//`)만 외부로 본다.
    if (siteOrigin === undefined) return /^(?:https?:)?\/\//i.test(href);
    return url.origin !== new URL(siteOrigin).origin;
  } catch {
    return false;
  }
}

type MdLinkProps = ComponentProps<'a'> & { siteOrigin?: string };

/** 본문 링크. 외부 링크만 새 탭으로 열고 opener·referrer를 끊는다 (프론트엔드 §5.3). */
export function MdLink({ href, children, siteOrigin, ...props }: MdLinkProps) {
  if (!isExternalHref(href, siteOrigin)) {
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
