type CoverBackdropProps = {
  src: string | null;
};

/**
 * 오버레이·히어로 카드의 배경: 커버 이미지 + `overlay` 토큰 막(UI §5.5·§5.6).
 * 부모가 `relative`와 크기·radius·overflow를 정한다. 커버가 없으면 부모 배경색이 그대로 보인다.
 */
export function CoverBackdrop({ src }: CoverBackdropProps) {
  return (
    <>
      {src && (
        // /uploads 이미지는 일반 img를 쓴다 (프론트엔드 §5.3). 제목이 링크 이름이라 장식이다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          draggable={false}
          decoding="async"
          className="absolute inset-0 size-full rounded-lg object-cover"
        />
      )}
      <div className="bg-overlay absolute inset-0" />
    </>
  );
}
