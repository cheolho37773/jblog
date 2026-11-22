import { z } from 'zod';
import { publicSchema } from './env.public-schema';

// 비밀값처럼 보이는 이름은 NEXT_PUBLIC_ 으로 노출하면 브라우저에 공개된다 (개요 §6-b).
const SECRET_NAME_PATTERN = /SECRET|TOKEN|KEY|PASSWORD|SALT|JWT_|DATABASE_URL/;

const serverSchema = z.object({
  API_INTERNAL_URL: z.url(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type PublicEnv = z.infer<typeof publicSchema>;

export const PUBLIC_ENV_KEYS: readonly string[] = Object.keys(publicSchema.shape);

export function findSecretLikePublicKeys(keys: readonly string[]): string[] {
  return keys.filter((key) => SECRET_NAME_PATTERN.test(key));
}

// 이름만 담는다 (값 없음). 모듈이 로드될 때 호출해 위험한 공개 변수가 있으면 빌드·기동을 막는다.
export function assertPublicKeysSafe(keys: readonly string[]): void {
  const secretLikeKeys = findSecretLikePublicKeys(keys);
  if (secretLikeKeys.length > 0) {
    throw new Error(`비밀값처럼 보이는 공개 환경변수 이름: ${secretLikeKeys.join(', ')}`);
  }
}

assertPublicKeysSafe(PUBLIC_ENV_KEYS);

// 오류 메시지에는 변수 이름만 담는다. 입력 값(주소 등)을 로그에 남기지 않기 위해서다.
function invalidNames(error: z.ZodError): string[] {
  const names = error.issues.map((issue) => String(issue.path[0]));
  return [...new Set(names)];
}

function formatInvalidNames(errors: (z.ZodError | undefined)[]): string {
  const names = errors.flatMap((error) => (error ? invalidNames(error) : []));
  return `환경변수가 없거나 올바르지 않습니다: ${names.join(', ')}`;
}

export function parseEnv(raw: Record<string, unknown>): { server: ServerEnv; public: PublicEnv } {
  const server = serverSchema.safeParse(raw);
  const publicValues = publicSchema.safeParse(raw);

  if (!server.success || !publicValues.success) {
    throw new Error(formatInvalidNames([server.error, publicValues.error]));
  }
  return { server: server.data, public: publicValues.data };
}
