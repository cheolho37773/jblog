import { NotFoundContent, notFoundMetadata } from '../NotFoundContent';

export const metadata = notFoundMetadata;

/**
 * (site) 페이지가 notFound()를 부를 때(없는 글·태그·카테고리)의 404. (site)/layout 안이라 Navbar·Footer가 함께 그려진다.
 * 어느 라우트에도 맞지 않는 주소는 app/not-found.tsx가 같은 화면을 그린다.
 */
export default function SiteNotFound() {
  return <NotFoundContent />;
}
