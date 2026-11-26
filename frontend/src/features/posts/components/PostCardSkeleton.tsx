// 움직임 줄이기 설정이면 깜빡임을 멈춘다 (motion-safe)
const BLOCK = 'bg-bg-subtle motion-safe:animate-pulse';

/**
 * PostCardGrid와 같은 크기·구조의 로딩 자리 표시 (UI §7.2): 썸네일, 배지, 제목 2줄, 메타.
 * 화면 읽기 도구에는 의미가 없어 aria-hidden으로 숨긴다.
 */
export function PostCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-4"
    >
      <div className={`${BLOCK} aspect-[3/2] rounded-md`} />
      <div className="flex flex-col gap-5 p-2">
        <div className="flex flex-col items-start gap-4">
          <div className={`${BLOCK} h-7 w-16 rounded-md`} />
          <div className="flex w-full flex-col">
            {/* 제목 한 줄 = 줄 높이 28 */}
            <div className="flex h-7 items-center">
              <div className={`${BLOCK} h-5 w-full rounded-sm`} />
            </div>
            <div className="flex h-7 items-center">
              <div className={`${BLOCK} h-5 w-2/3 rounded-sm`} />
            </div>
          </div>
        </div>
        <div className={`${BLOCK} h-6 w-40 rounded-sm`} />
      </div>
    </div>
  );
}
