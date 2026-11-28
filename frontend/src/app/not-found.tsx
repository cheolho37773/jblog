import { connection } from 'next/server';
import { NotFoundContent, notFoundMetadata } from './NotFoundContent';
import { SiteChrome } from './SiteChrome';

export const metadata = notFoundMetadata;

/**
 * 어느 라우트에도 맞지 않는 주소(예: /nope, /blog/a/b)의 404. 루트 layout 바로 아래라 (site)/layout이 없으므로
 * 같은 사이트 틀(SiteChrome)을 직접 둘러 Navbar·Footer가 있는 같은 화면을 그린다.
 * Footer 카테고리를 조회하므로 요청 시 렌더한다(빌드 중 API 호출 금지).
 */
export default async function NotFound() {
  await connection();
  return (
    <SiteChrome>
      <NotFoundContent />
    </SiteChrome>
  );
}
