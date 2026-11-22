import { Container } from '@/components/layout/Container';
import { PageInfo } from '@/components/layout/PageInfo';

// 자리만 있는 임시 페이지다. Navbar 검색이 /search?q= 로 이동하는 경로가 있어야 클라이언트 이동이 404 요청 없이
// 동작하므로 둔다. 검색 결과는 M4 이후에 채운다.
export default function SearchPage() {
  return (
    <Container>
      <PageInfo title="검색" breadcrumb={[{ label: 'Home', href: '/' }, { label: '검색' }]} />
    </Container>
  );
}
