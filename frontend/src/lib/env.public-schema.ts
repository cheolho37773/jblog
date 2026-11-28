import { z } from 'zod';

const SITE_URL_ORIGIN_MESSAGE =
  '도메인 루트 주소(오리진)만 쓸 수 있습니다. 사이트는 도메인 루트에서만 서비스하며, canonical·링크 복사가 같은 주소가 되도록 경로·쿼리·해시를 둘 수 없습니다 (끝 "/" 하나는 가능)';

/** 경로가 없거나 `/` 하나이고, 쿼리·해시가 없는 주소인가. */
function isOriginOnly(value: string): boolean {
  // URL 형식 오류는 z.url()이 이미 보고한다. 여기서 던지지 않는다.
  if (!URL.canParse(value)) return true;
  const { pathname, search, hash } = new URL(value);
  return pathname === '/' && search === '' && hash === '';
}

// 공개(NEXT_PUBLIC_) 변수 스키마. 비밀값 이름 검사(env.schema.ts)를 테스트에서 시험할 수 있도록 따로 둔다.
export const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().refine(isOriginOnly, { message: SITE_URL_ORIGIN_MESSAGE }),
});
