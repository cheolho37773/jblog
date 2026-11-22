import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/cn';
import { Container } from './Container';
import { Logo } from './Logo';
import { MobileMenu } from './MobileMenu';
import { MobileSearch } from './MobileSearch';
import { NavLinks } from './NavLinks';
import { SearchBox } from './SearchBox';

// 시각 간격(gap 40)과 글자 위치는 두고, 짧은 링크(Blog)의 가로 히트 영역만 좌우 6px씩 넓혀 44px 이상으로 만든다 (UI §4.2).
const DESKTOP_LINK_HIT_AREA =
  "relative after:absolute after:inset-y-0 after:-inset-x-1.5 after:content-['']";

// 메뉴를 화면 가운데에 두려고 >= 1024는 [로고 | 메뉴 | 검색·토글] 3칸 grid(양쪽 1fr)로 둔다.
// 검색 ↔ 토글 간격 40px = gap 8 + 검색 오른쪽 여백 32 (UI §5.1). 검색 폭 166px.

/**
 * 상단 Navbar (UI §5.1). 폭에 따라 보이는 요소가 다르다 (UI §4.2).
 * >= 1024: 메뉴 링크 + 검색 입력창 / 768~1023: 검색 입력창 + 햄버거 / < 768: 검색 아이콘 + 햄버거.
 * 높이: >= 1024는 하단 테두리를 뺀 100px(패딩 32 + 내부 36 기준, UI §4.1), 그보다 좁으면 내용 높이. 조작 요소는 44px 상자라 가운데 정렬로 100px 안에 둔다.
 * 숨기는 요소는 display:none에 visibility:hidden을 더해, 자식 링크까지 확실히 Tab·보조 기술에서 뺀다.
 */
export function Navbar({ sticky = true }: { sticky?: boolean }) {
  return (
    <header className={cn('border-border bg-bg border-b', sticky && 'sticky top-0 z-30')}>
      <Container className="flex items-center gap-2 py-3 laptop:grid laptop:h-25 laptop:grid-cols-[1fr_auto_1fr] laptop:py-0">
        <Logo className="laptop:justify-self-start" />
        <NavLinks
          className="justify-self-center max-laptop:hidden max-laptop:invisible"
          listClassName="gap-10"
          linkClassName={DESKTOP_LINK_HIT_AREA}
        />
        <div className="ml-auto flex items-center gap-2 laptop:ml-0 laptop:justify-self-end">
          <SearchBox className="w-41.5 max-tablet:hidden max-tablet:invisible tablet:mr-8" />
          <MobileSearch className="tablet:hidden" />
          <ThemeToggle />
          <MobileMenu className="laptop:hidden" />
        </div>
      </Container>
    </header>
  );
}
