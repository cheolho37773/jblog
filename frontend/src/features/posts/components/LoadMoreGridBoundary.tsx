'use client';

import { useSearchParams } from 'next/navigation';
import { useState, type ComponentProps } from 'react';
import { LoadMoreGrid } from './LoadMoreGrid';

type BoundaryProps = Omit<ComponentProps<typeof LoadMoreGrid>, 'onUrlReplace'>;

/**
 * 목록 상태를 버리는 방법은 하나, `LoadMoreGrid`를 다시 만드는 것(remount)이다. 원인은 두 가지다.
 * 1) 서버가 다시 그린 경우: 페이지가 이 경계의 key를 바꾼다.
 * 2) 서버가 다시 그리지 않는 클라이언트 이동(Load More 뒤 같은 `/blog`로 돌아오기 등): 라우터 캐시를 써서 서버 값이 그대로라
 *    주소(`useSearchParams`)가 "Load More가 만든 값"이 아닌 값으로 바뀐 것으로 알아챈다.
 * 다시 만들면 언마운트 때 진행 중 요청도 취소된다(LoadMoreGrid의 abort).
 */
export function LoadMoreGridBoundary(props: BoundaryProps) {
  const search = useSearchParams()?.toString() ?? '';
  const [seenSearch, setSeenSearch] = useState(search);
  const [ownSearch, setOwnSearch] = useState(search);
  const [generation, setGeneration] = useState(0);

  // 이전 렌더와 주소가 달라졌고 그것이 Load More가 만든 주소가 아니면 새 세대로 본다(React가 권하는 "이전 렌더 값 저장" 패턴).
  // 목록 상태를 맞추는 것이 아니라 세대 번호만 올리고, 목록 상태는 remount로 버린다.
  if (search !== seenSearch) {
    setSeenSearch(search);
    if (search !== ownSearch) {
      setOwnSearch(search);
      setGeneration((previous) => previous + 1);
    }
  }

  return <LoadMoreGrid key={generation} {...props} onUrlReplace={setOwnSearch} />;
}
