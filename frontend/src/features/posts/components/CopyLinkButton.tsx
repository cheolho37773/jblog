import { CopyTextButton } from '@/components/protection/CopyTextButton';

/** 글 상세의 "링크 복사" (04 §2.4). 받은 canonical 절대 주소만 복사한다. */
export function CopyLinkButton({ url }: { url: string }) {
  return <CopyTextButton text={url} label="링크 복사" successMessage="링크를 복사했습니다" />;
}
