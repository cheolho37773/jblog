import type { ReactNode } from 'react';
import { CopyGuard } from './CopyGuard';

/**
 * 복사 방지 래퍼 (04 §2.2 ①②). `.content-protected` 루트에 CopyGuard를 한 번 마운트한다.
 * SiteChrome과 /dev/protection이 같은 컴포넌트를 써서 테스트한 것과 실제가 같다.
 * main이 이 안에 있어야 인쇄 CSS(`.content-protected main`)가 먹는다.
 * `contents`로 래퍼가 박스를 만들지 않게 한다: Navbar·main·Footer가 계속 body(세로 flex)의 직계 자식처럼 배치되어
 * 모습이 그대로이고(flex 열 래퍼를 두면 Footer 글자 렌더링이 달라져 시각 회귀가 어긋난다), 선택 금지는 상속으로 닿는다.
 */
export function ProtectedShell({ children }: { children: ReactNode }) {
  return (
    <div className="content-protected contents">
      {children}
      <CopyGuard />
    </div>
  );
}
