import Link from 'next/link';
import { Button } from '@/components/ui/Button';

/**
 * 오류 경계(error.tsx)가 함께 쓰는 안내. 오류 경계는 클라이언트 컴포넌트라 이 컴포넌트도 클라이언트에서 그려진다.
 * 오류 내용(메시지·스택)은 보여 주지 않는다: 내부 주소·키 같은 서버 정보가 화면에 새지 않게 한다.
 */
export function ErrorNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-6 py-16 text-center">
      <p className="text-h4 text-strong">문제가 발생했습니다. 잠시 후 다시 시도해 주세요.</p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button variant="outline" onClick={onRetry}>
          다시 시도
        </Button>
        <Button asChild variant="primary">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
