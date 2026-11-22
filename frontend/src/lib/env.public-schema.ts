import { z } from 'zod';

// 공개(NEXT_PUBLIC_) 변수 스키마. 비밀값 이름 검사(env.schema.ts)를 테스트에서 시험할 수 있도록 따로 둔다.
export const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
});
